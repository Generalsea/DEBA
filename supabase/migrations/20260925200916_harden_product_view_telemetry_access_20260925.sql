-- DEBA PHASE 2 / STEP 3 security follow-up
-- Keep product-view telemetry opaque: no direct table access, explicit deny
-- policies for exposed roles, and an index for the viewer_id foreign key.

begin;

create index if not exists product_views_viewer_id_idx
  on public.product_views (viewer_id);

drop policy if exists product_views_no_direct_select on public.product_views;
create policy product_views_no_direct_select
on public.product_views
for select
to anon, authenticated
using (false);

drop policy if exists product_views_no_direct_insert on public.product_views;
create policy product_views_no_direct_insert
on public.product_views
for insert
to anon, authenticated
with check (false);

drop policy if exists product_views_no_direct_update on public.product_views;
create policy product_views_no_direct_update
on public.product_views
for update
to anon, authenticated
using (false)
with check (false);

drop policy if exists product_views_no_direct_delete on public.product_views;
create policy product_views_no_direct_delete
on public.product_views
for delete
to anon, authenticated
using (false);

commit;
