-- DEBA Phase 4.3 — handshake cryptographic hardening
-- Do not mark an order funded merely because a delivery code was generated.
-- Funding remains an explicit payment-state transition.

create or replace function public.generate_trade_handshake_code(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_bytes bytea;
  v_code text;
  v_expires timestamptz;
  v_number bigint;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode='42501';
  end if;

  select *
    into v_order
  from public.orders
  where id = p_order_id
    and buyer_id = v_uid
  for update;

  if not found then
    raise exception 'Order not found' using errcode='P0002';
  end if;

  if v_order.status in ('cancelled','refunded') then
    raise exception 'Order cannot use trade handshake';
  end if;

  v_bytes := extensions.gen_random_bytes(3);
  v_number :=
      (get_byte(v_bytes,0)::bigint << 16)
    + (get_byte(v_bytes,1)::bigint << 8)
    + get_byte(v_bytes,2)::bigint;
  v_code := lpad(mod(v_number,1000000)::text,6,'0');
  v_expires := now() + interval '24 hours';

  insert into private.order_trade_handshakes(
    order_id,buyer_id,code_hash,expires_at,verified_at,attempts,updated_at
  )
  values(
    p_order_id,
    v_uid,
    extensions.digest(convert_to(v_code,'UTF8'),'sha256'),
    v_expires,
    null,
    0,
    now()
  )
  on conflict(order_id) do update
    set buyer_id=excluded.buyer_id,
        code_hash=excluded.code_hash,
        expires_at=excluded.expires_at,
        verified_at=null,
        attempts=0,
        updated_at=now();

  update public.orders
  set trade_handshake_required=true,
      updated_at=now()
  where id=p_order_id;

  return jsonb_build_object(
    'orderId',p_order_id,
    'code',v_code,
    'expiresAt',v_expires
  );
end;
$function$;

revoke execute on function public.generate_trade_handshake_code(uuid) from public,anon;
grant execute on function public.generate_trade_handshake_code(uuid) to authenticated;
