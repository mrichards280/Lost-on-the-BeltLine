import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { insertMerch, insertTeamWithCode } from '@/lib/teams';
import { priceRegistration, validateMerch } from '@/lib/pricing';
import { sendTeamCodeEmail } from '@/lib/email';

// The teammate's half of an invited registration.
//
// GET  — what the invite is for, so the page can show who invited them.
// POST — the teammate's name and merch. This is the point the team actually
//        comes into existence, so both people get the code.
export default async function handler(req, res) {
  const token = typeof req.query.token === 'string' ? req.query.token : req.body?.token;
  if (!token) return res.status(400).json({ error: 'Missing invite token' });

  const { data: pending } = await supabaseAdmin
    .from('pending_registrations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (!pending) {
    return res.status(404).json({
      error: 'That invite link is not valid. Ask your teammate to send it again.',
    });
  }

  if (req.method === 'GET') return handleGet(pending, res);
  if (req.method === 'POST') return handlePost(pending, req, res);

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(pending, res) {
  // Already finished: show the team code rather than a dead end, so a teammate
  // who reopens the link from their inbox still gets something useful.
  if (pending.completed_at && pending.team_id) {
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('team_code, team_name, amount_due_cents, payment_status')
      .eq('id', pending.team_id)
      .maybeSingle();

    return res.status(200).json({
      status: 'already_completed',
      teamName: pending.team_name,
      invitedBy: pending.member_1_name,
      teamCode: team?.team_code,
      amountDueCents: team?.amount_due_cents,
      paymentStatus: team?.payment_status,
    });
  }

  return res.status(200).json({
    status: 'open',
    teamName: pending.team_name,
    invitedBy: pending.member_1_name,
    invitedEmail: pending.member_2_email,
  });
}

async function handlePost(pending, req, res) {
  if (pending.completed_at) {
    return res.status(409).json({ error: 'This invite has already been completed.' });
  }

  const { member2, merch } = req.body ?? {};
  if (typeof member2 !== 'string' || member2.trim() === '') {
    return res.status(400).json({ error: 'Enter your name' });
  }
  const merchError = validateMerch(merch);
  if (merchError) return res.status(400).json({ error: merchError });

  const people = [
    { name: pending.member_1_name, merch: pending.member_1_merch ?? {} },
    { name: member2.trim(), merch: merch ?? {} },
  ];
  const { items, totalCents } = priceRegistration(people);

  let team;
  try {
    team = await insertTeamWithCode({
      team_name: pending.team_name,
      member_1_name: pending.member_1_name,
      member_2_name: member2.trim(),
      email: pending.member_1_email,
      member_2_email: pending.member_2_email,
      merch_order: {
        [pending.member_1_name]: pending.member_1_merch ?? {},
        [member2.trim()]: merch ?? {},
      },
      amount_due_cents: totalCents,
      payment_status: 'unpaid',
    });
  } catch (err) {
    console.error('Join failed', err);
    return res.status(500).json({ error: 'Could not finish that registration' });
  }

  // The inviter registered a team by some other route in the meantime.
  if (!team) {
    return res.status(409).json({
      error: `${pending.member_1_name} is already registered with this email. Ask them for the team code.`,
    });
  }

  // Close the invite so the link cannot mint a second team. Only after the
  // team exists — if this update fails the team is still real and the worst
  // case is a stale open invite, which /hq surfaces.
  const { error: closeError } = await supabaseAdmin
    .from('pending_registrations')
    .update({ completed_at: new Date().toISOString(), team_id: team.id })
    .eq('id', pending.id)
    .is('completed_at', null);

  if (closeError) console.error('Could not close invite', closeError);

  await insertMerch(team.id, people);

  // Both halves get the code — the person who started this is not here.
  for (const address of [team.email, team.member_2_email].filter(Boolean)) {
    try {
      await sendTeamCodeEmail({ ...team, email: address });
    } catch (err) {
      console.error('Team code email failed for', address, err);
    }
  }

  return res.status(200).json({
    status: 'registered',
    teamCode: team.team_code,
    teamName: team.team_name,
    amountDueCents: totalCents,
    paymentStatus: 'unpaid',
    items,
  });
}
