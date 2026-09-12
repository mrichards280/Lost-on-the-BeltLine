import test from 'node:test';
import assert from 'node:assert/strict';

import { generateTeamCode, normalizeTeamCode } from '../lib/teamCode.js';
import { describeGaps, isEligible, missingForEligibility } from '../lib/eligibility.js';

test('normalizeTeamCode accepts every way a player might type their code', () => {
  for (const input of ['BELT-07', 'belt-07', 'belt07', 'BELT 07', '07', '7', '  belt-7  ']) {
    assert.equal(normalizeTeamCode(input), 'BELT-07', `for input ${JSON.stringify(input)}`);
  }
  assert.equal(normalizeTeamCode('BELT-42'), 'BELT-42');
});

test('normalizeTeamCode is safe on junk input', () => {
  assert.equal(normalizeTeamCode(''), '');
  assert.equal(normalizeTeamCode(null), '');
  assert.equal(normalizeTeamCode(undefined), '');
  // Anything unrecognisable is passed through uppercased so the lookup simply
  // misses and the player is told the code is unknown.
  assert.equal(normalizeTeamCode('nonsense'), 'NONSENSE');
});

test('generateTeamCode stays inside the printable BELT-10..BELT-99 range', () => {
  const codes = Array.from({ length: 5000 }, generateTeamCode);
  assert.ok(codes.every((code) => /^BELT-\d{2}$/.test(code)));

  const numbers = codes.map((code) => Number(code.slice(5)));
  assert.equal(Math.min(...numbers), 10);
  assert.equal(Math.max(...numbers), 99);
});

test('eligibility needs two claims in every one of A, B, C and D', () => {
  const qualified = { a_count: 2, b_count: 2, c_count: 2, d_count: 2 };
  assert.equal(isEligible(qualified), true);
  assert.equal(isEligible({ ...qualified, c_count: 1 }), false);

  // A big score in three categories never substitutes for the fourth.
  assert.equal(isEligible({ a_count: 9, b_count: 9, c_count: 9, d_count: 1 }), false);
  assert.equal(isEligible(null), false);
});

test('bonus claims do not count toward eligibility', () => {
  const row = { a_count: 2, b_count: 2, c_count: 1, d_count: 2, bonus_count: 12, score: 500 };
  assert.equal(isEligible(row), false);
  assert.deepEqual(missingForEligibility(row), [{ category: 'C', needed: 1 }]);
});

test('describeGaps reads like a sentence a person would say', () => {
  assert.equal(
    describeGaps({ a_count: 2, b_count: 2, c_count: 2, d_count: 2 }),
    "You're qualified for the main prize."
  );
  assert.equal(
    describeGaps({ a_count: 2, b_count: 2, c_count: 1, d_count: 2 }),
    'You need 1 more Type C to qualify.'
  );
  assert.equal(
    describeGaps({ a_count: 2, b_count: 0, c_count: 1, d_count: 2 }),
    'You need 2 more Type B and 1 more Type C to qualify.'
  );
  assert.equal(
    describeGaps({ a_count: 0, b_count: 0, c_count: 0, d_count: 0 }),
    'You need 2 more Type A, 2 more Type B, 2 more Type C and 2 more Type D to qualify.'
  );
});
