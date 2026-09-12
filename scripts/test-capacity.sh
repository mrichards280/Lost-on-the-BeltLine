#!/usr/bin/env bash
#
# Deployment checklist item 6, automated.
#
# Fires N concurrent inserts at one challenge and asserts that exactly
# max_claims of them land. This is the test that would catch the trigger being
# missing, or being written as a check-then-insert: both pass when you click
# through it by hand, and both fail here.
#
#   DATABASE_URL="postgresql://postgres:...@db.xxx.supabase.co:5432/postgres" \
#     ./scripts/test-capacity.sh
#
# Safe to run against a seeded database: it uses its own challenge ids in the
# 999xxx range and deletes only its own rows.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the Postgres connection string}"
CONCURRENCY="${CONCURRENCY:-20}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

q() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAc "$1"; }

teams=$(q "select count(*) from teams;")
if [ "$teams" -lt 2 ]; then
  echo "Need at least 2 teams in the database to race them. Found $teams." >&2
  exit 1
fi
if [ "$CONCURRENCY" -gt "$teams" ]; then
  CONCURRENCY="$teams"
fi

failures=0

race() { # $1 = challenge id, $2 = cap, $3 = label
  local id="$1" cap="$2" label="$3"

  q "insert into challenges (id, name, category, points, max_claims, page)
     values ($id, 'TEST $label', 'bonus', 1, $cap, 'bonus')
     on conflict (id) do update set max_claims = excluded.max_claims;" >/dev/null
  q "delete from claims where challenge_id = $id;" >/dev/null

  local n=0
  while read -r team_id; do
    n=$((n + 1))
    [ "$n" -gt "$CONCURRENCY" ] && break
    psql "$DATABASE_URL" -tAc \
      "insert into claims (challenge_id, team_id) values ($id, '$team_id');" \
      >"$TMP/$label-$n.out" 2>&1 &
  done < <(q "select id from teams order by team_code;")
  wait

  local landed rejected expected
  landed=$(q "select count(*) from claims where challenge_id = $id;")
  # An uncapped challenge rejects nobody, and grep exits 1 on no matches —
  # under `set -o pipefail` that would abort the script mid-test.
  rejected=$(grep -l CHALLENGE_FULL "$TMP/$label-"*.out 2>/dev/null | wc -l | tr -d ' ' || true)
  expected=$(( cap < CONCURRENCY ? cap : CONCURRENCY ))

  if [ "$landed" -eq "$expected" ]; then
    printf '  PASS  %-28s cap=%-4s %2s/%s landed, %s rejected\n' \
      "$label" "$cap" "$landed" "$CONCURRENCY" "$rejected"
  else
    printf '  FAIL  %-28s cap=%-4s expected %s, got %s\n' \
      "$label" "$cap" "$expected" "$landed"
    failures=$((failures + 1))
  fi

  q "delete from claims where challenge_id = $id;" >/dev/null
  q "delete from challenges where id = $id;" >/dev/null
}

echo "Racing $CONCURRENCY concurrent claims per challenge."
race 999001 1   "golden ticket"
race 999002 6   "capped type B"
race 999003 999 "open challenge"

echo
if [ "$failures" -eq 0 ]; then
  echo "Capacity enforcement holds under concurrency."
else
  echo "$failures capacity test(s) FAILED — do not run the event on this database." >&2
  exit 1
fi
