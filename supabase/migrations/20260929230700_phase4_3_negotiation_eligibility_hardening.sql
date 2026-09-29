-- DEBA Phase 4.3 — negotiation eligibility hardening
-- Smart pricing, auctions and seller floors are meaningful only for real negotiable
-- sale listings. This makes the server contract explicit instead of relying on UI state.

create or replace function public.set_smart_offer_floor(p_product_id uuid,p_floor_amount numeric,p_auto_counter_enabled boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
 v_uid uuid := (select auth.uid());
 v_product public.products%rowtype;
begin
 if v_uid is null then raise exception 'Authentication is required' using errcode='42501'; end if;

 select * into v_product
 from public.products
 where id=p_product_id
   and owner_id=v_uid
   and status in ('published','paused')
   and moderation_status='approved'
   and listing_type='sale'
   and is_negotiable=true
 for update;

 if not found then raise exception 'Product is not negotiable or not owned' using errcode='42501'; end if;

 if p_floor_amount is not null
    and (p_floor_amount<=0 or v_product.price is null or p_floor_amount>v_product.price) then
   raise exception 'Smart floor must be positive and not above the listing price';
 end if;

 insert into private.product_ad_controls(product_id,owner_id,smart_floor_amount,auto_counter_enabled)
 values(p_product_id,v_uid,p_floor_amount,coalesce(p_auto_counter_enabled,true))
 on conflict(product_id) do update set
   owner_id=excluded.owner_id,
   smart_floor_amount=excluded.smart_floor_amount,
   auto_counter_enabled=excluded.auto_counter_enabled,
   updated_at=now();

 return jsonb_build_object(
   'productId',p_product_id,
   'enabled',p_floor_amount is not null,
   'autoCounterEnabled',coalesce(p_auto_counter_enabled,true)
 );
end;
$function$;

revoke execute on function public.set_smart_offer_floor(uuid,numeric,boolean) from public,anon;
grant execute on function public.set_smart_offer_floor(uuid,numeric,boolean) to authenticated;

create or replace function public.set_live_auction(p_product_id uuid,p_duration_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
 v_uid uuid := (select auth.uid());
 v_ends_at timestamptz;
begin
 if v_uid is null then raise exception 'Authentication is required' using errcode='42501'; end if;
 if p_duration_minutes is null or p_duration_minutes<30 or p_duration_minutes>10080 then
   raise exception 'Invalid auction duration';
 end if;

 if not exists(
   select 1 from public.products
   where id=p_product_id
     and owner_id=v_uid
     and status='published'
     and moderation_status='approved'
     and listing_type='sale'
     and is_negotiable=true
 ) then
   raise exception 'Product is not negotiable or not owned' using errcode='42501';
 end if;

 v_ends_at=now()+make_interval(mins=>p_duration_minutes);

 insert into private.product_ad_controls(
   product_id,owner_id,auction_enabled,auction_starts_at,auction_ends_at,last_placement_at
 )
 values(p_product_id,v_uid,true,now(),v_ends_at,now())
 on conflict(product_id) do update set
   owner_id=excluded.owner_id,
   auction_enabled=true,
   auction_starts_at=excluded.auction_starts_at,
   auction_ends_at=excluded.auction_ends_at,
   last_placement_at=excluded.last_placement_at,
   updated_at=now();

 return jsonb_build_object('productId',p_product_id,'isLive',true,'startsAt',now(),'endsAt',v_ends_at);
end;
$function$;

revoke execute on function public.set_live_auction(uuid,integer) from public,anon;
grant execute on function public.set_live_auction(uuid,integer) to authenticated;

create or replace function public.submit_smart_offer(p_product_id uuid,p_amount numeric,p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
 v_uid uuid := (select auth.uid());
 v_product public.products%rowtype;
 v_offer public.offers%rowtype;
begin
 if v_uid is null then raise exception 'Authentication is required' using errcode='42501'; end if;
 if p_amount is null or p_amount<=0 or p_amount>1000000000 then
   raise exception 'Invalid smart offer amount';
 end if;

 select * into v_product
 from public.products
 where id=p_product_id
   and status='published'
   and moderation_status='approved'
   and listing_type='sale'
   and is_negotiable=true
   and owner_id is not null
   and quantity>0
   and price>0
 for share;

 if not found then raise exception 'Product is not available for smart offers' using errcode='P0002'; end if;
 if v_product.owner_id=v_uid then raise exception 'Cannot offer on your own product' using errcode='42501'; end if;

 if exists(
   select 1 from private.product_ad_controls c
   where c.product_id=p_product_id
     and c.auction_enabled
     and c.auction_ends_at is not null
     and c.auction_ends_at<=now()
 ) then
   raise exception 'Auction has ended';
 end if;

 insert into public.offers(
   product_id,buyer_id,amount,currency,status,message,seller_id,created_by
 )
 values(
   p_product_id,v_uid,p_amount,coalesce(v_product.currency,'EGP'),'pending',
   nullif(left(trim(coalesce(p_message,'')),1000),''),
   v_product.owner_id,v_uid
 )
 returning * into v_offer;

 select * into v_offer from public.offers where id=v_offer.id;

 return jsonb_build_object(
   'offerId',v_offer.id,
   'status',v_offer.status,
   'amount',v_offer.amount,
   'currency',v_offer.currency,
   'smartDecision',v_offer.smart_decision,
   'counterOfferId',(
      select id from public.offers where parent_offer_id=v_offer.id
      order by created_at desc limit 1
   ),
   'counterAmount',(
      select amount from public.offers where parent_offer_id=v_offer.id
      order by created_at desc limit 1
   )
 );
end;
$function$;

revoke execute on function public.submit_smart_offer(uuid,numeric,text) from public,anon;
grant execute on function public.submit_smart_offer(uuid,numeric,text) to authenticated;
