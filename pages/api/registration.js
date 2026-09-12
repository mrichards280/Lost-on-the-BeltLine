import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// The success page lands here to show the team code. The webhook that creates
// the team races the browser redirect and usually wins, but not always — so
// "pending" is a real answer and the page polls rather than showing an error.
export default async function handler(req, res) {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.status(400).json({ error: 'session_id required' });

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('Could not retrieve checkout session', err.message);
    return res.status(404).json({ error: 'Unknown checkout session' });
  }

  if (session.payment_status !== 'paid') {
    return res.status(200).json({ status: 'unpaid' });
  }

  const paymentId = session.payment_intent ?? session.id;
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('team_code, team_name, member_1_name, member_2_name')
    .eq('stripe_payment_id', paymentId)
    .maybeSingle();

  if (!team) return res.status(200).json({ status: 'pending' });

  return res.status(200).json({
    status: 'ready',
    teamCode: team.team_code,
    teamName: team.team_name,
    members: [team.member_1_name, team.member_2_name],
  });
}
