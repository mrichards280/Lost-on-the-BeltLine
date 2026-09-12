import { randomBytes } from 'node:crypto';

// The invite link is a capability URL: whoever opens it can finish the
// registration. That is deliberate — the teammate has no account to sign into
// and should not need one — so the token has to be long enough that it cannot
// be guessed or walked. 32 bytes of CSPRNG output, not a UUID or a timestamp.
export function generateInviteToken() {
  return randomBytes(32).toString('base64url');
}

export function inviteUrl(token) {
  const base = (process.env.SITE_URL ?? '').replace(/\/$/, '');
  return `${base}/join?token=${encodeURIComponent(token)}`;
}
