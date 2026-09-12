import { supabaseAdmin } from '@/lib/supabaseAdmin';

const PHOTO_BUCKET = 'proof-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 4; // one hunt day of staff use

// Everything the sticker-matching table needs in one payload: teams, what each
// one claimed, and a viewable link per proof photo.
export default async function handler(req, res) {
  const [{ data: teams, error: teamsError }, { data: claims }, { data: merch }] =
    await Promise.all([
      supabaseAdmin
        .from('teams')
        .select('id, team_code, team_name, member_1_name, member_2_name, email, merch_order')
        .order('team_code'),
      supabaseAdmin
        .from('claims')
        .select('team_id, challenge_id, photo_url, claimed_at, challenges(name, category, points)')
        .order('claimed_at'),
      supabaseAdmin.from('merch_line_items').select('team_id, item, size'),
    ]);

  if (teamsError) {
    console.error('HQ load failed', teamsError);
    return res.status(500).json({ error: 'Could not load HQ data' });
  }

  const paths = (claims ?? []).map((c) => c.photo_url).filter(Boolean);
  const signedByPath = await signPhotoUrls(paths);

  const byTeam = new Map(
    (teams ?? []).map((t) => [
      t.id,
      {
        teamId: t.id,
        teamCode: t.team_code,
        teamName: t.team_name,
        members: [t.member_1_name, t.member_2_name],
        email: t.email,
        merch: (merch ?? []).filter((m) => m.team_id === t.id),
        claims: [],
        score: 0,
      },
    ])
  );

  for (const claim of claims ?? []) {
    const entry = byTeam.get(claim.team_id);
    if (!entry) continue;
    entry.claims.push({
      challengeId: claim.challenge_id,
      name: claim.challenges?.name,
      category: claim.challenges?.category,
      points: claim.challenges?.points ?? 0,
      claimedAt: claim.claimed_at,
      photoUrl: claim.photo_url ? signedByPath.get(claim.photo_url) ?? null : null,
    });
    entry.score += claim.challenges?.points ?? 0;
  }

  return res.status(200).json({ teams: [...byTeam.values()] });
}

async function signPhotoUrls(paths) {
  const signed = new Map();
  if (paths.length === 0) return signed;

  const { data, error } = await supabaseAdmin.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error('Could not sign proof photo URLs', error);
    return signed;
  }
  for (const entry of data ?? []) {
    if (entry.signedUrl) signed.set(entry.path, entry.signedUrl);
  }
  return signed;
}
