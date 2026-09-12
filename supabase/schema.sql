-- Old Fourth Ward scavenger hunt — full schema.
-- Run this once against a fresh Supabase project (SQL editor, or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Payment is Venmo, which means it happens outside this system entirely: there
-- is no webhook to tell us money arrived. So registration creates the team
-- immediately as 'unpaid', and the organizer settles it by eye against their
-- Venmo feed. amount_due_cents is frozen at registration so a later price
-- change never rewrites what someone was actually asked to pay.
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  team_code text unique not null,
  team_name text not null,
  member_1_name text not null,
  member_2_name text not null,
  email text not null,
  member_2_email text,
  merch_order jsonb,
  amount_due_cents int not null default 5000,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid')),
  paid_at timestamptz,
  payment_note text,
  created_at timestamptz default now()
);

-- One team per email address. Without a payment step there is nothing to slow
-- down a double-tapped submit button, and every accidental duplicate burns one
-- of only 90 team codes. Registration returns the existing code on conflict
-- instead of erroring, so a double submit is harmless.
create unique index if not exists teams_email_key on teams (lower(email));

-- One person can start a registration and send the rest to their teammate.
-- Nothing exists as a team until the teammate finishes it, so a half-filled
-- sign-up never becomes a team that owes money or holds a team code.
--
-- The token is a capability URL: whoever holds the link can complete this
-- registration, which is the point — the teammate has no account to log into.
create table if not exists pending_registrations (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  team_name text not null,
  member_1_name text not null,
  member_1_email text not null,
  member_2_email text not null,
  member_1_merch jsonb,
  team_id uuid references teams(id),
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- One live invite per person. A completed one stops blocking, so someone whose
-- teammate flaked can start again.
create unique index if not exists pending_registrations_open_email_key
  on pending_registrations (lower(member_1_email))
  where completed_at is null;

create table if not exists challenges (
  id serial primary key,
  name text not null,
  category text not null check (category in ('A','B','C','D','bonus')),
  points int not null,
  max_claims int not null default 999,
  page text not null check (page in ('ab','cd','bonus'))
);

create table if not exists claims (
  challenge_id int references challenges(id) not null,
  team_id uuid references teams(id) not null,
  photo_url text,
  claimed_at timestamptz default now(),
  primary key (challenge_id, team_id)
);

-- Merch is per person, not per team: both halves of a team can order, and a
-- shirt needs its wearer's size. person_name is what the check-in table reads
-- off, so a two-shirt team is not a guess.
create table if not exists merch_line_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) not null,
  item text not null check (item in ('shirt','hat')),
  size text,
  person_name text,
  created_at timestamptz default now()
);

-- The capacity trigger counts rows per challenge on every insert, and the
-- leaderboard joins claims -> challenges. The (challenge_id, team_id) primary
-- key already indexes challenge_id as its leading column; team_id needs its own.
create index if not exists claims_team_id_idx on claims (team_id);
create index if not exists merch_line_items_team_id_idx on merch_line_items (team_id);

-- ---------------------------------------------------------------------------
-- Exclusivity and capacity enforcement
-- ---------------------------------------------------------------------------
--
-- A "count the claims, then insert" check in application code loses the race
-- when two teams submit in the same second: both read the same count, both pass
-- the check, both insert. Enforce it in Postgres instead.
--
-- `for update` takes a row lock on the challenge for the rest of the
-- transaction, so a second concurrent insert blocks until the first one commits
-- and then re-counts against the committed row. Same trigger for a Golden
-- Ticket (max_claims = 1) and a capped Type B stop (max_claims = 6-8); the only
-- difference is the number in the column.

create or replace function enforce_claim_cap()
returns trigger as $$
declare
  cap int;
  current_count int;
begin
  select max_claims into cap
  from challenges
  where id = new.challenge_id
  for update;

  if cap is null then
    raise exception 'CHALLENGE_NOT_FOUND';
  end if;

  select count(*) into current_count
  from claims
  where challenge_id = new.challenge_id;

  if current_count >= cap then
    raise exception 'CHALLENGE_FULL';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists check_claim_cap on claims;
create trigger check_claim_cap
before insert on claims
for each row execute function enforce_claim_cap();

-- ---------------------------------------------------------------------------
-- Leaderboard
-- ---------------------------------------------------------------------------
--
-- Score is the whole ranking now. There is no eligibility gate, so a team is
-- free to earn points whichever way they like, and the board says only what
-- they scored and how many stops it took.
--
-- team_code is deliberately NOT selected here. The board is world-readable and
-- the code is the only credential a team has — anyone holding it can submit
-- claims as that team. A team reads its own row through /api/team instead.

create or replace view leaderboard as
select
  t.id as team_id,
  t.team_name,
  coalesce(sum(c.points), 0)::int as score,
  count(cl.challenge_id)::int as claim_count,
  max(cl.claimed_at) as last_claim_at
from teams t
left join claims cl on cl.team_id = t.id
left join challenges c on c.id = cl.challenge_id
group by t.id, t.team_name;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
--
-- Every write goes through an API route holding the service-role key, which
-- bypasses RLS. The browser only ever holds the anon key, and only needs to
-- read: the challenge list, and claims (so Realtime can push leaderboard
-- updates). Denying anon writes is what stops someone opening devtools and
-- inserting claims for their own team.

alter table teams enable row level security;
alter table challenges enable row level security;
alter table claims enable row level security;
alter table merch_line_items enable row level security;
alter table pending_registrations enable row level security;

drop policy if exists "challenges are public" on challenges;
create policy "challenges are public" on challenges for select to anon, authenticated using (true);

drop policy if exists "claims are public" on claims;
create policy "claims are public" on claims for select to anon, authenticated using (true);

-- teams, pending_registrations and merch_line_items get no policies at all:
-- RLS on with zero policies denies anon everything, which is what we want for
-- names, emails and invite tokens.

-- Supabase grants anon/authenticated table privileges by default, but say it
-- explicitly so the policies above are not silently load-bearing on a project
-- whose default privileges have been tightened. Select only, and only on the
-- two tables the browser actually reads.
grant select on challenges to anon, authenticated;
grant select on claims to anon, authenticated;
revoke insert, update, delete on challenges, claims from anon, authenticated;

-- The leaderboard view exposes only team names and aggregates — never emails,
-- and never team codes.
grant select on leaderboard to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
-- The leaderboard subscribes to inserts on claims and re-fetches on any change.

-- Re-running the schema must not fail on an already-published table.
do $$
begin
  alter publication supabase_realtime add table claims;
exception
  when duplicate_object then null;
end $$;
