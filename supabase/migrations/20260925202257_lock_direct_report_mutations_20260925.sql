-- DEBA PHASE 2 / STEP 4 security follow-up
-- Report state changes are mediated by the guarded moderation RPC.
-- Public/authenticated roles must not mutate report rows directly.

begin;

revoke update, delete on public.reports from anon, authenticated;

commit;
