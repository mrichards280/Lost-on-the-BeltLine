import { timingSafeEqual } from 'node:crypto';

// /hq is deliberately unauthenticated for reading (a 15-team friends event,
// unlinked from anywhere public). Marking a team paid is a different matter:
// it is a write, and an unauthenticated write endpoint is a standing invitation
// to anyone who guesses the URL. So writes require HQ_PASSCODE.
//
// This fails CLOSED. If HQ_PASSCODE is not set, marking teams paid does not
// work at all rather than working for everybody — the /hq page says so
// explicitly instead of failing silently on hunt day.
export function checkHqPasscode(req) {
  const expected = process.env.HQ_PASSCODE;

  if (!expected) {
    return {
      ok: false,
      status: 503,
      error:
        'HQ_PASSCODE is not set on the server, so payments cannot be marked here. ' +
        'Set it in the Netlify environment variables and redeploy.',
    };
  }

  const provided = req.headers['x-hq-passcode'];
  if (typeof provided !== 'string' || !equals(provided, expected)) {
    return { ok: false, status: 401, error: 'Wrong HQ passcode.' };
  }

  return { ok: true };
}

function equals(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
