// Venmo deep link. The handle is the one thing that must be right, so it is
// always shown as plain text next to the button: prefilled links are a
// convenience that silently degrades (older apps, desktop browsers, a phone
// with no Venmo installed), and a player who can read the handle and the
// amount off the page can always just pay manually.
const VENMO_WEB = 'https://venmo.com';

export function venmoPaymentUrl({ handle, amountCents, note }) {
  if (!handle) return null;

  const params = new URLSearchParams({
    txn: 'pay',
    audience: 'private',
    recipients: handle.replace(/^@/, ''),
    amount: (amountCents / 100).toFixed(2),
    note,
  });

  return `${VENMO_WEB}/?${params.toString()}`;
}

// The note is how the organizer matches a Venmo payment to a team without
// asking. The team code leads so it is readable in the truncated preview
// Venmo shows in the feed.
export function venmoNote(teamCode, teamName) {
  return `${teamCode} - ${teamName} - Lost on the BeltLine`;
}
