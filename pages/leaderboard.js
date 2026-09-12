import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { CATEGORIES, describeGaps, isEligible } from '@/lib/eligibility';

const STORAGE_KEY = 'beltline.teamCode';

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [live, setLive] = useState(false);
  const [myTeam, setMyTeam] = useState(null);

  const refetchLeaderboard = useCallback(async () => {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false });

    if (error) {
      console.error('Could not load leaderboard', error);
      return;
    }
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    refetchLeaderboard();

    // Any claim anywhere changes the board, so re-fetch the view rather than
    // trying to patch a row in place from the payload.
    const channel = supabase
      .channel('leaderboard-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'claims' },
        () => refetchLeaderboard()
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchLeaderboard]);

  // Same view, filtered to one team — the "you need 1 more Type C" nudge.
  useEffect(() => {
    const code = window.localStorage.getItem(STORAGE_KEY);
    if (!code) return;

    fetch(`/api/team?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMyTeam)
      .catch(() => setMyTeam(null));
  }, [rows.length]);

  return (
    <main className="wrap">
      <p className="eyebrow">Live standings</p>
      <h1>Leaderboard</h1>
      <p className={`live${live ? '' : ' off'}`}>
        <span className="dot" />
        {live ? 'Updating live' : 'Reconnecting...'}
      </p>

      {myTeam && (
        <div className={`notice ${isEligible(myTeam.standing) ? 'good' : 'warn'}`}>
          <strong>{myTeam.team.teamName}</strong> &mdash; {myTeam.standing.score} pts.{' '}
          {describeGaps(myTeam.standing)}
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Team</th>
              {CATEGORIES.map((category) => (
                <th key={category} className="num">
                  {category}
                </th>
              ))}
              <th className="num">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.team_id}
                className={isEligible(row) ? 'row-eligible' : undefined}
              >
                <td>
                  {row.team_name}
                  {isEligible(row) && (
                    <span className="muted"> &middot; qualified</span>
                  )}
                </td>
                {CATEGORIES.map((category) => (
                  <td key={category} className="num">
                    {row[`${category.toLowerCase()}_count`]}
                  </td>
                ))}
                <td className="num">
                  <strong>{row.score}</strong>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={CATEGORIES.length + 2} className="muted">
                  No claims yet. Somebody go first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted">
        Qualifying for the main prize takes at least two claims in each of A, B, C and D.
        Bonus points count toward score, not toward qualifying.
      </p>
      <p className="muted">
        <Link href="/">Front page</Link>
      </p>
    </main>
  );
}
