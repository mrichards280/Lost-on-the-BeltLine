import { formatUsd, OUT_OF_POCKET_HIGH_CENTS, OUT_OF_POCKET_LOW_CENTS } from './pricing.js';
import { venmoNote, venmoPaymentUrl } from './venmo.js';
import { inviteUrl } from './invite.js';

// Resend is used if it is configured. For the team code, a send failure is
// logged rather than thrown — the code is already on screen and readable from
// /hq. The partner invite is different: it IS the registration, so that caller
// treats a failure as an error.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const SHELL = (inner) => `
  <div style="font-family:Outfit,system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#2b1b3d">
    ${inner}
  </div>
`;

export async function sendTeamCodeEmail(team) {
  return send({
    to: team.email,
    subject: `You're in — your team code is ${team.team_code}`,
    html: SHELL(teamCodeHtml(team)),
    text: teamCodeText(team),
    fallbackLog: `[email] team ${team.team_name} code is ${team.team_code} (${team.email})`,
  });
}

export async function sendPartnerInviteEmail(pending) {
  const url = inviteUrl(pending.token);
  return send({
    to: pending.member_2_email,
    subject: `${pending.member_1_name} signed you up for a scavenger hunt`,
    html: SHELL(inviteHtml(pending, url)),
    text: inviteText(pending, url),
    fallbackLog: `[email] invite for ${pending.member_2_email}: ${url}`,
    // Without this the teammate never hears about it and the sign-up dies.
    throwIfUnconfigured: true,
  });
}

async function send({ to, subject, html, text, fallbackLog, throwIfUnconfigured = false }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TEAM_CODE_FROM_EMAIL;

  if (!apiKey || !from) {
    if (throwIfUnconfigured) {
      throw new Error('RESEND_API_KEY and TEAM_CODE_FROM_EMAIL must be set to send invites');
    }
    console.warn(`${fallbackLog} — email not configured`);
    return { delivered: false, reason: 'not_configured' };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
  return { delivered: true };
}

/* ------------------------------- team code ------------------------------- */

function teamCodeText(team) {
  const lines = [
    `${team.team_name} is registered for the Old Fourth Ward scavenger hunt.`,
    '',
    `Your team code: ${team.team_code}`,
    '',
    `Team: ${team.member_1_name} and ${team.member_2_name}`,
  ];

  if (team.payment_status !== 'paid') {
    lines.push(
      '',
      `Still owed: ${formatUsd(team.amount_due_cents)} for the team.`,
      venmoHandle()
        ? `Venmo @${venmoHandle()} with the note: ${venmoNote(team.team_code, team.team_name)}`
        : 'Ask the organizer where to send it.'
    );
  }

  lines.push(
    '',
    outOfPocketLine(),
    '',
    'On hunt day, scan any QR code in your passport and type this code in once.',
    'Your phone remembers it after that.',
    '',
    `Leaderboard: ${process.env.SITE_URL}/leaderboard`
  );

  return lines.join('\n');
}

function teamCodeHtml(team) {
  return `
    <h1 style="font-size:22px;margin:0 0 4px">You're in.</h1>
    <p style="margin:0 0 24px;color:#6d5b80">
      ${escapeHtml(team.team_name)} — ${escapeHtml(team.member_1_name)} and ${escapeHtml(team.member_2_name)}
    </p>
    <div style="background:#fff4f7;border:2px solid #2b1b3d;border-radius:14px;padding:24px;text-align:center;margin-bottom:20px">
      <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6d5b80;margin-bottom:8px">Your team code</div>
      <div style="font-family:ui-monospace,monospace;font-size:34px;font-weight:600;letter-spacing:.08em">${escapeHtml(team.team_code)}</div>
    </div>
    ${team.payment_status === 'paid' ? '' : paymentBlockHtml(team)}
    ${outOfPocketHtml()}
    <p style="line-height:1.6">
      On hunt day, scan any QR code in your passport and type this code in once.
      Your phone remembers it after that, so you only do this at the first stop.
    </p>
    <p style="line-height:1.6">
      <a href="${process.env.SITE_URL}/leaderboard" style="color:#e0457b">Watch the leaderboard &rarr;</a>
    </p>
  `;
}

/* -------------------------------- invite --------------------------------- */

function inviteText(pending, url) {
  return [
    `${pending.member_1_name} signed you both up for Lost on the BeltLine —`,
    `a two-person scavenger hunt through Atlanta's Old Fourth Ward.`,
    '',
    `Team name: ${pending.team_name}`,
    '',
    'Nothing is booked until you finish it. Add your name here:',
    url,
    '',
    `Entry is ${formatUsd(2500)} each (${formatUsd(5000)} for the team), paid by Venmo after you both sign up.`,
    outOfPocketLine(),
  ].join('\n');
}

function inviteHtml(pending, url) {
  return `
    <h1 style="font-size:22px;margin:0 0 4px">${escapeHtml(pending.member_1_name)} signed you up.</h1>
    <p style="margin:0 0 20px;color:#6d5b80">
      Lost on the BeltLine — a two-person scavenger hunt through Atlanta's Old Fourth Ward.
    </p>
    <div style="background:#fff4f7;border:1px solid #e7d5e4;border-radius:14px;padding:20px;margin-bottom:20px">
      <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6d5b80;margin-bottom:6px">Your team</div>
      <div style="font-size:20px;font-weight:600">${escapeHtml(pending.team_name)}</div>
    </div>
    <p style="line-height:1.6">
      <strong>Nothing is booked until you finish it.</strong> Add your name and pick your merch:
    </p>
    <p style="margin:0 0 22px">
      <a href="${url}" style="display:inline-block;background:#e0457b;color:#fff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:600">Finish signing up &rarr;</a>
    </p>
    <p style="line-height:1.6;color:#6d5b80;font-size:14px">
      Entry is ${formatUsd(2500)} each (${formatUsd(5000)} for the team), paid by Venmo once you're both in.
    </p>
    ${outOfPocketHtml()}
  `;
}

/* -------------------------------- shared --------------------------------- */

function outOfPocketLine() {
  return (
    `Heads up: entry covers the hunt itself. Food, drinks and anything you make ` +
    `or take home at the stops are yours to pay for — budget about ` +
    `${formatUsd(OUT_OF_POCKET_LOW_CENTS)}–${formatUsd(OUT_OF_POCKET_HIGH_CENTS)} each on the day.`
  );
}

function outOfPocketHtml() {
  return `
    <div style="background:#fff6e6;border:1px solid #f0d9a8;border-radius:12px;padding:14px 16px;margin-bottom:20px;line-height:1.55;font-size:14px">
      <strong>Bring a card.</strong> Entry covers the hunt itself. Food, drinks and anything you
      make or take home at the stops are yours to pay for — budget about
      ${formatUsd(OUT_OF_POCKET_LOW_CENTS)}&ndash;${formatUsd(OUT_OF_POCKET_HIGH_CENTS)} each on the day.
    </div>
  `;
}

function venmoHandle() {
  return (process.env.NEXT_PUBLIC_VENMO_HANDLE || '').replace(/^@/, '');
}

function paymentBlockHtml(team) {
  const handle = venmoHandle();
  const note = venmoNote(team.team_code, team.team_name);
  const amount = formatUsd(team.amount_due_cents);

  if (!handle) {
    return `<p style="line-height:1.6"><strong>Still owed: ${amount}.</strong>
      Ask the organizer where to send it.</p>`;
  }

  const url = venmoPaymentUrl({ handle, amountCents: team.amount_due_cents, note });

  return `
    <div style="background:#fff6e6;border:1px solid #f0d9a8;border-radius:12px;padding:16px;margin-bottom:20px">
      <p style="margin:0 0 8px;line-height:1.6">
        <strong>Still owed: ${amount}</strong> for the team.<br />
        Venmo <strong>@${escapeHtml(handle)}</strong> with the note:
      </p>
      <p style="margin:0 0 8px;font-family:ui-monospace,monospace;font-size:14px">
        ${escapeHtml(note)}
      </p>
      <p style="margin:0"><a href="${url}" style="color:#e0457b">Open Venmo &rarr;</a></p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}
