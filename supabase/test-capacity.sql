-- Deployment checklist item 6, as SQL rather than two browser tabs.
--
-- Run each block in a SEPARATE psql session, in the order marked. Session B
-- should sit and wait at its insert until session A commits, then fail with
-- CHALLENGE_FULL — that blocking is the whole point of the `for update` lock.
-- If session B returns instantly with a success, the trigger is not installed.

-- === Setup (either session) ===================================================
insert into challenges (id, name, category, points, max_claims, page)
values (999001, 'TEST golden ticket', 'bonus', 50, 1, 'bonus')
on conflict (id) do update set max_claims = 1;
delete from claims where challenge_id = 999001;

-- === Session A, step 1 ========================================================
begin;
insert into claims (challenge_id, team_id)
values (999001, (select id from teams order by created_at limit 1));
-- ...now leave this transaction OPEN and switch to session B.

-- === Session B, step 2 (blocks here) ==========================================
begin;
insert into claims (challenge_id, team_id)
values (999001, (select id from teams order by created_at offset 1 limit 1));

-- === Session A, step 3 ========================================================
commit;
-- Session B now unblocks and raises: ERROR  CHALLENGE_FULL

-- === Cleanup ==================================================================
-- rollback;  -- in session B
-- delete from claims where challenge_id = 999001;
-- delete from challenges where id = 999001;
