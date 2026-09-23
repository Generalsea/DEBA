-- Enforce paid payment before an order can be completed.
-- This guard applies both to the lifecycle RPC and to direct database writes.

create or replace function private.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'completed' and new.payment_status <> 'paid' then
      raise exception 'Paid payment is required before order completion'
        using errcode = '42501';
    end if;

    if not (
      (old.status = 'pending' and new.status in ('confirmed','cancelled'))
      or (old.status = 'confirmed' and new.status in ('processing','cancelled','disputed'))
      or (old.status = 'processing' and new.status in ('ready','cancelled','disputed'))
      or (old.status = 'ready' and new.status in ('completed','disputed'))
      or (old.status = 'completed' and new.status in ('refunded','disputed'))
      or (old.status = 'disputed' and new.status in ('completed','refunded','cancelled'))
    ) then
      raise exception 'Invalid order status transition: % -> %', old.status, new.status;
    end if;

    new.version := old.version + 1;
    if new.status = 'confirmed' then new.confirmed_at := now(); end if;
    if new.status = 'completed' then new.completed_at := now(); end if;
    if new.status = 'cancelled' then new.cancelled_at := now(); end if;
  end if;

  return new;
end;
$$;

create or replace function private.transition_order_status(
  p_order_id uuid,
  p_new_status text,
  p_actor_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.order_status_history%rowtype;
  v_is_admin boolean;
  v_item record;
begin
  if p_actor_id is null or p_actor_id <> (select auth.uid()) then
    raise exception 'Authenticated actor is required' using errcode='42501';
  end if;

  if p_idempotency_key is null
     or length(trim(p_idempotency_key)) < 16
     or length(trim(p_idempotency_key)) > 128 then
    raise exception 'Valid idempotency key is required' using errcode='22023';
  end if;

  select *
  into v_existing
  from public.order_status_history
  where order_id=p_order_id
    and idempotency_key=trim(p_idempotency_key)
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'order_id',p_order_id,
      'status',v_existing.to_status,
      'idempotent',true
    );
  end if;

  select *
  into v_order
  from public.orders
  where id=p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode='P0002';
  end if;

  v_is_admin:=(select private.is_admin());

  if not v_is_admin
     and p_actor_id<>v_order.buyer_id
     and p_actor_id<>v_order.seller_id then
    raise exception 'Not allowed to update this order' using errcode='42501';
  end if;

  if p_new_status='completed' and v_order.payment_status <> 'paid' then
    raise exception 'Paid payment is required before order completion'
      using errcode='42501';
  end if;

  if p_new_status='cancelled'
     and v_order.payment_status in ('paid','partially_refunded') then
    raise exception 'Paid orders require a refund workflow before cancellation'
      using errcode='42501';
  end if;

  if not v_is_admin then
    if p_actor_id=v_order.seller_id then
      if not (
        (v_order.status='pending' and p_new_status='confirmed')
        or (v_order.status='confirmed' and p_new_status='processing')
        or (v_order.status='processing' and p_new_status='ready')
      ) then
        raise exception 'Seller cannot make this status transition' using errcode='42501';
      end if;
    else
      if p_new_status='completed'
         and v_order.delivery_method<>'pickup'
         and v_order.fulfillment_status<>'delivered' then
        raise exception 'Delivery orders can only be completed after delivery' using errcode='42501';
      end if;

      if not (
        (v_order.status='pending' and p_new_status='cancelled')
        or (v_order.status='ready' and p_new_status='completed')
      ) then
        raise exception 'Buyer cannot make this status transition' using errcode='42501';
      end if;
    end if;
  end if;

  perform set_config(
    'deba.order_status_idempotency_key',
    trim(p_idempotency_key),
    true
  );
  perform set_config('deba.internal_operation','order_create',true);

  if p_new_status='cancelled' and v_order.status<>'cancelled' then
    for v_item in
      select product_id,sum(quantity)::integer as quantity
      from public.order_items
      where order_id=v_order.id
      group by product_id
    loop
      update public.products
      set quantity=quantity+v_item.quantity,
          status='published'
      where id=v_item.product_id;
    end loop;
  end if;

  if p_new_status='completed' then
    for v_item in
      select distinct product_id
      from public.order_items
      where order_id=v_order.id
    loop
      update public.products
      set status=case when quantity=0 then 'sold' else status end,
          sold_at=case when quantity=0 then coalesce(sold_at,now()) else sold_at end
      where id=v_item.product_id;
    end loop;
  end if;

  update public.orders
  set status=p_new_status,
      status_reason=nullif(trim(coalesce(p_reason,'')),'')
  where id=p_order_id;

  insert into public.audit_logs(
    actor_id,action,entity_type,entity_id,before_data,after_data,metadata
  )
  values(
    p_actor_id,
    'order.status_changed',
    'order',
    p_order_id,
    jsonb_build_object(
      'status',v_order.status,
      'payment_status',v_order.payment_status
    ),
    jsonb_build_object(
      'status',p_new_status,
      'payment_status',v_order.payment_status
    ),
    jsonb_build_object('reason',nullif(trim(coalesce(p_reason,'')),''))
  );

  insert into public.notifications(
    user_id,type,title,body,href,metadata
  )
  values(
    case
      when p_actor_id=v_order.buyer_id then v_order.seller_id
      else v_order.buyer_id
    end,
    'order.updated',
    'تحديث حالة الطلب',
    'تم تحديث حالة أحد طلبات DEBA.',
    '/orders/' || p_order_id,
    jsonb_build_object(
      'order_id',p_order_id,
      'status',p_new_status
    )
  );

  return jsonb_build_object(
    'order_id',p_order_id,
    'status',p_new_status,
    'idempotent',false
  );
end;
$$;
