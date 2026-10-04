-- DEBA Phase 4.3 — negotiated order reservation lifecycle bridge
-- The smart-offer order path must use the same internal lifecycle controls as
-- the existing checkout/order RPCs before mutating stock and creating the order.
-- The setting is transaction-local and never exposed to application clients.

create or replace function private.create_escrow_order_from_offer(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_offer public.offers%rowtype;
  v_existing public.orders%rowtype;
  v_product public.products%rowtype;
  v_order public.orders%rowtype;
  v_idempotency_key text;
begin
  select *
    into v_offer
  from public.offers
  where id=p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found' using errcode='P0002';
  end if;

  if v_offer.status <> 'accepted' then
    raise exception 'Offer must be accepted before escrow order creation' using errcode='42501';
  end if;

  select *
    into v_existing
  from public.orders
  where source_offer_id=v_offer.id
  limit 1;

  if found then
    return jsonb_build_object(
      'order_id',v_existing.id,
      'existing',true,
      'status',v_existing.status
    );
  end if;

  select *
    into v_product
  from public.products
  where id=v_offer.product_id
    and status='published'
    and moderation_status='approved'
    and listing_type='sale'
    and owner_id=v_offer.seller_id
    and quantity>0
    and price>0
  for update;

  if not found then
    raise exception 'Product unavailable for escrow order' using errcode='P0002';
  end if;

  -- Match the existing DEBA order/product lifecycle contract. Both flags are
  -- transaction-local and are required because this path can execute while
  -- auth.uid() is either the buyer (trigger path) or seller (manual RPC path).
  perform set_config('deba.internal_operation','order_create',true);
  perform set_config('deba.lifecycle_override','1',true);

  update public.products
  set quantity=quantity-1,
      status=case when quantity-1=0 then 'reserved' else 'published' end,
      updated_at=now()
  where id=v_product.id
    and quantity>0
    and status='published';

  if not found then
    raise exception 'Stock changed during smart offer acceptance' using errcode='P0003';
  end if;

  v_idempotency_key='smart-offer-' || replace(v_offer.id::text,'-','');

  insert into public.orders(
    buyer_id,
    seller_id,
    product_id,
    offer_id,
    source_offer_id,
    status,
    payment_status,
    fulfillment_status,
    subtotal,
    shipping_fee,
    platform_fee,
    total,
    currency,
    delivery_method,
    delivery_address_snapshot,
    notes,
    status_reason,
    escrow_status,
    trade_handshake_required,
    idempotency_key
  )
  values(
    v_offer.buyer_id,
    v_offer.seller_id,
    v_offer.product_id,
    null,
    v_offer.id,
    'pending',
    'unpaid',
    'pending',
    v_offer.amount,
    0,
    0,
    v_offer.amount,
    coalesce(v_offer.currency,v_product.currency,'EGP'),
    case
      when v_product.delivery_method='both' then 'pickup'
      else v_product.delivery_method
    end,
    '{}'::jsonb,
    null,
    'Smart offer accepted — awaiting payment and handoff',
    'pending_funding',
    true,
    v_idempotency_key
  )
  returning * into v_order;

  insert into public.order_items(
    order_id,
    product_id,
    seller_id,
    quantity,
    unit_price,
    line_total
  )
  values(
    v_order.id,
    v_product.id,
    v_product.owner_id,
    1,
    v_offer.amount,
    v_offer.amount
  );

  perform private.assess_order_risk(
    v_order.id,
    v_offer.buyer_id,
    v_offer.amount
  );

  insert into public.order_status_history(
    order_id,
    from_status,
    to_status,
    actor_id,
    reason,
    metadata,
    idempotency_key
  )
  values(
    v_order.id,
    null,
    'pending',
    v_offer.buyer_id,
    'Smart offer accepted',
    jsonb_build_object(
      'source','smart_offer',
      'offer_id',v_offer.id
    ),
    v_idempotency_key
  );

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    after_data,
    metadata
  )
  values(
    v_offer.buyer_id,
    'order.created',
    'order',
    v_order.id,
    jsonb_build_object(
      'status','pending',
      'total',v_order.total,
      'currency',v_order.currency,
      'source_offer_id',v_offer.id
    ),
    jsonb_build_object('source','smart_offer')
  );

  insert into public.notifications(
    user_id,
    type,
    title,
    body,
    href,
    metadata
  )
  values(
    v_offer.buyer_id,
    'smart_offer.accepted',
    'تم قبول عرضك مبدئيًا',
    'تم إنشاء مسار الصفقة بانتظار الدفع وإتمام التسليم الآمن.',
    '/orders/' || v_order.id,
    jsonb_build_object(
      'order_id',v_order.id,
      'offer_id',v_offer.id
    )
  );

  insert into public.notifications(
    user_id,
    type,
    title,
    body,
    href,
    metadata
  )
  values(
    v_offer.seller_id,
    'smart_offer.accepted',
    'تم قبول عرض ذكي',
    'تم إنشاء مسار الصفقة. أكمل خطوات الدفع والتسليم الآمن.',
    '/orders/' || v_order.id,
    jsonb_build_object(
      'order_id',v_order.id,
      'offer_id',v_offer.id
    )
  );

  return jsonb_build_object(
    'order_id',v_order.id,
    'existing',false,
    'status',v_order.status
  );
end;
$function$;

revoke execute on function private.create_escrow_order_from_offer(uuid) from public,anon,authenticated;
