-- Harden exposed RPC wrappers without changing their public API.
-- The public wrappers remain callable where intended, but execute as invoker.
-- Privileged work stays inside the private SECURITY DEFINER implementations,
-- which validate auth.uid() and business ownership before performing the operation.

create or replace function public.get_or_create_marketplace_chat(p_product_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path='public','private','pg_temp'
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  return private.get_or_create_marketplace_chat(
    p_product_id,
    (select auth.uid())
  );
end;
$$;

create or replace function public.create_internal_invoice(p_order_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path='public','private','pg_temp'
as $$
declare
  v_order public.orders%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select *
  into v_order
  from public.orders
  where id=p_order_id
    and buyer_id=(select auth.uid());

  if not found then
    raise exception 'Order not found' using errcode='P0002';
  end if;

  return private.create_internal_invoice(p_order_id);
end;
$$;

revoke execute on function public.get_or_create_marketplace_chat(uuid) from anon, public;
grant execute on function public.get_or_create_marketplace_chat(uuid) to authenticated;

revoke execute on function public.create_internal_invoice(uuid) from anon, public;
grant execute on function public.create_internal_invoice(uuid) to authenticated;
