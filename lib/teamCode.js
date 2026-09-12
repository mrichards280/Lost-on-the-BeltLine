// Team codes are said out loud at check-in and typed on a phone with one hand,
// so they are short and unambiguous: BELT-10 through BELT-99.
//
// That is a 90-code space. At 15 teams a birthday collision is likelier than
// not (~72%), so generation must retry against the unique constraint on
// teams.team_code rather than trusting one random draw.
export const TEAM_CODE_PREFIX = 'BELT';

export function generateTeamCode() {
  return `${TEAM_CODE_PREFIX}-${Math.floor(Math.random() * 90) + 10}`;
}

export function normalizeTeamCode(input) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, '');
  // Accept "07", "belt07", "BELT-7" — they all mean the same thing to a player.
  const digits = trimmed.replace(/^BELT-?/, '');
  if (!/^\d{1,2}$/.test(digits)) return trimmed;
  return `${TEAM_CODE_PREFIX}-${digits.padStart(2, '0')}`;
}
