import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

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
        <div className="notice good">
          <strong>{myTeam.team.teamName}</strong> &mdash; {myTeam.standing.score} pts from{' '}
          {myTeam.standing.claim_count} challenge
          {myTeam.standing.claim_count === 1 ? '' : 's'}.
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th className="num">Claims</th>
              <th className="num">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.team_id}>
                <td>{row.team_name}</td>
                <td className="num">{row.claim_count}</td>
                <td className="num">
                  <strong>{row.score}</strong>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No claims yet. Somebody go first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted">
        Highest score wins. Play it however you like &mdash; chase the big-ticket stops or
        rack up the easy ones.
      </p>
      <p className="muted">
        <Link href="/">Front page</Link>
      </p>
    </main>
  );
}
