import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateTeamCode } from '@/lib/teamCode';
import { merchLineItems } from '@/lib/pricing';

// BELT-10..BELT-99 is 90 codes against a unique constraint, so a draw can
// collide — measured at roughly 1 in 5 under concurrent sign-ups. Retry rather
// than pre-checking: the check-then-write gap is a race.
const MAX_CODE_ATTEMPTS = 25;

/**
 * Insert a team, allocating a free code. Returns null when the email is
 * already registered (the caller re-reads the existing team instead).
 */
export async function insertTeamWithCode(teamRecord) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .insert({ ...teamRecord, team_code: generateTeamCode() })
      .select()
      .single();

    if (!error) return data;
    if (error.code !== '23505') throw error;
    // A duplicate email, not a duplicate code — the caller handles it.
    if (error.message?.includes('teams_email_key')) return null;
  }
  throw new Error('Could not allocate a free team code after 25 attempts');
}

// Merch rows are the packing list. A failure here must not fail the
// registration — the team exists and owes money either way, and HQ can
// reconstruct an order from merch_order on the team.
export async function insertMerch(teamId, people) {
  const rows = merchLineItems(teamId, people);
  if (rows.length === 0) return;

  const { error } = await supabaseAdmin.from('merch_line_items').insert(rows);
  if (error) console.error('merch line item insert failed', error);
}
