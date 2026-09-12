import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ENTRY_PRICE_CENTS, PER_PERSON_CENTS, formatUsd } from '@/lib/pricing';
import PayPanel from '@/components/PayPanel';
import MerchPicker from '@/components/MerchPicker';
import CostNote from '@/components/CostNote';

const EMPTY_MERCH = { shirt: false, shirtSize: 'M', hat: false };

// The teammate's half of an invited registration. They arrive from an email
// link with no account and no context, so the page leads with who signed them
// up and what for.
export default function Join() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : null;

  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [name, setName] = useState('');
  const [merch, setMerch] = useState(EMPTY_MERCH);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/join?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Could not load that invite');
        return data;
      })
      .then(setInvite)
      .catch((err) => setLoadError(err.message));
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, member2: name, merch }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not finish signing up');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) return <PayPanel registration={result} />;

  if (!token) {
    return (
      <main className="wrap">
        <h1>This link is missing its invite.</h1>
        <p className="lede">
          Open the link from your teammate&rsquo;s email, or{' '}
          <Link href="/register">register from scratch</Link>.
        </p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="wrap">
        <p className="eyebrow">Invite</p>
        <h1>That link didn&rsquo;t work.</h1>
        <div className="notice bad">{loadError}</div>
        <p className="muted">
          <Link href="/register">Register from scratch</Link>
        </p>
      </main>
    );
  }

  if (!invite) {
    return <main className="wrap"><p className="muted">Loading your invite...</p></main>;
  }

  if (invite.status === 'already_completed') {
    return (
      <PayPanel
        registration={{
          status: 'already_registered',
          teamCode: invite.teamCode,
          teamName: invite.teamName,
          amountDueCents: invite.amountDueCents,
          paymentStatus: invite.paymentStatus,
          items: [{ label: 'Hunt entry (team of 2)', cents: ENTRY_PRICE_CENTS }],
        }}
      />
    );
  }

  return (
    <main className="wrap">
      <p className="eyebrow">You&rsquo;ve been signed up</p>
      <h1>{invite.invitedBy} put you down for this.</h1>
      <p className="lede">
        <strong>Lost on the BeltLine</strong> &mdash; a two-person scavenger hunt through
        Atlanta&rsquo;s Old Fourth Ward. You&rsquo;re on a team called{' '}
        <strong>{invite.teamName}</strong>.
      </p>

      {error && <div className="notice bad">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="name">Your name</label>
            <input
              id="name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Merch (optional)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Yours to pick &mdash; {invite.invitedBy} already chose theirs. Handed out at check-in.
          </p>
          <MerchPicker idPrefix="join" value={merch} onChange={setMerch} />
        </div>

        <CostNote />

        <div className="card">
          <p style={{ marginTop: 0 }}>
            Entry is <strong>{formatUsd(PER_PERSON_CENTS)} each</strong> &mdash;{' '}
            {formatUsd(ENTRY_PRICE_CENTS)} for the team, paid by Venmo. You&rsquo;ll both see the
            total and the team code as soon as you finish.
          </p>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing you up...' : "I'm in"}
          </button>
        </div>
      </form>
    </main>
  );
}
