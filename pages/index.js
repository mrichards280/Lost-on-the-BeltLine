import Link from 'next/link';

export default function Home() {
  return (
    <main className="wrap">
      <p className="eyebrow">Old Fourth Ward &middot; Atlanta</p>
      <h1>Lost on the BeltLine</h1>
      <p className="lede">
        A two-person scavenger hunt through the Old Fourth Ward. Four categories,
        one afternoon, a paper passport and a phone.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>How it works</h2>
        <ol style={{ lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
          <li>Register as a team of two, then Venmo the entry fee. You get a team code by email.</li>
          <li>Pick up your passport at the start line.</li>
          <li>
            Scan the QR code on a passport page, pick the challenge you just did,
            attach a photo. Type your code in once — your phone remembers it.
          </li>
        </ol>
      </div>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          Some stops are capped, and a couple are Golden Tickets — one team, once,
          first to claim it. Move accordingly.
        </p>
        <Link href="/register" style={{ textDecoration: 'none' }}>
          <button>Register a team &mdash; $50 by Venmo</button>
        </Link>
      </div>

      <p className="muted">
        <Link href="/leaderboard">Live leaderboard</Link>
        {' · '}
        <a href="/interest.html">Not ready yet? Leave your email</a>
      </p>
    </main>
  );
}
