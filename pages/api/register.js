import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { insertMerch, insertTeamWithCode } from '@/lib/teams';
import { priceRegistration, validateMerch } from '@/lib/pricing';
import { generateInviteToken } from '@/lib/invite';
import { sendPartnerInviteEmail, sendTeamCodeEmail } from '@/lib/email';

// Two ways in:
//
//   mode 'together'  both people are at the same phone. Creates the team now.
//   mode 'invite'    one person signs up and sends the rest to their teammate.
//                    Creates a pending_registrations row and nothing else —
//                    no team, no code, no amount owed — until the teammate
//                    finishes it at /join.
//
// Either way payment is Venmo, so there is no webhook to create anything and
// the team is 'unpaid' from birth until someone settles it at /hq.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, teamName, member1, member2, email, member2Email, merch, partnerMerch } =
    req.body ?? {};

  if (!isFilled(teamName)) return res.status(400).json({ error: 'Missing teamName' });
  if (!isFilled(member1)) return res.status(400).json({ error: 'Missing member1' });
  if (!isEmail(email)) return res.status(400).json({ error: 'That email address looks wrong' });

  const merchError = validateMerch(merch);
  if (merchError) return res.status(400).json({ error: merchError });

  return mode === 'invite'
    ? handleInvite({ teamName, member1, email, member2Email, merch }, res)
    : handleTogether({ teamName, member1, member2, email, member2Email, merch, partnerMerch }, res);
}

// --- both people present ----------------------------------------------------

async function handleTogether(input, res) {
  const { teamName, member1, member2, email, member2Email, merch, partnerMerch } = input;

  if (!isFilled(member2)) return res.status(400).json({ error: 'Missing member2' });
  if (member2Email && !isEmail(member2Email)) {
    return res.status(400).json({ error: "That teammate's email looks wrong" });
  }
  const partnerMerchError = validateMerch(partnerMerch);
  if (partnerMerchError) return res.status(400).json({ error: partnerMerchError });

  const people = [
    { name: member1.trim(), merch: merch ?? {} },
    { name: member2.trim(), merch: partnerMerch ?? {} },
  ];
  const { items, totalCents } = priceRegistration(people);

  // A double-tapped submit must not burn a second team code, so an email that
  // is already registered gets its existing team back rather than an error.
  const existing = await findTeamByEmail(email);
  if (existing) return res.status(200).json(existingPayload(existing, items));

  let team;
  try {
    team = await insertTeamWithCode({
      team_name: teamName.trim(),
      member_1_name: member1.trim(),
      member_2_name: member2.trim(),
      email: email.trim(),
      member_2_email: member2Email?.trim() || null,
      merch_order: { [member1.trim()]: merch ?? {}, [member2.trim()]: partnerMerch ?? {} },
      amount_due_cents: totalCents,
      payment_status: 'unpaid',
    });
  } catch (err) {
    console.error('Registration failed', err);
    return res.status(500).json({ error: 'Could not register your team' });
  }

  if (!team) {
    const raced = await findTeamByEmail(email);
    return res.status(200).json(existingPayload(raced, items, totalCents));
  }

  await insertMerch(team.id, people);
  await emailTeamCode(team);

  return res.status(200).json({
    status: 'registered',
    teamCode: team.team_code,
    teamName: team.team_name,
    amountDueCents: totalCents,
    paymentStatus: 'unpaid',
    items,
  });
}

// --- one person, invite the other -------------------------------------------

async function handleInvite(input, res) {
  const { teamName, member1, email, member2Email, merch } = input;

  if (!isEmail(member2Email)) {
    return res.status(400).json({ error: "Enter your teammate's email so we can send it to them" });
  }
  if (member2Email.trim().toLowerCase() === email.trim().toLowerCase()) {
    return res.status(400).json({ error: 'Use your teammate’s email, not your own' });
  }

  // Already registered outright? Then there is nothing to invite.
  const existing = await findTeamByEmail(email);
  if (existing) {
    const { items } = priceRegistration([{ name: existing.member_1_name }]);
    return res.status(200).json(existingPayload(existing, items));
  }

  // An open invite from this person already exists — resend it rather than
  // creating a second one, so a re-submit does not fork the registration.
  const { data: open } = await supabaseAdmin
    .from('pending_registrations')
    .select('*')
    .ilike('member_1_email', email.trim())
    .is('completed_at', null)
    .maybeSingle();

  let pending = open;

  if (!pending) {
    const { data, error } = await supabaseAdmin
      .from('pending_registrations')
      .insert({
        token: generateInviteToken(),
        team_name: teamName.trim(),
        member_1_name: member1.trim(),
        member_1_email: email.trim(),
        member_2_email: member2Email.trim(),
        member_1_merch: merch ?? {},
      })
      .select()
      .single();

    if (error) {
      console.error('Could not create invite', error);
      return res.status(500).json({ error: 'Could not send that invite' });
    }
    pending = data;
  }

  // The invite IS the registration — if this email fails to send, nothing
  // reaches the teammate and the sign-up quietly dies. So unlike the team code
  // email, a failure here is reported rather than swallowed.
  try {
    await sendPartnerInviteEmail(pending);
  } catch (err) {
    console.error('Partner invite email failed', err);
    return res.status(502).json({
      status: 'invite_email_failed',
      partnerEmail: pending.member_2_email,
      error:
        'Your details are saved, but we could not email your teammate. ' +
        'Send them the link yourself, or try again in a minute.',
      inviteToken: pending.token,
    });
  }

  return res.status(200).json({
    status: 'invited',
    partnerEmail: pending.member_2_email,
    teamName: pending.team_name,
    resent: Boolean(open),
  });
}

// --- helpers ----------------------------------------------------------------

const isFilled = (value) => typeof value === 'string' && value.trim() !== '';
const isEmail = (value) => isFilled(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

async function findTeamByEmail(email) {
  const { data } = await supabaseAdmin
    .from('teams')
    .select('team_code, team_name, member_1_name, amount_due_cents, payment_status')
    .ilike('email', email.trim())
    .maybeSingle();
  return data;
}

function existingPayload(team, items, fallbackTotal) {
  return {
    status: 'already_registered',
    teamCode: team?.team_code,
    teamName: team?.team_name,
    amountDueCents: team?.amount_due_cents ?? fallbackTotal,
    paymentStatus: team?.payment_status ?? 'unpaid',
    items,
  };
}

async function emailTeamCode(team) {
  // Never fail a registration over the email — the code is already on screen.
  try {
    await sendTeamCodeEmail(team);
  } catch (err) {
    console.error('Team code email failed for', team.team_code, err);
  }
}
