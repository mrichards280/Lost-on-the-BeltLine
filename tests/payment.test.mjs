import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ENTRY_PRICE_CENTS,
  HAT_PRICE_CENTS,
  SHIRT_PRICE_CENTS,
  formatUsd,
  priceRegistration,
  validateMerch,
} from '../lib/pricing.js';
import { venmoNote, venmoPaymentUrl } from '../lib/venmo.js';

test('entry alone is the base price', () => {
  const { items, totalCents } = priceRegistration(null);
  assert.equal(totalCents, ENTRY_PRICE_CENTS);
  assert.equal(items.length, 1);
});

test('merch stacks onto the entry fee', () => {
  assert.equal(
    priceRegistration({ shirt: true, shirtSize: 'L' }).totalCents,
    ENTRY_PRICE_CENTS + SHIRT_PRICE_CENTS
  );
  assert.equal(
    priceRegistration({ hat: true }).totalCents,
    ENTRY_PRICE_CENTS + HAT_PRICE_CENTS
  );
  assert.equal(
    priceRegistration({ shirt: true, shirtSize: 'M', hat: true }).totalCents,
    ENTRY_PRICE_CENTS + SHIRT_PRICE_CENTS + HAT_PRICE_CENTS
  );
});

test('the itemised breakdown always sums to the total', () => {
  for (const merch of [null, { shirt: true, shirtSize: 'S' }, { hat: true }, { shirt: true, shirtSize: 'XL', hat: true }]) {
    const { items, totalCents } = priceRegistration(merch);
    assert.equal(items.reduce((sum, item) => sum + item.cents, 0), totalCents);
  }
});

test('the shirt line names the size, so HQ can pack from it', () => {
  const { items } = priceRegistration({ shirt: true, shirtSize: '2XL' });
  assert.ok(items.some((item) => item.label === 'Shirt (2XL)'));
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
  assert.equal(formatUsd(7200), '$72');
  assert.equal(formatUsd(9700), '$97');
  assert.equal(formatUsd(0), '$0');
  // Not reachable with current prices, but must not print "$12.5".
  assert.equal(formatUsd(1250), '$12.50');
});

test('the Venmo note leads with the team code so it survives truncation', () => {
  const note = venmoNote('BELT-07', 'The Krog Street Krew');
  assert.ok(note.startsWith('BELT-07'));
  assert.ok(note.includes('The Krog Street Krew'));
});

test('the Venmo link carries handle, amount and note', () => {
  const url = new URL(
    venmoPaymentUrl({ handle: 'makayla', amountCents: 7200, note: 'BELT-07 - Krew' })
  );
  assert.equal(url.origin + url.pathname, 'https://venmo.com/');
  assert.equal(url.searchParams.get('txn'), 'pay');
  assert.equal(url.searchParams.get('recipients'), 'makayla');
  // Venmo expects decimal dollars, not cents.
  assert.equal(url.searchParams.get('amount'), '72.00');
  assert.equal(url.searchParams.get('note'), 'BELT-07 - Krew');
});

test('a handle typed with a leading @ still produces a valid link', () => {
  const url = new URL(
    venmoPaymentUrl({ handle: '@makayla', amountCents: 5000, note: 'x' })
  );
  assert.equal(url.searchParams.get('recipients'), 'makayla');
});

test('no configured handle yields no link rather than a broken one', () => {
  assert.equal(venmoPaymentUrl({ handle: null, amountCents: 5000, note: 'x' }), null);
  assert.equal(venmoPaymentUrl({ handle: '', amountCents: 5000, note: 'x' }), null);
});

test('a team name with URL-hostile characters is encoded, not mangled', () => {
  const note = venmoNote('BELT-12', 'Tom & Jerry / #1 Team');
  const url = new URL(venmoPaymentUrl({ handle: 'makayla', amountCents: 5000, note }));
  assert.equal(url.searchParams.get('note'), note);
});
