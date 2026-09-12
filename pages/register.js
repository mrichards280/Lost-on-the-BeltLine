import { useState } from 'react';
import Link from 'next/link';
import {
  ENTRY_PRICE_CENTS,
  PER_PERSON_CENTS,
  formatUsd,
  priceRegistration,
} from '@/lib/pricing';
import PayPanel from '@/components/PayPanel';
import MerchPicker from '@/components/MerchPicker';
import CostNote from '@/components/CostNote';

const EMPTY_MERCH = { shirt: false, shirtSize: 'M', hat: false };

export default function Register() {
  // 'together' — both of you are here. 'invite' — sign yourself up and send
  // the rest to your teammate.
  const [mode, setMode] = useState('together');
  const [form, setForm] = useState({
    teamName: '',
    member1: '',
    member2: '',
    email: '',
    member2Email: '',
  });
  const [merch, setMerch] = useState(EMPTY_MERCH);
  const [partnerMerch, setPartnerMerch] = useState(EMPTY_MERCH);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const people =
    mode === 'invite'
      ? [{ name: form.member1, merch }]
      : [{ name: form.member1, merch }, { name: form.member2, merch: partnerMerch }];
  const { totalCents } = priceRegistration(people);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          teamName: form.teamName,
          member1: form.member1,
          member2: mode === 'together' ? form.member2 : undefined,
          email: form.email,
          member2Email: form.member2Email || undefined,
          merch,
          partnerMerch: mode === 'together' ? partnerMerch : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not register your team');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.status === 'invited') return <InviteSent result={result} />;
  if (result) return <PayPanel registration={result} />;

  return (
    <main className="wrap">
      <p className="eyebrow">Registration</p>
      <h1>Register your team</h1>
      <p className="lede">
        Two people per team. {formatUsd(PER_PERSON_CENTS)} each &mdash;{' '}
        {formatUsd(ENTRY_PRICE_CENTS)} for the team, paid by Venmo once you&rsquo;re both in.
      </p>

      {error && <div className="notice bad">{error}</div>}

      <div className="card">
        <div className="segmented" role="group" aria-label="Who's signing up">
          <button
            type="button"
            className={mode === 'together' ? 'on' : ''}
            aria-pressed={mode === 'together'}
            onClick={() => setMode('together')}
          >
            We&rsquo;re both here
          </button>
          <button
            type="button"
            className={mode === 'invite' ? 'on' : ''}
            aria-pressed={mode === 'invite'}
            onClick={() => setMode('invite')}
          >
            Just me for now
          </button>
        </div>
        <p className="muted" style={{ margin: '12px 0 0' }}>
          {mode === 'together'
            ? 'Fill in both of you and you’re done.'
            : 'We’ll email your teammate a link to add their half. Nothing is booked until they finish it.'}
        </p>
      </div>

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
            <label htmlFor="member1">{mode === 'invite' ? 'Your name' : 'Member 1'}</label>
            <input
              id="member1"
              type="text"
              required
              value={form.member1}
              onChange={(e) => update('member1', e.target.value)}
            />
          </div>

          {/* Both names sit together, then both emails. Splitting the pair with
              an email field made "Member 1" and "Member 2" read as unrelated. */}
          {mode === 'together' && (
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
          )}

          <div className="field">
            <label htmlFor="email">
              {mode === 'invite' ? 'Your email' : 'Email for the team code'}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="member2Email">
              {mode === 'invite' ? "Teammate's email" : 'Their email (optional)'}
            </label>
            <input
              id="member2Email"
              type="email"
              required={mode === 'invite'}
              value={form.member2Email}
              onChange={(e) => update('member2Email', e.target.value)}
            />
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {mode === 'invite'
                ? 'We’ll send them a link to add their name and pick their merch.'
                : 'Add it and the team code goes to both of you.'}
            </p>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Merch (optional)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Pre-order only, handed out at check-in.
          </p>
          <MerchPicker
            idPrefix="me"
            value={merch}
            onChange={setMerch}
            heading={mode === 'together' ? form.member1 || 'Member 1' : null}
          />
          {mode === 'together' && (
            <MerchPicker
              idPrefix="partner"
              value={partnerMerch}
              onChange={setPartnerMerch}
              heading={form.member2 || 'Member 2'}
            />
          )}
          {mode === 'invite' && (
            <p className="muted" style={{ marginBottom: 0 }}>
              Your teammate picks their own when they finish signing up.
            </p>
          )}
        </div>

        <CostNote />

        <div className="card">
          <p style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 4px' }}>
            <strong>{mode === 'invite' ? 'Team total so far' : "You'll Venmo"}</strong>
            <strong>{formatUsd(totalCents)}</strong>
          </p>
          <p className="muted" style={{ margin: '0 0 16px' }}>
            {mode === 'invite'
              ? "Your teammate's merch gets added when they finish. You'll both get the total then."
              : `Entry is ${formatUsd(PER_PERSON_CENTS)} each; pay it as one team payment.`}
          </p>
          <button type="submit" disabled={submitting}>
            {submitting
              ? mode === 'invite' ? 'Sending...' : 'Registering...'
              : mode === 'invite' ? 'Send it to my teammate' : 'Register and get my team code'}
          </button>
        </div>
      </form>

      <p className="muted">
        <Link href="/">Back to the front page</Link>
      </p>
    </main>
  );
}

function InviteSent({ result }) {
  return (
    <main className="wrap">
      <p className="eyebrow">Sent</p>
      <h1>Over to {result.teamName}&rsquo;s other half.</h1>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          We emailed <strong>{result.partnerEmail}</strong> a link to add their name and pick
          their merch.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Nothing is booked until they finish it.</strong> As soon as they do, you&rsquo;ll
          both get the team code and the Venmo total.
        </p>
      </div>
      {result.resent && (
        <div className="notice warn">
          You&rsquo;d already started this one, so we resent the same link rather than making a
          second team.
        </div>
      )}
      <CostNote />
      <p className="muted">
        Nothing arrived? Check their spam, or{' '}
        <Link href="/register">start again</Link>.
      </p>
    </main>
  );
}
