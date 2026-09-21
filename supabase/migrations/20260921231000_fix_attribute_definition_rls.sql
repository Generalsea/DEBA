-- DEBA: remove overlapping RLS policy on category attribute definitions
-- Public read remains one policy; admin writes are split by command to avoid
-- multiple permissive SELECT policies.

drop policy if exists category_attribute_definitions_admin_write on public.category_attribute_definitions;

create policy category_attribute_definitions_admin_insert
on public.category_attribute_definitions
for insert to authenticated
with check ((select private.is_admin()));

create policy category_attribute_definitions_admin_update
on public.category_attribute_definitions
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy category_attribute_definitions_admin_delete
on public.category_attribute_definitions
for delete to authenticated
using ((select private.is_admin()));
