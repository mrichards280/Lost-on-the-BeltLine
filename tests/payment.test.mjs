import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ENTRY_PRICE_CENTS,
  HAT_PRICE_CENTS,
  PER_PERSON_CENTS,
  SHIRT_PRICE_CENTS,
  TEAM_SIZE,
  formatUsd,
  merchLineItems,
  priceRegistration,
  validateMerch,
} from '../lib/pricing.js';
import { venmoNote, venmoPaymentUrl } from '../lib/venmo.js';
import { normalizeTeamCode, generateTeamCode } from '../lib/teamCode.js';

test('the per-person price is the team price split, not a separate number', () => {
  assert.equal(PER_PERSON_CENTS * TEAM_SIZE, ENTRY_PRICE_CENTS);
  assert.equal(formatUsd(PER_PERSON_CENTS), '$25');
  assert.equal(formatUsd(ENTRY_PRICE_CENTS), '$50');
});

test('entry alone is the base price', () => {
  const { items, totalCents } = priceRegistration([]);
  assert.equal(totalCents, ENTRY_PRICE_CENTS);
  assert.equal(items.length, 1);
});

test('both teammates can order their own merch', () => {
  const { totalCents } = priceRegistration([
    { name: 'Makayla', merch: { shirt: true, shirtSize: 'L' } },
    { name: 'Devin', merch: { shirt: true, shirtSize: 'S', hat: true } },
  ]);
  assert.equal(
    totalCents,
    ENTRY_PRICE_CENTS + SHIRT_PRICE_CENTS * 2 + HAT_PRICE_CENTS
  );
});

test('merch lines name their owner, so a two-shirt team is not a guess', () => {
  const { items } = priceRegistration([
    { name: 'Makayla', merch: { shirt: true, shirtSize: 'L' } },
    { name: 'Devin', merch: { shirt: true, shirtSize: 'S' } },
  ]);
  assert.ok(items.some((i) => i.label === 'Shirt (L) — Makayla'));
  assert.ok(items.some((i) => i.label === 'Shirt (S) — Devin'));
});

test('an unnamed person still prices correctly', () => {
  // The invite flow prices member 1's merch before member 2 exists.
  const { items, totalCents } = priceRegistration([{ merch: { hat: true } }]);
  assert.equal(totalCents, ENTRY_PRICE_CENTS + HAT_PRICE_CENTS);
  assert.ok(items.some((i) => i.label === 'Hat'));
});

test('the itemised breakdown always sums to the total', () => {
  const cases = [
    [],
    [{ name: 'A', merch: { shirt: true, shirtSize: 'S' } }],
    [{ name: 'A', merch: { hat: true } }, { name: 'B', merch: {} }],
    [
      { name: 'A', merch: { shirt: true, shirtSize: 'XL', hat: true } },
      { name: 'B', merch: { shirt: true, shirtSize: '2XL', hat: true } },
    ],
  ];
  for (const people of cases) {
    const { items, totalCents } = priceRegistration(people);
    assert.equal(items.reduce((sum, i) => sum + i.cents, 0), totalCents);
  }
});

test('merchLineItems matches what was priced', () => {
  const people = [
    { name: 'Makayla', merch: { shirt: true, shirtSize: 'L' } },
    { name: 'Devin', merch: { hat: true } },
  ];
  const rows = merchLineItems('team-1', people);
  assert.deepEqual(rows, [
    { team_id: 'team-1', item: 'shirt', size: 'L', person_name: 'Makayla' },
    { team_id: 'team-1', item: 'hat', size: null, person_name: 'Devin' },
  ]);
  // One row per priced merch line, so the packing list can't drift from the bill.
  const { items } = priceRegistration(people);
  assert.equal(rows.length, items.length - 1);
});

test('a shirt without a size is rejected before it reaches the database', () => {
  assert.equal(validateMerch({ shirt: true, shirtSize: null }), 'Pick a shirt size');
  assert.equal(validateMerch({ shirt: true, shirtSize: 'XXXXL' }), 'Pick a shirt size');
  assert.equal(validateMerch({ shirt: true, shirtSize: 'L' }), null);
  assert.equal(validateMerch({ hat: true }), null);
  assert.equal(validateMerch(null), null);
});

test('formatUsd prints what someone types into Venmo', () => {
  assert.equal(formatUsd(5000), '$50');
  assert.equal(formatUsd(9400), '$94');
  assert.equal(formatUsd(0), '$0');
  assert.equal(formatUsd(1250), '$12.50');
});

test('the Venmo note leads with the team code so it survives truncation', () => {
  const note = venmoNote('BELT-07', 'The Krog Street Krew');
  assert.ok(note.startsWith('BELT-07'));
  assert.ok(note.includes('The Krog Street Krew'));
});

test('the Venmo link carries handle, amount and note', () => {
  const url = new URL(
    venmoPaymentUrl({ handle: '@makayla', amountCents: 9400, note: 'BELT-07 - Krew' })
  );
  assert.equal(url.origin + url.pathname, 'https://venmo.com/');
  assert.equal(url.searchParams.get('recipients'), 'makayla');
  assert.equal(url.searchParams.get('amount'), '94.00');
  assert.equal(url.searchParams.get('note'), 'BELT-07 - Krew');
});

test('no configured handle yields no link rather than a broken one', () => {
  assert.equal(venmoPaymentUrl({ handle: null, amountCents: 5000, note: 'x' }), null);
  assert.equal(venmoPaymentUrl({ handle: '', amountCents: 5000, note: 'x' }), null);
});

test('normalizeTeamCode accepts every way a player might type their code', () => {
  for (const input of ['BELT-07', 'belt-07', 'belt07', 'BELT 07', '07', '7', '  belt-7  ']) {
    assert.equal(normalizeTeamCode(input), 'BELT-07', `for ${JSON.stringify(input)}`);
  }
  assert.equal(normalizeTeamCode(''), '');
  assert.equal(normalizeTeamCode(null), '');
});

test('generateTeamCode stays inside the printable BELT-10..BELT-99 range', () => {
  const codes = Array.from({ length: 5000 }, generateTeamCode);
  assert.ok(codes.every((c) => /^BELT-\d{2}$/.test(c)));
  const nums = codes.map((c) => Number(c.slice(5)));
  assert.equal(Math.min(...nums), 10);
  assert.equal(Math.max(...nums), 99);
});
