-- DEBA cart checkout order grouping
-- Applied to Supabase project gkwpjtbrecoesxyoybto via migration cart_checkout_order_groups.

create or replace function private.create_cart_orders(
  p_buyer_id uuid, p_groups jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_existing jsonb; v_orders jsonb := '[]'::jsonb; v_product public.products%rowtype;
  v_order public.orders%rowtype; v_group jsonb; v_item jsonb; v_risk jsonb;
  v_product_id uuid; v_seller_id uuid; v_method text; v_address jsonb;
  v_notes text; v_subtotal numeric; v_currency text; v_primary uuid; v_quantity integer;
begin
  if p_buyer_id is null or p_buyer_id <> (select auth.uid()) then raise exception 'Authenticated buyer is required' using errcode='42501'; end if;
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups)<1 or jsonb_array_length(p_groups)>20 then raise exception 'Invalid cart groups' using errcode='22023'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key))<16 or length(trim(p_idempotency_key))>128 then raise exception 'Valid idempotency key is required' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('order_id',o.id,'reference_code',o.reference_code,'status',o.status,'subtotal',o.subtotal,'shipping_fee',o.shipping_fee,'platform_fee',o.platform_fee,'total',o.total,'currency',o.currency,'seller_id',o.seller_id) order by o.created_at),'[]'::jsonb) into v_existing from public.orders o where o.buyer_id=p_buyer_id and o.idempotency_key=trim(p_idempotency_key);
  if jsonb_array_length(v_existing)>0 then return jsonb_build_object('existing',true,'orders',v_existing); end if;
  if exists(select 1 from (select (item.value->>'product_id')::uuid product_id,count(*) from jsonb_array_elements(p_groups) grp(value) cross join lateral jsonb_array_elements(coalesce(grp.value->'items','[]'::jsonb)) item(value) group by 1 having count(*)>1) d) then raise exception 'Duplicate product in cart' using errcode='22023'; end if;
  for v_product_id in select distinct (item.value->>'product_id')::uuid from jsonb_array_elements(p_groups) grp(value) cross join lateral jsonb_array_elements(coalesce(grp.value->'items','[]'::jsonb)) item(value) where item.value ? 'product_id' order by 1 loop
    select * into v_product from public.products where id=v_product_id for update;
    if not found or v_product.status<>'published' or v_product.moderation_status<>'approved' or v_product.listing_type<>'sale' or v_product.owner_id is null then raise exception 'Product is not available' using errcode='P0002'; end if;
    if v_product.owner_id=p_buyer_id then raise exception 'Cannot buy your own product' using errcode='42501'; end if;
    if v_product.price is null or v_product.price<=0 then raise exception 'Product price is invalid' using errcode='P0004'; end if;
  end loop;
  for v_group in select value from jsonb_array_elements(p_groups) loop
    v_seller_id:=(v_group->>'seller_id')::uuid; v_method:=trim(coalesce(v_group->>'delivery_method',''));
    if v_seller_id is null or v_method not in ('pickup','seller_delivery','platform_delivery') then raise exception 'Invalid seller or delivery method' using errcode='22023'; end if;
    if jsonb_typeof(v_group->'items')<>'array' or jsonb_array_length(v_group->'items')<1 or jsonb_array_length(v_group->'items')>100 then raise exception 'Invalid cart items' using errcode='22023'; end if;
    v_address:=case when v_method='pickup' then '{}'::jsonb else coalesce(v_group->'delivery_address','{}'::jsonb) end;
    if v_method<>'pickup' and (coalesce(v_address->>'address_line1','')='' or coalesce(v_address->>'city','')='' or coalesce(v_address->>'governorate','')='') then raise exception 'Delivery address is required' using errcode='22023'; end if;
    v_notes:=nullif(trim(coalesce(v_group->>'notes','')),''); v_subtotal:=0; v_currency:=null; v_primary:=null;
    for v_item in select value from jsonb_array_elements(v_group->'items') loop
      v_product_id:=(v_item->>'product_id')::uuid; v_quantity:=(v_item->>'quantity')::integer;
      if v_quantity<1 or v_quantity>100 then raise exception 'Invalid quantity' using errcode='22023'; end if;
      select * into v_product from public.products where id=v_product_id;
      if not found or v_product.owner_id<>v_seller_id or v_product.status<>'published' or v_product.moderation_status<>'approved' or v_product.listing_type<>'sale' then raise exception 'Seller does not match product' using errcode='22023'; end if;
      if v_product.quantity<v_quantity then raise exception 'Insufficient stock' using errcode='P0003'; end if;
      if (v_product.delivery_method='pickup' and v_method<>'pickup') or (v_product.delivery_method='seller_delivery' and v_method<>'seller_delivery') or (v_product.delivery_method='platform_delivery' and v_method<>'platform_delivery') or (v_product.delivery_method='both' and v_method='platform_delivery') then raise exception 'Delivery method not available' using errcode='22023'; end if;
      if v_currency is null then v_currency:=coalesce(v_product.currency,'EGP'); elsif v_currency<>coalesce(v_product.currency,'EGP') then raise exception 'Mixed currencies are not supported in one seller order' using errcode='22023'; end if;
      if v_primary is null then v_primary:=v_product_id; end if; v_subtotal:=v_subtotal+(v_product.price*v_quantity);
    end loop;
    perform set_config('deba.internal_operation','order_create',true);
    for v_item in select value from jsonb_array_elements(v_group->'items') loop
      v_product_id:=(v_item->>'product_id')::uuid; v_quantity:=(v_item->>'quantity')::integer;
      update public.products set quantity=quantity-v_quantity,status=case when quantity-v_quantity=0 then 'reserved' else 'published' end where id=v_product_id and status='published' and quantity>=v_quantity;
      if not found then raise exception 'Stock changed during cart checkout' using errcode='P0003'; end if;
    end loop;
    insert into public.orders(buyer_id,seller_id,product_id,offer_id,idempotency_key,status,payment_status,fulfillment_status,subtotal,shipping_fee,platform_fee,total,currency,delivery_method,delivery_address_snapshot,notes,status_reason)
    values(p_buyer_id,v_seller_id,v_primary,null,trim(p_idempotency_key),'pending','unpaid','pending',v_subtotal,0,0,v_subtotal,v_currency,v_method,v_address,v_notes,'Cart order created') returning * into v_order;
    for v_item in select value from jsonb_array_elements(v_group->'items') loop
      v_product_id:=(v_item->>'product_id')::uuid; v_quantity:=(v_item->>'quantity')::integer; select * into v_product from public.products where id=v_product_id;
      insert into public.order_items(order_id,product_id,seller_id,quantity,unit_price,line_total) values(v_order.id,v_product_id,v_seller_id,v_quantity,v_product.price,v_product.price*v_quantity);
    end loop;
    perform private.assess_order_risk(v_order.id,p_buyer_id,v_order.total);
    select jsonb_build_object('score',score,'level',level,'status',status,'reasons',reasons,'modelVersion',model_version) into v_risk from public.risk_assessments where order_id=v_order.id;
    insert into public.order_status_history(order_id,from_status,to_status,actor_id,reason,metadata,idempotency_key) values(v_order.id,null,'pending',p_buyer_id,'Cart order created',jsonb_build_object('source','cart_checkout','item_count',jsonb_array_length(v_group->'items')),trim(p_idempotency_key)||':'||v_order.id::text);
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,after_data,metadata) values(p_buyer_id,'order.created','order',v_order.id,jsonb_build_object('status','pending','total',v_order.total,'currency',v_order.currency),jsonb_build_object('source','cart_checkout','reference_code',v_order.reference_code,'item_count',jsonb_array_length(v_group->'items'),'risk',v_risk));
    insert into public.notifications(user_id,type,title,body,href,metadata) values(v_order.seller_id,'order.created','طلب شراء جديد','لديك طلب شراء جديد على منتجاتك.','/orders/'||v_order.id,jsonb_build_object('order_id',v_order.id,'reference_code',v_order.reference_code,'item_count',jsonb_array_length(v_group->'items')));
    v_orders:=v_orders||jsonb_build_array(jsonb_build_object('order_id',v_order.id,'reference_code',v_order.reference_code,'status',v_order.status,'subtotal',v_order.subtotal,'shipping_fee',v_order.shipping_fee,'platform_fee',v_order.platform_fee,'total',v_order.total,'currency',v_order.currency,'seller_id',v_order.seller_id,'item_count',jsonb_array_length(v_group->'items')));
  end loop;
  return jsonb_build_object('existing',false,'orders',v_orders);
end;$function$;

create or replace function public.create_cart_orders(p_groups jsonb,p_idempotency_key text) returns jsonb language plpgsql set search_path to 'public','private','pg_temp' as $function$ begin return private.create_cart_orders((select auth.uid()),p_groups,p_idempotency_key); end;$function$;
revoke all on function private.create_cart_orders(uuid,jsonb,text) from public,anon,authenticated;
revoke all on function public.create_cart_orders(jsonb,text) from public,anon,authenticated;
grant execute on function public.create_cart_orders(jsonb,text) to authenticated;