-- The public invoice RPC validates the buyer before invoking the private builder.
create or replace function public.create_internal_invoice(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  v_order public.orders%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into v_order
  from public.orders
  where id=p_order_id
    and buyer_id=(select auth.uid());

  if not found then
    raise exception 'Order not found' using errcode='P0002';
  end if;

  return private.create_internal_invoice(p_order_id);
end;
$$;

revoke execute on function public.create_internal_invoice(uuid) from public,anon;
grant execute on function public.create_internal_invoice(uuid) to authenticated;
