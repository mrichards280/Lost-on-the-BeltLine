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
| `/register` | Team form → team code + Venmo instructions. Both people, or one plus an invite |
| `/join?token=…` | Where an invited teammate adds their half and the team is created |
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

## Design system

Modern passport, femme, pastel ATL, glass, college party.

The hinge: **a real passport data page is already a glass object** — laminated,
holographic, printed with mono data fields and a machine-readable strip. So the
"passport" and "glass" halves of the brief are the same material, and the pastel
Atlanta sunset is what's shining through it.

| | |
| --- | --- |
| **Ground** | Peach `#ffd0bd` · blush `#ffc0dc` · lavender `#d8ccff` · mint `#c9f0e0`, as four radial glows |
| **Ink** | Deep plum `#2b1b3d`, never black |
| **Pop** | `#e0457b` — the one loud thing, on primary buttons only |
| **Display** | Syne 800 |
| **UI / body** | Outfit |
| **Data** | DM Mono |

Two rules keep it coherent, and both are worth preserving if you extend it:

- **Mono means data.** A number, a code, or a field label is DM Mono. That single
  rule is what makes it read as a document rather than a pretty gradient.
- **The hologram is rationed.** Only three things shimmer — the seal, the team
  code, and Golden Ticket chips. Everything genuinely scarce, nothing decorative.

Everything is token-driven in `styles/globals.css`, with a full dark palette
(plum, magenta, teal — the party after dark) that follows the phone's own
setting. `public/interest.html` and `public/interest-thanks.html` are standalone
by necessity — Netlify Forms detects them at build time with no framework — so
they carry a copy of the tokens. **Keep the two in step when either moves.**

The gradient is painted on a fixed pseudo-element rather than with
`background-attachment: fixed`, which iOS Safari mishandles. This site lives on
phones.

---

## Registering and paying

**Price is $25 a head, charged as one $50 team payment.** `lib/pricing.js` holds
both numbers and derives the per-person figure from the team price, so they
cannot drift apart. Merch is per person — each half of a team picks their own,
and a shirt carries its wearer's name into the packing list at `/hq`.

### Two ways in

**Both people present** — the usual form. The team is created immediately.

**One person, then an invite** — someone signs themselves up and enters their
teammate's email. That creates a row in `pending_registrations` and **nothing
else**: no team, no team code, no amount owed. The teammate gets an emailed link
to `/join?token=…`, adds their name and picks their own merch, and *that* is
when the team comes into existence. Both people then get the code.

A few consequences worth knowing:

- **A half-finished sign-up never becomes a team.** If the teammate never
  follows through, there is no team holding a code and no phantom debt. `/hq`
  lists these under "Waiting on a teammate" so you can chase them.
- **The invite link is a capability URL** — whoever holds it can complete that
  registration. That is deliberate; the teammate has no account to sign into.
  The token is 32 bytes of CSPRNG output, not a UUID or anything guessable.
- **One open invite per person**, enforced by a partial unique index. Submitting
  twice resends the same link rather than forking the registration. Completing
  one frees you to start another, so a flaked-on teammate isn't a dead end.
- **A failed invite email is reported, not swallowed.** Unlike the team code
  email — where the code is already on screen — the invite *is* the
  registration, so if it can't send, the page says so and hands you the link.

### Paying

Venmo gives no confirmation signal, so registration and payment are two separate
events. A team is created `unpaid`, the confirmation screen shows the amount and
a Venmo note leading with the team code (`BELT-07 - The Krog Street Krew - …`) so
payments are matchable from your feed, and you mark it received at `/hq`.

- **A team code is issued before payment.** Nothing blocks an unpaid team from
  claiming — being locked out because the organizer hasn't checked Venmo yet is
  worse. `/hq` flags unpaid teams so check-in catches it.
- **`amount_due_cents` is frozen at registration**, so a later price change never
  rewrites what someone was actually asked to pay.
- **One team per email address.** Without a payment step nothing slows down a
  double-tapped submit, and every duplicate burns one of only 90 team codes. A
  repeat registration returns the original code instead of erroring.
- **Your event plan budgets ~$26 in Stripe fees. That line is now $0**, moving
  the projected net from roughly +$384–464 to **+$410–490**.

### Saying what the fee doesn't cover

Entry buys the hunt. The coffee, the flight, the cookie a team decorates — those
come out of their own pocket, and your plan puts realistic hunt spend at **$25–40
a head**. Discovering that one stop at a time is how a $50 event starts feeling
like a $120 one, so it is stated on the front page, on the registration form, on
the join page, in the invite email and in the team code email. One component
(`components/CostNote.jsx`) and one constant pair, so the number can't drift.

---

## Scoring

**Highest score wins. There is no eligibility gate** — a team can chase Golden
Tickets, grind the easy stops, or anything in between, and it all counts the
same. The two-per-category rule from the event plan is deliberately not
implemented.

If you ever want it back, it was: at least two claims in each of A, B, C and D
before a team's score counts toward the overall prize, with the gap surfaced
live ("you need 1 more Type C"). It would need per-category counts back in the
`leaderboard` view plus a check wherever standings are shown.

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
8. **Send yourself an invite** — register with "just me for now", open the
   emailed link, and finish it. This is the one flow that spans two people, two
   emails and two devices, so it is worth walking end to end once.

### Notes for hunt day

- **Keep `/hq` open at check-in.** It is the only place payment gets recorded,
  and the outstanding total at the top is your "who still owes me" list.
- The passcode is remembered per device after the first successful update, so
  you type it once.
- `RESEND_API_KEY` is optional **only for the team code**, which is written to
  the function logs and always readable from `/hq`. It is **required for the
  invite flow** — without it, "just me for now" can't reach anyone, and the
  registration route says so rather than failing silently.
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
