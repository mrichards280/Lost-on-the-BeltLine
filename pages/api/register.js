import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateTeamCode } from '@/lib/teamCode';
import { priceRegistration, validateMerch } from '@/lib/pricing';
import { sendTeamCodeEmail } from '@/lib/email';

// With Stripe there was a webhook to create the team the moment money landed.
// Venmo has no such signal, so this route does the whole job: it creates the
// team as 'unpaid' and hands back the code and the amount owed. Payment is
// settled by eye at /hq against the organizer's Venmo feed.
const MAX_CODE_ATTEMPTS = 25;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teamName, member1, member2, email, merch } = req.body ?? {};

  for (const [field, value] of Object.entries({ teamName, member1, member2, email })) {
    if (typeof value !== 'string' || value.trim() === '') {
      return res.status(400).json({ error: `Missing ${field}` });
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'That email address looks wrong' });
  }

  const merchError = validateMerch(merch);
  if (merchError) return res.status(400).json({ error: merchError });

  const { items, totalCents } = priceRegistration(merch);

  // A double-tapped submit must not burn a second team code, so an email that
  // is already registered gets its existing team back rather than an error.
  const { data: existing } = await supabaseAdmin
    .from('teams')
    .select('team_code, team_name, amount_due_cents, payment_status')
    .ilike('email', email.trim())
    .maybeSingle();

  if (existing) {
    return res.status(200).json({
      alreadyRegistered: true,
      teamCode: existing.team_code,
      teamName: existing.team_name,
      amountDueCents: existing.amount_due_cents,
      paymentStatus: existing.payment_status,
      items,
    });
  }

  let team;
  try {
    team = await insertTeamWithCode({
      team_name: teamName.trim(),
      member_1_name: member1.trim(),
      member_2_name: member2.trim(),
      email: email.trim(),
      merch_order: merch ?? {},
      amount_due_cents: totalCents,
      payment_status: 'unpaid',
    });
  } catch (err) {
    console.error('Registration failed', err);
    return res.status(500).json({ error: 'Could not register your team' });
  }

  // Lost the race with a concurrent submit of the same email.
  if (!team) {
    const { data: raced } = await supabaseAdmin
      .from('teams')
      .select('team_code, team_name, amount_due_cents, payment_status')
      .ilike('email', email.trim())
      .maybeSingle();

    return res.status(200).json({
      alreadyRegistered: true,
      teamCode: raced?.team_code,
      teamName: raced?.team_name,
      amountDueCents: raced?.amount_due_cents ?? totalCents,
      paymentStatus: raced?.payment_status ?? 'unpaid',
      items,
    });
  }

  const lineItems = [];
  if (merch?.shirt) {
    lineItems.push({ team_id: team.id, item: 'shirt', size: merch.shirtSize ?? null });
  }
  if (merch?.hat) {
    lineItems.push({ team_id: team.id, item: 'hat', size: null });
  }
  if (lineItems.length > 0) {
    const { error } = await supabaseAdmin.from('merch_line_items').insert(lineItems);
    if (error) console.error('merch line item insert failed', error);
  }

  // Never fail the registration over the email — the code is already on screen.
  try {
    await sendTeamCodeEmail(team);
  } catch (err) {
    console.error('Team code email failed for', team.team_code, err);
  }

  return res.status(200).json({
    alreadyRegistered: false,
    teamCode: team.team_code,
    teamName: team.team_name,
    amountDueCents: totalCents,
    paymentStatus: 'unpaid',
    items,
  });
}

// BELT-10..BELT-99 is 90 codes against a unique constraint, so a draw can
// collide. Retry rather than pre-checking — the check-then-write gap is a race.
async function insertTeamWithCode(teamRecord) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .insert({ ...teamRecord, team_code: generateTeamCode() })
      .select()
      .single();

    if (!error) return data;
    if (error.code !== '23505') throw error;
    // A duplicate email, not a duplicate code — the caller re-reads the team.
    if (error.message?.includes('teams_email_key')) return null;
  }
  throw new Error('Could not allocate a free team code after 25 attempts');
}
