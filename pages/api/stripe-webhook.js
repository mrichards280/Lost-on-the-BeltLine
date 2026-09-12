import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateTeamCode } from '@/lib/teamCode';
import { sendTeamCodeEmail } from '@/lib/email';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe signs the raw request body. Next.js would parse it into an object and
// the signature check would fail, so the parser is turned off and the body is
// read off the stream by hand.
export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// BELT-10..BELT-99 is 90 codes and team_code is unique, so a draw can collide.
// Retry on the unique violation instead of pre-checking, for the same reason
// the capacity cap lives in a trigger: the check-then-write gap is a race.
const MAX_CODE_ATTEMPTS = 25;

async function insertTeamWithCode(teamRecord) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .insert({ ...teamRecord, team_code: generateTeamCode() })
      .select()
      .single();

    if (!error) return data;
    if (error.code !== '23505') throw error;
    // 23505 on stripe_payment_id means this event was already processed.
    if (error.message?.includes('stripe_payment_id')) return null;
  }
  throw new Error('Could not allocate a free team code after 25 attempts');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const paymentId = session.payment_intent ?? session.id;

  try {
    // Stripe retries webhooks, so this handler has to be safe to run twice.
    const { data: existing } = await supabaseAdmin
      .from('teams')
      .select('id, team_code')
      .eq('stripe_payment_id', paymentId)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ received: true, teamCode: existing.team_code });
    }

    const merch = JSON.parse(session.metadata?.merch || '{}');

    const team = await insertTeamWithCode({
      team_name: session.metadata.teamName,
      member_1_name: session.metadata.member1,
      member_2_name: session.metadata.member2,
      email: session.metadata.email,
      stripe_payment_id: paymentId,
      merch_order: merch,
    });

    // Lost the idempotency race with a concurrent delivery of the same event.
    if (!team) return res.status(200).json({ received: true });

    // merch_order on teams is the order as placed; merch_line_items is the
    // packing list HQ works from. Both, on purpose.
    const lineItems = [];
    if (merch.shirt) {
      lineItems.push({ team_id: team.id, item: 'shirt', size: merch.shirtSize ?? null });
    }
    if (merch.hat) {
      lineItems.push({ team_id: team.id, item: 'hat', size: null });
    }
    if (lineItems.length > 0) {
      const { error } = await supabaseAdmin.from('merch_line_items').insert(lineItems);
      if (error) console.error('merch line item insert failed', error);
    }

    // The team code is the one thing they need on hunt day. A send failure must
    // not fail the webhook — Stripe would retry and the team already exists.
    try {
      await sendTeamCodeEmail(team);
    } catch (err) {
      console.error('Team code email failed for', team.team_code, err);
    }

    return res.status(200).json({ received: true, teamCode: team.team_code });
  } catch (err) {
    console.error('Webhook handling failed', err);
    // A 500 tells Stripe to retry, which is what we want for a transient DB error.
    return res.status(500).json({ error: 'Could not record the team' });
  }
}
