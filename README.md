# Lost on the BeltLine

A two-person scavenger hunt through Atlanta's Old Fourth Ward: registration and
payment, three QR-coded passport pages, capped and exclusive challenges, and a
live leaderboard.

**Stack:** Next.js (Pages Router) · Supabase (Postgres, Realtime, Storage) ·
Stripe Checkout · Netlify.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # fill in Supabase and Stripe keys
npm run dev
```

Then, against your Supabase project:

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
psql "$DATABASE_URL" -f supabase/seed.sql    # placeholder challenges
```

```bash
npm test                # helper unit tests
npm run test:capacity   # concurrency test — needs DATABASE_URL
```

---

## How it fits together

| Path | What it is |
| --- | --- |
| `/` | Front page |
| `/register` | Team form → Stripe Checkout |
| `/registered` | Post-payment page; polls for the generated team code |
| `/submit?page=ab\|cd\|bonus` | **The QR landing page.** Challenge picker + photo |
| `/leaderboard` | Live standings over Supabase Realtime |
| `/hq` | Staff sticker-matching view — unlinked, see the warning below |
| `/interest.html` | Standalone Netlify Forms interest form (no backend) |

Three static QR codes, one per passport grid page, identical in every team's
passport. They encode only the page — never a team, never a challenge — so they
are generated and printed **once** and the challenge list can change up to hunt
morning without a reprint.

```bash
SITE_URL=https://your-site.com npm run qr   # writes public/qr/*.png and *.svg
```

---

## The part that matters: capacity enforcement

`max_claims` does the most work in the whole build:

| Value | Meaning |
| --- | --- |
| `1` | A true Golden Ticket — one team, once, genuine scarcity |
| `6`–`8` | A capped Type B stop — business-protection cap |
| `999` | A normal open Type A/C/D challenge |

A "count the claims, then insert" check in application code **loses the race**
when two teams submit in the same second: both read the same count, both pass,
both insert, and two teams hold the same Golden Ticket. So the cap is enforced
by a trigger that takes a row lock (`select ... for update`) on the challenge,
in `supabase/schema.sql`. A second concurrent insert blocks until the first
commits, then re-counts against committed state.

The application never pre-checks capacity. It attempts the insert and handles
the failure:

| Postgres result | Player sees |
| --- | --- |
| `CHALLENGE_FULL`, cap is 1 | "Another team got there first" |
| `CHALLENGE_FULL`, cap > 1 | "That one's full for today" |
| `23505` on `(challenge_id, team_id)` | "You already claimed that" |

That composite primary key is also what stops a team re-submitting the same
challenge for extra points.

### Verifying it

`npm run test:capacity` fires 20 concurrent inserts at one challenge and asserts
that exactly `max_claims` land. It is checked in as a negative-control test:
with the trigger dropped, a cap-1 Golden Ticket goes to all 20 teams and the
script exits non-zero.

```
Racing 20 concurrent claims per challenge.
  PASS  golden ticket                cap=1     1/20 landed, 19 rejected
  PASS  capped type B                cap=6     6/20 landed, 14 rejected
  PASS  open challenge               cap=999  20/20 landed, 0 rejected
```

Run it against the real database before the event.

---

## Security notes

Three deliberate decisions, none of them accidents:

**Team codes are credentials.** `BELT-07` is the only thing authenticating a
claim, so the public `leaderboard` view exposes team names and aggregates but
**not** `team_code` — publishing it would let anyone submit claims as any team.

**The browser never writes.** Every write goes through an API route holding the
service-role key. RLS is on for all four tables; the anon key gets `select` on
`challenges` and `claims` (Realtime needs it) and nothing else. `teams` and
`merch_line_items` have RLS on with zero policies, so names and emails are
unreachable from the browser.

**`/hq` is unauthenticated and unlinked.** That is a judgement call for a
15-team friends event, and it exposes registrant names, emails and photos to
anyone who guesses the URL. Before running this for a bigger event or a real
mailing list, put auth in front of it — Supabase Auth with an allowlist, or a
Netlify password on the route.

---

## Deployment checklist

1. **Supabase** — run `supabase/schema.sql`, then create a Storage bucket named
   `proof-photos` (private; `/hq` serves photos through short-lived signed URLs).
2. **Netlify** — set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`, and optionally
   `RESEND_API_KEY` / `TEAM_CODE_FROM_EMAIL`.
3. **Stripe** — add a webhook endpoint at `/api/stripe-webhook` subscribed to
   `checkout.session.completed`, and copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`. Locally: `stripe listen --forward-to
   localhost:3000/api/stripe-webhook`.
4. **Seed challenges** — load the finalized live list into `challenges`,
   including `max_claims` per item. `supabase/seed.sql` is a placeholder.
5. **Generate and print the QR codes** — `SITE_URL=... npm run qr`. Scan all
   three with a real phone before sending the passport to print.
6. **Test the capacity trigger** — `npm run test:capacity` against the real
   database. Do not run the event without this passing.
7. **Test one real registration** end to end in Stripe test mode and confirm the
   team code arrives by email.

### Notes for hunt day

- `RESEND_API_KEY` is optional. Without it, registration still succeeds and the
  team code is written to the function logs; codes are always readable from
  `/hq`. Don't let a missing email key block a sale.
- The team code is stored in `localStorage`, so a team switching phones mid-hunt
  just types it in again.
- Proof photos are downscaled to ~1600px in the browser before upload. Hunt day
  is a phone on cell service in a park.
- A claim whose photo upload fails is still recorded. Losing the claim would be
  worse than losing the photo, and HQ reconciles against the paper passport.
