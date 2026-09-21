-- DEBA: enforce structured listings for seller-owned listings
-- The UI is not the security boundary. Seller writes must use contract version 1,
-- while admin operations remain exempt.

create or replace function private.enforce_seller_product_contract()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  is_seller boolean := false;
  is_admin boolean := false;
begin
  is_admin := (select private.is_admin());

  if not is_admin and current_user_id is not null and new.owner_id = current_user_id then
    select exists (
      select 1
      from public.profiles p
      where p.id = current_user_id
        and p.account_type = 'seller'
    ) into is_seller;

    if is_seller then
      if new.details_schema_version <> 1 then
        raise exception 'SELLER_PRODUCT_DETAILS_CONTRACT_REQUIRED';
      end if;

      if new.status = 'published' then
        perform private.validate_product_for_publish(new.id);
        new.details_last_completed_at := now();
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_seller_product_contract on public.products;
create trigger trg_enforce_seller_product_contract
before insert or update on public.products
for each row
execute function private.enforce_seller_product_contract();
