import { formatUsd } from './pricing.js';
import { venmoNote, venmoPaymentUrl } from './venmo.js';

// Team code delivery. Resend is used if it is configured; if it is not, the
// code is logged instead of throwing, so a missing key on a staging deploy
// never costs a registration. HQ can always read codes back out of /hq.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendTeamCodeEmail(team) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TEAM_CODE_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn(
      `[email] Not configured — team ${team.team_name} code is ${team.team_code} (${team.email})`
    );
    return { delivered: false, reason: 'not_configured' };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [team.email],
      subject: `You're in — your team code is ${team.team_code}`,
      html: teamCodeHtml(team),
      text: teamCodeText(team),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }

  return { delivered: true };
}

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
      `Still owed: ${formatUsd(team.amount_due_cents)}`,
      venmoHandle()
        ? `Venmo @${venmoHandle()} with the note: ${venmoNote(team.team_code, team.team_name)}`
        : 'Ask the organizer where to send it.'
    );
  }

  lines.push(
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
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#1c1a17">
      <h1 style="font-size:22px;margin:0 0 4px">You're in.</h1>
      <p style="margin:0 0 24px;color:#6b635a">
        ${escapeHtml(team.team_name)} — ${escapeHtml(team.member_1_name)} and ${escapeHtml(team.member_2_name)}
      </p>
      <div style="background:#f4f0e8;border:2px solid #1c1a17;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b635a;margin-bottom:8px">Your team code</div>
        <div style="font-size:34px;font-weight:700;letter-spacing:.06em">${escapeHtml(team.team_code)}</div>
      </div>
      ${team.payment_status === 'paid' ? '' : paymentBlockHtml(team)}
      <p style="line-height:1.6">
        On hunt day, scan any QR code in your passport and type this code in once.
        Your phone remembers it after that, so you only do this at the first stop.
      </p>
      <p style="line-height:1.6">
        <a href="${process.env.SITE_URL}/leaderboard" style="color:#1c1a17">Watch the leaderboard &rarr;</a>
      </p>
    </div>
  `;
}

function venmoHandle() {
  return (process.env.NEXT_PUBLIC_VENMO_HANDLE || '').replace(/^@/, '');
}

// The amount owed rides along with the team code, because with Venmo the email
// is the only thing standing in for a payment receipt.
function paymentBlockHtml(team) {
  const handle = venmoHandle();
  const note = venmoNote(team.team_code, team.team_name);
  const amount = formatUsd(team.amount_due_cents);

  if (!handle) {
    return `<p style="line-height:1.6"><strong>Still owed: ${amount}.</strong>
      Ask the organizer where to send it.</p>`;
  }

  const url = venmoPaymentUrl({
    handle,
    amountCents: team.amount_due_cents,
    note,
  });

  return `
    <div style="background:#f7e9d4;border:1px solid #e2c68d;border-radius:10px;padding:16px;margin-bottom:24px">
      <p style="margin:0 0 8px;line-height:1.6">
        <strong>Still owed: ${amount}</strong><br />
        Venmo <strong>@${escapeHtml(handle)}</strong> with the note:
      </p>
      <p style="margin:0 0 8px;font-family:ui-monospace,monospace;font-size:14px">
        ${escapeHtml(note)}
      </p>
      <p style="margin:0"><a href="${url}">Open Venmo &rarr;</a></p>
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
