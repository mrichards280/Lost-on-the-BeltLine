import test from 'node:test';
import assert from 'node:assert/strict';

import { checkHqPasscode } from '../lib/hqAuth.js';

const withPasscode = (value, fn) => {
  const previous = process.env.HQ_PASSCODE;
  if (value === undefined) delete process.env.HQ_PASSCODE;
  else process.env.HQ_PASSCODE = value;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.HQ_PASSCODE;
    else process.env.HQ_PASSCODE = previous;
  }
};

const req = (passcode) => ({
  headers: passcode === undefined ? {} : { 'x-hq-passcode': passcode },
});

test('an unset HQ_PASSCODE disables marking paid rather than allowing everyone', () => {
  withPasscode(undefined, () => {
    const result = checkHqPasscode(req('anything'));
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    // The failure has to name the fix — this surfaces on hunt day or never.
    assert.match(result.error, /HQ_PASSCODE/);
  });
});

test('the right passcode is accepted', () => {
  withPasscode('correct-horse-battery-staple', () => {
    assert.equal(checkHqPasscode(req('correct-horse-battery-staple')).ok, true);
  });
});

test('a wrong passcode is rejected with 401', () => {
  withPasscode('correct-horse-battery-staple', () => {
    const result = checkHqPasscode(req('wrong'));
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });
});

test('a missing header is rejected, not treated as an empty match', () => {
  withPasscode('secret', () => {
    assert.equal(checkHqPasscode(req(undefined)).ok, false);
    assert.equal(checkHqPasscode(req('')).ok, false);
  });
});

test('a prefix of the real passcode does not pass', () => {
  withPasscode('secretsecret', () => {
    assert.equal(checkHqPasscode(req('secret')).ok, false);
    assert.equal(checkHqPasscode(req('secretsecretsecret')).ok, false);
  });
});

test('non-string headers cannot slip past the comparison', () => {
  withPasscode('secret', () => {
    // An array header (a repeated x-hq-passcode) must not throw or pass.
    assert.equal(checkHqPasscode({ headers: { 'x-hq-passcode': ['secret'] } }).ok, false);
    assert.equal(checkHqPasscode({ headers: { 'x-hq-passcode': 1234 } }).ok, false);
  });
});

test('multibyte passcodes compare correctly rather than throwing', () => {
  withPasscode('pässwörd', () => {
    assert.equal(checkHqPasscode(req('pässwörd')).ok, true);
    assert.equal(checkHqPasscode(req('password')).ok, false);
  });
});
