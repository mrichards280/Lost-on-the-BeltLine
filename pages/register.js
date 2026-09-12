import { useState } from 'react';
import Link from 'next/link';
import {
  ENTRY_PRICE_CENTS,
  HAT_PRICE_CENTS,
  SHIRT_PRICE_CENTS,
  SHIRT_SIZES,
  formatUsd,
  priceRegistration,
} from '@/lib/pricing';
import { venmoNote, venmoPaymentUrl } from '@/lib/venmo';

const VENMO_HANDLE = process.env.NEXT_PUBLIC_VENMO_HANDLE;

export default function Register() {
  const [form, setForm] = useState({
    teamName: '',
    member1: '',
    member2: '',
    email: '',
    shirt: false,
    shirtSize: 'M',
    hat: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [registered, setRegistered] = useState(null);

  const merch = { shirt: form.shirt, shirtSize: form.shirt ? form.shirtSize : null, hat: form.hat };
  const { totalCents } = priceRegistration(merch);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: form.teamName,
          member1: form.member1,
          member2: form.member2,
          email: form.email,
          merch,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not register your team');
      setRegistered(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) return <PayNow registration={registered} />;

  return (
    <main className="wrap">
      <p className="eyebrow">Registration</p>
      <h1>Register your team</h1>
      <p className="lede">
        Two people per team. {formatUsd(ENTRY_PRICE_CENTS)} covers both of you &mdash;
        you&rsquo;ll Venmo it on the next screen.
      </p>

      {error && <div className="notice bad">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field">
            <label htmlFor="teamName">Team name</label>
            <input
              id="teamName"
              type="text"
              required
              maxLength={60}
              value={form.teamName}
              onChange={(e) => update('teamName', e.target.value)}
              placeholder="The Krog Street Krew"
            />
          </div>
          <div className="field">
            <label htmlFor="member1">Member 1</label>
            <input
              id="member1"
              type="text"
              required
              value={form.member1}
              onChange={(e) => update('member1', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="member2">Member 2</label>
            <input
              id="member2"
              type="text"
              required
              value={form.member2}
              onChange={(e) => update('member2', e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Your team code goes here. One team per email address.
            </p>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Merch (optional)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Pre-order only, handed out at check-in. Add it to your Venmo total.
          </p>
          <div className="checkline">
            <input
              id="shirt"
              type="checkbox"
              checked={form.shirt}
              onChange={(e) => update('shirt', e.target.checked)}
            />
            <label htmlFor="shirt">Shirt &mdash; {formatUsd(SHIRT_PRICE_CENTS)}</label>
          </div>
          {form.shirt && (
            <div className="field" style={{ marginLeft: 30 }}>
              <label htmlFor="shirtSize">Size</label>
              <select
                id="shirtSize"
                value={form.shirtSize}
                onChange={(e) => update('shirtSize', e.target.value)}
              >
                {SHIRT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="checkline">
            <input
              id="hat"
              type="checkbox"
              checked={form.hat}
              onChange={(e) => update('hat', e.target.checked)}
            />
            <label htmlFor="hat">Hat &mdash; {formatUsd(HAT_PRICE_CENTS)}</label>
          </div>
        </div>

        <div className="card">
          <p style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 16px' }}>
            <strong>You&rsquo;ll Venmo</strong>
            <strong>{formatUsd(totalCents)}</strong>
          </p>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Registering...' : 'Register and get my team code'}
          </button>
        </div>
      </form>

      <p className="muted">
        <Link href="/">Back to the front page</Link>
      </p>
    </main>
  );
}

function PayNow({ registration }) {
  const { teamCode, teamName, amountDueCents, items, alreadyRegistered, paymentStatus } = registration;
  const note = venmoNote(teamCode, teamName);
  const venmoUrl = venmoPaymentUrl({ handle: VENMO_HANDLE, amountCents: amountDueCents, note });

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
                <td><strong>Total</strong></td>
                <td className="num"><strong>{formatUsd(amountDueCents)}</strong></td>
              </tr>
            </tbody>
          </table>

          {VENMO_HANDLE ? (
            <>
              <p style={{ marginTop: 0 }}>
                Send to <strong>@{VENMO_HANDLE.replace(/^@/, '')}</strong> with this note so we
                can match it to your team:
              </p>
              <div className="teamcode" style={{ fontSize: 15, letterSpacing: 0, padding: 14 }}>
                {note}
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

      <p className="muted">
        <Link href="/leaderboard">Leaderboard</Link>
        {' · '}
        <Link href="/">Front page</Link>
      </p>
    </main>
  );
}
