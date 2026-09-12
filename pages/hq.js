import { useCallback, useEffect, useState } from 'react';
import { formatUsd } from '@/lib/pricing';

const PASSCODE_KEY = 'beltline.hqPasscode';

// Staff view. Two jobs: settling Venmo payments at check-in, and the
// sticker-matching pass at the end — every team, what the database says they
// claimed, and the proof photo for each one.
//
// Reading is unauthenticated by design for a 15-team friends event; it is
// simply not linked from anywhere public. Marking a team paid is a write, so
// it requires HQ_PASSCODE. See the README before pointing this at a bigger
// event or a real email list.
export default function HQ() {
  const [teams, setTeams] = useState(null);
  const [payments, setPayments] = useState(null);
  const [openInvites, setOpenInvites] = useState([]);
  const [error, setError] = useState(null);
  const [passcode, setPasscode] = useState('');
  const [busyCode, setBusyCode] = useState(null);
  const [paymentError, setPaymentError] = useState(null);

  useEffect(() => {
    setPasscode(window.localStorage.getItem(PASSCODE_KEY) ?? '');
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/hq');
      if (!response.ok) throw new Error('Could not load HQ data');
      const data = await response.json();
      setTeams(data.teams);
      setPayments(data.payments);
      setOpenInvites(data.openInvites ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePaid(team) {
    setBusyCode(team.teamCode);
    setPaymentError(null);

    try {
      const response = await fetch('/api/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hq-passcode': passcode },
        body: JSON.stringify({
          teamCode: team.teamCode,
          paid: team.paymentStatus !== 'paid',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update that team');

      window.localStorage.setItem(PASSCODE_KEY, passcode);
      await load();
    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setBusyCode(null);
    }
  }

  if (error) return <main className="wrap"><div className="notice bad">{error}</div></main>;
  if (!teams) return <main className="wrap"><p className="muted">Loading...</p></main>;

  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <p className="eyebrow">Staff only &middot; not linked publicly</p>
      <h1>HQ</h1>
      <p className="lede">
        {teams.length} teams &middot;{' '}
        {teams.reduce((sum, team) => sum + team.claims.length, 0)} claims recorded
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Venmo</h2>
        {payments && (
          <p>
            <strong>{formatUsd(payments.collectedCents)}</strong> in &middot;{' '}
            <strong>{formatUsd(payments.outstandingCents)}</strong> outstanding across{' '}
            {payments.unpaidCount} team{payments.unpaidCount === 1 ? '' : 's'}
          </p>
        )}
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="passcode">HQ passcode</label>
          <input
            id="passcode"
            type="password"
            autoComplete="off"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Required to mark teams paid"
          />
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Matches <code>HQ_PASSCODE</code> on the server. Remembered on this device after
            the first successful update.
          </p>
        </div>
        {paymentError && (
          <div className="notice bad" style={{ marginTop: 14, marginBottom: 0 }}>
            {paymentError}
          </div>
        )}
      </div>

      {openInvites.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>
            Waiting on a teammate{' '}
            <span className="pill">{openInvites.length}</span>
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            These people signed up and invited someone who hasn&rsquo;t finished yet. There is no
            team and nothing owed until they do &mdash; worth a nudge.
          </p>
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Started by</th>
                <th>Waiting on</th>
                <th className="num">Sent</th>
              </tr>
            </thead>
            <tbody>
              {openInvites.map((invite) => (
                <tr key={invite.member_2_email}>
                  <td>{invite.team_name}</td>
                  <td className="muted">{invite.member_1_name}</td>
                  <td className="muted">{invite.member_2_email}</td>
                  <td className="num muted">
                    {new Date(invite.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {teams.map((team) => {
        const counts = countByCategory(team.claims);
        const paid = team.paymentStatus === 'paid';

        return (
          <div className="card" key={team.teamId}>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>
              {team.teamCode} &mdash; {team.teamName}{' '}
              <span className={`pill ${paid ? 'A' : 'B'}`}>
                {paid ? 'paid' : `owes ${formatUsd(team.amountDueCents)}`}
              </span>
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {team.members.join(' and ')} &middot; {team.email}
              {team.merch.length > 0 && (
                <>
                  {' '}&middot; merch:{' '}
                  {team.merch
                    .map((m) => {
                      const what = m.size ? `${m.item} (${m.size})` : m.item;
                      return m.person_name ? `${what} for ${m.person_name}` : what;
                    })
                    .join(', ')}
                </>
              )}
              {paid && team.paidAt && (
                <> &middot; paid {new Date(team.paidAt).toLocaleString()}</>
              )}
            </p>

            <p>
              <button
                type="button"
                className="secondary"
                style={{ width: 'auto' }}
                disabled={busyCode === team.teamCode}
                onClick={() => togglePaid(team)}
              >
                {busyCode === team.teamCode
                  ? 'Saving...'
                  : paid
                    ? 'Mark unpaid'
                    : `Mark ${formatUsd(team.amountDueCents)} received`}
              </button>
            </p>

            <p>
              <strong>{team.score} pts</strong> &middot; {team.claims.length} claims &middot;{' '}
              A{counts.A} B{counts.B} C{counts.C} D{counts.D}
              {counts.bonus > 0 && (
                <> &middot; <span className="pill bonus">{counts.bonus} bonus</span></>
              )}
            </p>

            {team.claims.length === 0 ? (
              <p className="muted">No claims.</p>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th className="num">#</th>
                      <th>Challenge</th>
                      <th>Type</th>
                      <th className="num">Pts</th>
                      <th className="num">Claimed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.claims.map((claim) => (
                      <tr key={claim.challengeId}>
                        <td className="num">{claim.challengeId}</td>
                        <td>{claim.name}</td>
                        <td><span className={`pill ${claim.category}`}>{claim.category}</span></td>
                        <td className="num">{claim.points}</td>
                        <td className="num muted">
                          {new Date(claim.claimedAt).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="thumbs" style={{ marginTop: 12 }}>
                  {team.claims
                    .filter((claim) => claim.photoUrl)
                    .map((claim) => (
                      <a
                        key={claim.challengeId}
                        href={claim.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={`#${claim.challengeId} ${claim.name}`}
                      >
                        {/* Short-lived signed storage URLs; next/image would
                            cache them past their expiry. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={claim.photoUrl} alt={`Proof for ${claim.name}`} />
                      </a>
                    ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </main>
  );
}

function countByCategory(claims) {
  const counts = { A: 0, B: 0, C: 0, D: 0, bonus: 0 };
  for (const claim of claims) {
    if (claim.category in counts) counts[claim.category] += 1;
  }
  return counts;
}
