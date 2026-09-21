-- Reinstall the atomic order RPC with a real server-side risk assessment.

create or replace function private.create_fixed_price_order(
  p_buyer_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_delivery_method text,
  p_delivery_address jsonb,
  p_notes text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_existing public.orders%rowtype;
  v_product public.products%rowtype;
  v_order public.orders%rowtype;
  v_item_total numeric;
  v_address jsonb:=coalesce(p_delivery_address,'{}'::jsonb);
  v_risk jsonb;
begin
  if p_buyer_id is null or p_buyer_id<>(select auth.uid()) then
    raise exception 'Authenticated buyer is required' using errcode='42501';
  end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100 then
    raise exception 'Invalid quantity' using errcode='22023';
  end if;
  if p_delivery_method not in ('pickup','seller_delivery','platform_delivery') then
    raise exception 'Invalid delivery method' using errcode='22023';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key))<16 or length(trim(p_idempotency_key))>128 then
    raise exception 'Valid idempotency key is required' using errcode='22023';
  end if;

  select * into v_existing from public.orders
  where buyer_id=p_buyer_id and idempotency_key=trim(p_idempotency_key)
  order by created_at desc limit 1;

  if found then
    return jsonb_build_object(
      'order_id',v_existing.id,'reference_code',v_existing.reference_code,
      'status',v_existing.status,
      'quantity',(select coalesce(sum(quantity),0) from public.order_items where order_id=v_existing.id),
      'total',v_existing.total,'currency',v_existing.currency,'existing',true
    );
  end if;

  select * into v_product from public.products
  where id=p_product_id and status='published' and moderation_status='approved'
    and listing_type='sale' and owner_id is not null
  for update;

  if not found then raise exception 'Product is not available' using errcode='P0002'; end if;
  if v_product.owner_id=p_buyer_id then raise exception 'Cannot buy your own product' using errcode='42501'; end if;
  if v_product.quantity<p_quantity then raise exception 'Insufficient stock' using errcode='P0003'; end if;

  if (
    (v_product.delivery_method='pickup' and p_delivery_method<>'pickup')
    or (v_product.delivery_method='seller_delivery' and p_delivery_method<>'seller_delivery')
    or (v_product.delivery_method='platform_delivery' and p_delivery_method<>'platform_delivery')
    or (v_product.delivery_method='both' and p_delivery_method not in ('pickup','seller_delivery'))
  ) then
    raise exception 'Delivery method not available' using errcode='22023';
  end if;

  if p_delivery_method<>'pickup'
     and (
       coalesce(v_address->>'address_line1','')=''
       or coalesce(v_address->>'city','')=''
       or coalesce(v_address->>'governorate','')=''
     ) then
    raise exception 'Delivery address is required' using errcode='22023';
  end if;

  if v_product.price is null or v_product.price<=0 then
    raise exception 'Product price is invalid' using errcode='P0004';
  end if;

  v_item_total:=v_product.price*p_quantity;

  perform set_config('deba.internal_operation','order_create',true);

  update public.products
  set quantity=quantity-p_quantity,
      status=case when quantity-p_quantity=0 then 'reserved' else 'published' end
  where id=v_product.id and quantity>=p_quantity and status='published';

  if not found then raise exception 'Stock changed during order creation' using errcode='P0003'; end if;

  insert into public.orders(
    buyer_id,seller_id,product_id,offer_id,idempotency_key,
    status,payment_status,fulfillment_status,subtotal,shipping_fee,platform_fee,total,currency,
    delivery_method,delivery_address_snapshot,notes,status_reason
  )
  values(
    p_buyer_id,v_product.owner_id,v_product.id,null,trim(p_idempotency_key),
    'pending','unpaid','pending',v_item_total,0,0,v_item_total,
    coalesce(v_product.currency,'EGP'),p_delivery_method,
    case when p_delivery_method='pickup' then '{}'::jsonb else v_address end,
    nullif(trim(coalesce(p_notes,'')),''),
    'Order created'
  )
  returning * into v_order;

  insert into public.order_items(order_id,product_id,seller_id,quantity,unit_price,line_total)
  values(v_order.id,v_product.id,v_product.owner_id,p_quantity,v_product.price,v_item_total);

  perform private.assess_order_risk(v_order.id,p_buyer_id,v_order.total);

  select jsonb_build_object(
    'score',score,'level',level,'status',status,'reasons',reasons,'modelVersion',model_version
  ) into v_risk
  from public.risk_assessments
  where order_id=v_order.id;

  insert into public.order_status_history(
    order_id,from_status,to_status,actor_id,reason,metadata,idempotency_key
  )
  values(
    v_order.id,null,'pending',p_buyer_id,'Order created',
    jsonb_build_object('source','checkout','risk',v_risk),trim(p_idempotency_key)
  );

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,after_data,metadata)
  values(
    p_buyer_id,'order.created','order',v_order.id,
    jsonb_build_object('status','pending','total',v_order.total,'currency',v_order.currency),
    jsonb_build_object('source','checkout','reference_code',v_order.reference_code,'risk',v_risk)
  );

  insert into public.notifications(user_id,type,title,body,href,metadata)
  values(
    v_order.seller_id,'order.created','طلب شراء جديد','لديك طلب شراء جديد على منتجك.',
    '/orders/' || v_order.id,
    jsonb_build_object('order_id',v_order.id,'reference_code',v_order.reference_code)
  );

  return jsonb_build_object(
    'order_id',v_order.id,'reference_code',v_order.reference_code,'status',v_order.status,
    'quantity',p_quantity,'total',v_order.total,'currency',v_order.currency,
    'risk',v_risk,'existing',false
  );
end;
$$;
