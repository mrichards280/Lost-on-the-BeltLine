// A team qualifies for the main prize by covering the board, not by running up
// a score in one easy category: at least two claims in each of A, B, C and D.
// Bonus challenges add points but never count toward the minimums.
export const REQUIRED_PER_CATEGORY = 2;

export const CATEGORIES = ['A', 'B', 'C', 'D'];

export function isEligible(row) {
  if (!row) return false;
  return CATEGORIES.every((c) => categoryCount(row, c) >= REQUIRED_PER_CATEGORY);
}

export function categoryCount(row, category) {
  return row?.[`${category.toLowerCase()}_count`] ?? 0;
}

// The "you need 1 more Type C to qualify" nudge, as data.
export function missingForEligibility(row) {
  return CATEGORIES.map((category) => ({
    category,
    needed: Math.max(0, REQUIRED_PER_CATEGORY - categoryCount(row, category)),
  })).filter((gap) => gap.needed > 0);
}

export function describeGaps(row) {
  const gaps = missingForEligibility(row);
  if (gaps.length === 0) return "You're qualified for the main prize.";
  const parts = gaps.map(
    (g) => `${g.needed} more Type ${g.category}`
  );
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `You need ${list} to qualify.`;
}
