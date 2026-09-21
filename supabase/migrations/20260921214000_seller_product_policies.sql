-- DEBA seller capabilities
-- Buyers can browse and purchase. Sellers can create, update and delete their own listings.
-- account_type is a product capability marker; it is stored in profiles, not JWT user metadata.

drop policy if exists products_insert_own on public.products;
drop policy if exists products_update_own on public.products;
drop policy if exists products_delete_own on public.products;

create policy products_insert_seller
on public.products
for insert
to authenticated
with check (
  (select private.is_admin())
  or (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type = 'seller'
    )
  )
);

create policy products_update_seller
on public.products
for update
to authenticated
using (
  (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type = 'seller'
    )
  )
  or (select private.is_admin())
)
with check (
  (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type = 'seller'
    )
  )
  or (select private.is_admin())
);

create policy products_delete_seller
on public.products
for delete
to authenticated
using (
  (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type = 'seller'
    )
  )
  or (select private.is_admin())
);
