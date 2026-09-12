import test from 'node:test';
import assert from 'node:assert/strict';

import { generateInviteToken, inviteUrl } from '../lib/invite.js';

test('invite tokens are long, random and URL-safe', () => {
  const token = generateInviteToken();
  // base64url of 32 bytes — no padding, nothing needing escaping in a query string.
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.ok(token.length >= 43, `token was only ${token.length} chars`);
  assert.equal(encodeURIComponent(token), token);
});

test('invite tokens do not repeat', () => {
  // The link is a capability URL: a collision would hand one team's
  // registration to another person.
  const tokens = new Set(Array.from({ length: 20000 }, generateInviteToken));
  assert.equal(tokens.size, 20000);
});

test('inviteUrl points at the join page and survives a trailing slash', () => {
  const previous = process.env.SITE_URL;
  try {
    process.env.SITE_URL = 'https://lostonthebeltline.com/';
    const url = new URL(inviteUrl('abc-123'));
    assert.equal(url.origin, 'https://lostonthebeltline.com');
    assert.equal(url.pathname, '/join');
    assert.equal(url.searchParams.get('token'), 'abc-123');
  } finally {
    if (previous === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previous;
  }
});

test('a token with URL-hostile characters round-trips intact', () => {
  const previous = process.env.SITE_URL;
  try {
    process.env.SITE_URL = 'https://example.com';
    const url = new URL(inviteUrl('a+b/c=d&e'));
    assert.equal(url.searchParams.get('token'), 'a+b/c=d&e');
  } finally {
    if (previous === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previous;
  }
});
