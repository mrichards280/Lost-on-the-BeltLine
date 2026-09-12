import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeTeamCode } from '@/lib/teamCode';

// Resolve a team code into the team's own progress: score, per-category counts,
// and what they have already claimed. This is the "you need 1 more Type C"
// query — same leaderboard view as the public board, filtered to one team.
export default async function handler(req, res) {
  const code = normalizeTeamCode(req.query.code ?? req.body?.teamCode);
  if (!code) return res.status(400).json({ error: 'Team code required' });

  const { data: team, error } = await supabaseAdmin
    .from('teams')
    .select('id, team_code, team_name, member_1_name, member_2_name')
    .eq('team_code', code)
    .maybeSingle();

  if (error) {
    console.error('Team lookup failed', error);
    return res.status(500).json({ error: 'Lookup failed' });
  }
  if (!team) return res.status(404).json({ error: `No team with code ${code}` });

  const [{ data: standing }, { data: claims }] = await Promise.all([
    supabaseAdmin.from('leaderboard').select('*').eq('team_id', team.id).maybeSingle(),
    supabaseAdmin
      .from('claims')
      .select('challenge_id, claimed_at, challenges(name, category, points)')
      .eq('team_id', team.id)
      .order('claimed_at', { ascending: false }),
  ]);

  return res.status(200).json({
    team: {
      teamCode: team.team_code,
      teamName: team.team_name,
      members: [team.member_1_name, team.member_2_name],
    },
    standing: standing ?? { score: 0, a_count: 0, b_count: 0, c_count: 0, d_count: 0 },
    claims: (claims ?? []).map((row) => ({
      challengeId: row.challenge_id,
      claimedAt: row.claimed_at,
      name: row.challenges?.name,
      category: row.challenges?.category,
      points: row.challenges?.points,
    })),
  });
}
