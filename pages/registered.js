import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15;

export default function Registered() {
  const router = useRouter();
  const sessionId = router.query.session_id;
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!sessionId) return undefined;

    let cancelled = false;
    let attempts = 0;
    let timer;

    async function poll() {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/registration?session_id=${encodeURIComponent(sessionId)}`
        );
        const data = await response.json();
        if (cancelled) return;

        if (data.status === 'ready') {
          setState({ status: 'ready', ...data });
          return;
        }
        if (attempts >= MAX_POLLS) {
          // Payment went through — only the code lookup is lagging, so say
          // exactly that rather than implying the registration failed.
          setState({ status: 'slow' });
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setState({ status: 'slow' });
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  return (
    <main className="wrap">
      <p className="eyebrow">Registered</p>
      <h1>You&rsquo;re in.</h1>

      {state.status === 'loading' && (
        <p className="lede">Confirming your payment and picking your team code...</p>
      )}

      {state.status === 'slow' && (
        <div className="notice warn">
          Your payment went through. The team code is taking a moment to appear &mdash;
          check your email in a minute, and if it still hasn&rsquo;t arrived, find us at
          the start line and we&rsquo;ll read it to you.
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <p className="lede">
            {state.teamName} &mdash; {state.members?.join(' and ')}
          </p>
          <div className="card">
            <p className="eyebrow" style={{ textAlign: 'center' }}>Your team code</p>
            <div className="teamcode">{state.teamCode}</div>
            <p style={{ marginBottom: 0 }}>
              It&rsquo;s in your email too. On hunt day, scan any QR code in your passport
              and type this in once &mdash; your phone remembers it after that.
            </p>
          </div>
        </>
      )}

      <p className="muted">
        <Link href="/leaderboard">Leaderboard</Link>
        {' · '}
        <Link href="/">Front page</Link>
      </p>
    </main>
  );
}
