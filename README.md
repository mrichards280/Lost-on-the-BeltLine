# Lost on the BeltLine

A two-person scavenger hunt through Atlanta's Old Fourth Ward: registration,
three QR-coded passport pages, capped and exclusive challenges, and a live
leaderboard.

**Stack:** Next.js (Pages Router) · Supabase (Postgres, Realtime, Storage) ·
Netlify. **Payment is Venmo**, settled by hand at HQ — there is no payment
processor in the loop.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # fill in Supabase keys, Venmo handle, HQ passcode
npm run dev
```

Then, against your Supabase project:

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
psql "$DATABASE_URL" -f supabase/seed.sql    # placeholder challenges
```

```bash
npm test                # 24 unit tests
npm run test:capacity   # concurrency test — needs DATABASE_URL
```

---

## How it fits together

| Path | What it is |
| --- | --- |
| `/` | Front page |
| `/register` | Team form → team code + Venmo instructions |
| `/submit?page=ab\|cd\|bonus` | **The QR landing page.** Challenge picker + photo |
| `/leaderboard` | Live standings over Supabase Realtime |
| `/hq` | Staff view: settle Venmo payments, match stickers. Unlinked — see below |
| `/interest.html` | Standalone Netlify Forms interest form (no backend) |

Three static QR codes, one per passport grid page, identical in every team's
passport. They encode only the page — never a team, never a challenge — so they
are generated and printed **once** and the challenge list can change up to hunt
morning without a reprint.

```bash
SITE_URL=https://your-site.com npm run qr   # writes public/qr/*.png and *.svg
```

---

## Payment: how Venmo changes the shape of this

With a payment processor, the webhook is what creates a team — money landing is
the signal, and the system can trust it. Venmo gives you no such signal, so
registration and payment are two separate events:

1. A team registers. The team record is created **immediately** as `unpaid`, and
   they get their team code on screen and by email right away.
2. The confirmation page shows the exact amount and a Venmo note that leads with
   the team code (`BELT-07 - The Krog Street Krew - Lost on the BeltLine`), so
   payments are matchable from your Venmo feed without asking anyone.
3. At check-in you open `/hq`, find the team, and hit **Mark received**. HQ shows
   a running total of collected vs. outstanding.

Consequences worth knowing up front:

- **A team code is issued before payment.** Nothing blocks an unpaid team from
  claiming challenges — for a 15-person friends event, being locked out because
  the organizer hasn't checked Venmo yet is worse than the alternative. `/hq`
  flags unpaid teams so check-in catches it.
- **`amount_due_cents` is frozen at registration.** Change shirt prices later and
  it never rewrites what someone was actually asked to pay.
- **One team per email address**, enforced by a unique index. Without a payment
  step there is nothing to slow down a double-tapped submit, and every duplicate
  burns one of only 90 team codes. A repeat registration returns the original
  code instead of erroring.
- **Your event plan budgets ~$26 in Stripe fees. That line is now $0**, which
  moves the projected net from roughly +$384–464 to **+$410–490**.

Prices live in `lib/pricing.js` — entry $50, shirt $22, hat $25. The form, the
stored amount, the Venmo link, the email and the HQ list all read from there, so
they cannot drift apart.

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

Four deliberate decisions, none of them accidents:

**Team codes are credentials.** `BELT-07` is the only thing authenticating a
claim, so the public `leaderboard` view exposes team names and aggregates but
**not** `team_code` — publishing it would let anyone submit claims as any team.

**The browser never writes.** Every write goes through an API route holding the
service-role key. RLS is on for all four tables; the anon key gets `select` on
`challenges` and `claims` (Realtime needs it) and nothing else. `teams` and
`merch_line_items` have RLS on with zero policies, so names, emails and payment
status are unreachable from the browser.

**Marking a team paid requires `HQ_PASSCODE`.** Reading `/hq` is unauthenticated
(see below), but a *write* endpoint on an unlinked page is a different risk — a
guessed URL should not let someone mark every team paid. The check **fails
closed**: if `HQ_PASSCODE` is unset, marking paid is disabled entirely rather
than open to everyone, and `/hq` says so on screen. Set it before hunt day.

**`/hq` is unauthenticated for reading and unlinked.** That is a judgement call
for a 15-team friends event, and it exposes registrant names, emails, payment
status and photos to anyone who guesses the URL. Before running this for a
bigger event or a real mailing list, put auth in front of it — Supabase Auth
with an allowlist, or a Netlify password on the route.

---

## Deployment checklist

1. **Supabase** — run `supabase/schema.sql`, then create a Storage bucket named
   `proof-photos` (private; `/hq` serves photos through short-lived signed URLs).
2. **Netlify environment variables** — `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_VENMO_HANDLE`, `HQ_PASSCODE`, `SITE_URL`, and optionally
   `RESEND_API_KEY` / `TEAM_CODE_FROM_EMAIL`.
3. **Check the Venmo handoff on a real phone** — register a throwaway team, tap
   **Open Venmo**, and confirm it opens to the right person. Prefilled links
   degrade quietly across app versions, which is why the handle, amount and note
   are always printed as plain text next to the button.
4. **Seed challenges** — load the finalized live list into `challenges`,
   including `max_claims` per item. `supabase/seed.sql` is a placeholder.
5. **Generate and print the QR codes** — `SITE_URL=... npm run qr`. Scan all
   three with a real phone before sending the passport to print.
6. **Test the capacity trigger** — `npm run test:capacity` against the real
   database. Do not run the event without this passing.
7. **Confirm the HQ passcode works** before hunt day — open `/hq`, mark a test
   team paid, then mark it unpaid again.

### Notes for hunt day

- **Keep `/hq` open at check-in.** It is the only place payment gets recorded,
  and the outstanding total at the top is your "who still owes me" list.
- The passcode is remembered per device after the first successful update, so
  you type it once.
- `RESEND_API_KEY` is optional. Without it, registration still succeeds and the
  team code is written to the function logs; codes are always readable from
  `/hq`. Don't let a missing email key block a registration.
- The team code is stored in `localStorage`, so a team switching phones mid-hunt
  just types it in again.
- Proof photos are downscaled to ~1600px in the browser before upload. Hunt day
  is a phone on cell service in a park.
- A claim whose photo upload fails is still recorded. Losing the claim would be
  worse than losing the photo, and HQ reconciles against the paper passport.

### Not built (from the event plan)

The plan also calls for collecting **phone numbers, emergency contacts and a
signed waiver** at registration. Those are not in this schema — the plan
recommends a dedicated e-signature tool (Smartwaiver/WaiverForever) rather than
a DIY checkbox, and that is still the right call. Run it as a follow-up form
after registration and keep those records out of this database.
