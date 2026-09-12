import { useEffect, useState } from 'react';
import { isEligible } from '@/lib/eligibility';

// Staff view for the sticker-matching pass at the end of the day: every team,
// what the database says they claimed, and the proof photo for each one, so a
// passport's handwritten numbers can be checked against reality.
//
// Unauthenticated by design for a 15-team friends event — it is simply not
// linked from anywhere public. See the README before pointing this at a bigger
// event or a real email list.
export default function HQ() {
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/hq')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load HQ data'))))
      .then((data) => setTeams(data.teams))
      .catch((err) => setError(err.message));
  }, []);

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

      {teams.map((team) => {
        const counts = countByCategory(team.claims);
        return (
          <div className="card" key={team.teamId}>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>
              {team.teamCode} &mdash; {team.teamName}
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {team.members.join(' and ')} &middot; {team.email}
              {team.merch.length > 0 && (
                <>
                  {' '}&middot; merch:{' '}
                  {team.merch.map((m) => (m.size ? `${m.item} (${m.size})` : m.item)).join(', ')}
                </>
              )}
            </p>

            <p>
              <strong>{team.score} pts</strong> &middot; {team.claims.length} claims &middot;{' '}
              A{counts.A} B{counts.B} C{counts.C} D{counts.D}
              {counts.bonus > 0 && ` bonus${counts.bonus}`}{' '}
              {isEligible({
                a_count: counts.A,
                b_count: counts.B,
                c_count: counts.C,
                d_count: counts.D,
              }) ? (
                <span className="pill A">qualified</span>
              ) : (
                <span className="pill">not qualified</span>
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
