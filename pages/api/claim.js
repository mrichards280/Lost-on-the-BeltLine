import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeTeamCode } from '@/lib/teamCode';

const PHOTO_BUCKET = 'proof-photos';

// The browser downscales photos to ~1600px JPEG before sending, so this is
// generous. Raw phone photos over cell service on hunt day are the thing this
// whole path is tuned to avoid.
export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teamCode, challengeId, photo } = req.body ?? {};
  const code = normalizeTeamCode(teamCode);
  const challenge_id = Number(challengeId);

  if (!code) return res.status(400).json({ status: 'error', error: 'Team code required' });
  if (!Number.isInteger(challenge_id)) {
    return res.status(400).json({ status: 'error', error: 'Pick a challenge' });
  }

  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id, team_name')
    .eq('team_code', code)
    .maybeSingle();

  if (!team) {
    return res.status(404).json({ status: 'unknown_team', error: `No team with code ${code}` });
  }

  const { data: challenge } = await supabaseAdmin
    .from('challenges')
    .select('id, name, points, max_claims')
    .eq('id', challenge_id)
    .maybeSingle();

  if (!challenge) {
    return res.status(404).json({ status: 'error', error: 'That challenge no longer exists' });
  }

  let photo_url = null;
  if (photo) {
    try {
      photo_url = await uploadProofPhoto(team.id, challenge_id, photo);
    } catch (err) {
      console.error('Proof photo upload failed', err);
      // A claim without its photo still beats losing the claim; HQ reconciles
      // against the handwritten passport at the end anyway.
      photo_url = null;
    }
  }

  const { error } = await supabaseAdmin.from('claims').insert({
    challenge_id,
    team_id: team.id,
    photo_url,
  });

  if (error) {
    // Raised by the enforce_claim_cap trigger, which holds a row lock on the
    // challenge — this is the authoritative answer, never a client-side count.
    if (error.message?.includes('CHALLENGE_FULL')) {
      return res.status(409).json({
        status: 'full',
        // A cap of 1 is a Golden Ticket somebody else got; a cap of 6-8 is a
        // business-protection cap that ran out. Different sentence for each.
        exclusive: challenge.max_claims === 1,
        challengeName: challenge.name,
      });
    }
    if (error.code === '23505') {
      return res.status(409).json({ status: 'already_done', challengeName: challenge.name });
    }
    console.error('Claim insert failed', error);
    return res.status(500).json({ status: 'error', error: 'Could not record that claim' });
  }

  return res.status(200).json({
    status: 'success',
    challengeName: challenge.name,
    points: challenge.points,
    teamName: team.team_name,
  });
}

async function uploadProofPhoto(teamId, challengeId, dataUrl) {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('Photo was not a base64 image data URL');

  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, 'base64');

  const { data, error } = await supabaseAdmin.storage
    .from(PHOTO_BUCKET)
    .upload(`${teamId}/${challengeId}.jpg`, buffer, {
      contentType,
      // A team retrying after a flaky upload should overwrite, not fail.
      upsert: true,
    });

  if (error) throw error;
  return data.path;
}
