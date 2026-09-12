import Link from 'next/link';
import { PER_PERSON_CENTS, formatUsd } from '@/lib/pricing';
import { venmoNote, venmoPaymentUrl } from '@/lib/venmo';
import CostNote from '@/components/CostNote';

const VENMO_HANDLE = process.env.NEXT_PUBLIC_VENMO_HANDLE;

// The end of both routes in: registering with your teammate present, and
// finishing an invite. Same team code, same Venmo instructions.
export default function PayPanel({ registration }) {
  const { teamCode, teamName, amountDueCents, items, status, paymentStatus } = registration;
  const alreadyRegistered = status === 'already_registered';
  const note = venmoNote(teamCode, teamName);
  const venmoUrl = venmoPaymentUrl({
    handle: VENMO_HANDLE,
    amountCents: amountDueCents,
    note,
  });

  return (
    <main className="wrap">
      <p className="eyebrow">{alreadyRegistered ? 'Already registered' : 'Registered'}</p>
      <h1>{alreadyRegistered ? "You're already in." : "You're in."}</h1>

      {alreadyRegistered && (
        <div className="notice warn">
          That email is already registered as <strong>{teamName}</strong>, so here&rsquo;s the
          original team code rather than a new one.
        </div>
      )}

      <div className="card">
        <p className="eyebrow" style={{ textAlign: 'center' }}>Your team code</p>
        <div className="teamcode">{teamCode}</div>
        <p style={{ marginBottom: 0 }}>
          It&rsquo;s in your email too. On hunt day, scan any QR code in your passport and type
          this in once &mdash; your phone remembers it after that.
        </p>
      </div>

      {paymentStatus === 'paid' ? (
        <div className="notice good">
          <strong>Payment received.</strong> Nothing else to do &mdash; see you at the start line.
        </div>
      ) : (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Now Venmo {formatUsd(amountDueCents)}</h2>

          <table style={{ marginBottom: 16 }}>
            <tbody>
              {items?.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td className="num">{formatUsd(item.cents)}</td>
                </tr>
              ))}
              <tr>
                <td><strong>Total for the team</strong></td>
                <td className="num"><strong>{formatUsd(amountDueCents)}</strong></td>
              </tr>
            </tbody>
          </table>

          <p className="muted" style={{ marginTop: 0 }}>
            One payment for the team &mdash; entry works out at{' '}
            {formatUsd(PER_PERSON_CENTS)} each, so settle up between yourselves however you like.
          </p>

          {VENMO_HANDLE ? (
            <>
              <p>
                Send to <strong>@{VENMO_HANDLE.replace(/^@/, '')}</strong> with this note so we
                can match it to your team:
              </p>
              <div className="notecode-wrap">
                <div className="teamcode" style={{ fontSize: 15, letterSpacing: 0, padding: 14 }}>
                  {note}
                </div>
              </div>
              {venmoUrl && (
                <p style={{ marginTop: 16, marginBottom: 8 }}>
                  <a href={venmoUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <button type="button">Open Venmo</button>
                  </a>
                </p>
              )}
              <p className="muted" style={{ marginBottom: 0 }}>
                If that button doesn&rsquo;t fill anything in, just pay
                {' '}@{VENMO_HANDLE.replace(/^@/, '')} manually &mdash; the amount and note above
                are all we need. Your spot is held either way; we settle up at check-in.
              </p>
            </>
          ) : (
            <div className="notice warn" style={{ marginBottom: 0 }}>
              The Venmo handle hasn&rsquo;t been configured on this site yet
              (<code>NEXT_PUBLIC_VENMO_HANDLE</code>). Your team is registered &mdash; ask the
              organizer where to send {formatUsd(amountDueCents)}.
            </div>
          )}
        </div>
      )}

      <CostNote />

      <p className="muted">
        <Link href="/leaderboard">Leaderboard</Link>
        {' · '}
        <Link href="/">Front page</Link>
      </p>
    </main>
  );
}
