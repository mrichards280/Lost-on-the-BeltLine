import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkHqPasscode } from '@/lib/hqAuth';
import { normalizeTeamCode } from '@/lib/teamCode';

// Settling a Venmo payment by hand: the organizer looks at their Venmo feed,
// finds the note carrying the team code, and flips the team to paid.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = checkHqPasscode(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { teamCode, paid, note } = req.body ?? {};
  const code = normalizeTeamCode(teamCode);
  if (!code) return res.status(400).json({ error: 'Team code required' });

  const markPaid = paid !== false;

  const { data, error } = await supabaseAdmin
    .from('teams')
    .update({
      payment_status: markPaid ? 'paid' : 'unpaid',
      // Clearing paid_at on an un-mark keeps the two columns from disagreeing
      // if someone marks the wrong team and backs it out.
      paid_at: markPaid ? new Date().toISOString() : null,
      payment_note: typeof note === 'string' && note.trim() !== '' ? note.trim() : null,
    })
    .eq('team_code', code)
    .select('team_code, team_name, payment_status, paid_at, payment_note')
    .maybeSingle();

  if (error) {
    console.error('mark-paid failed', error);
    return res.status(500).json({ error: 'Could not update that team' });
  }
  if (!data) return res.status(404).json({ error: `No team with code ${code}` });

  return res.status(200).json({ team: data });
}
