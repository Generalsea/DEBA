-- DEBA Phase 4.3 — Future Marketplace Engine
-- Review/verification migration. Intentionally not applied to production by this PR.

create table if not exists public.user_coin_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  lifetime_earned bigint not null default 0 check (lifetime_earned >= 0),
  lifetime_spent bigint not null default 0 check (lifetime_spent >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.coin_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  reason_code text not null check (reason_code in ('first_listing','completed_sale','excellent_review','boost_purchase','admin_adjustment')),
  reference_type text,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists coin_transactions_reference_uidx
  on public.coin_transactions(user_id,reason_code,reference_id) where reference_id is not null;
create index if not exists coin_transactions_user_created_idx
  on public.coin_transactions(user_id,created_at desc);

create table if not exists private.coin_reward_catalog (
  reason_code text primary key,
  amount bigint not null check (amount > 0),
  metadata jsonb not null default '{}'::jsonb
);

insert into private.coin_reward_catalog(reason_code,amount,metadata)
values
 ('first_listing',100,'{"label":"أول إعلان عام معتمد"}'::jsonb),
 ('completed_sale',50,'{"label":"بيعة مكتملة"}'::jsonb),
 ('excellent_review',10,'{"label":"تقييم 5 نجوم موثق"}'::jsonb)
on conflict(reason_code) do update set amount=excluded.amount,metadata=excluded.metadata;

create table if not exists private.coin_boost_catalog (
  boost_type text primary key,
  base_cost bigint not null check (base_cost > 0),
  default_duration_minutes integer not null check (default_duration_minutes > 0),
  max_duration_minutes integer not null check (max_duration_minutes >= default_duration_minutes),
  metadata jsonb not null default '{}'::jsonb
);

insert into private.coin_boost_catalog(boost_type,base_cost,default_duration_minutes,max_duration_minutes,metadata)
values
 ('super_boost',100,1440,1440,'{"label":"Super Boost"}'::jsonb),
 ('stealth_pin',150,4320,10080,'{"label":"Stealth Pin"}'::jsonb),
 ('auto_refresh',100,10080,20160,'{"label":"Auto-Refresh"}'::jsonb)
on conflict(boost_type) do update set base_cost=excluded.base_cost,default_duration_minutes=excluded.default_duration_minutes,
 max_duration_minutes=excluded.max_duration_minutes,metadata=excluded.metadata;

create table if not exists private.product_ad_controls (
  product_id uuid primary key references public.products(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  smart_floor_amount numeric null check (smart_floor_amount is null or smart_floor_amount >= 0),
  auto_counter_enabled boolean not null default false,
  auction_enabled boolean not null default false,
  auction_starts_at timestamptz null,
  auction_ends_at timestamptz null,
  auto_refresh_enabled boolean not null default false,
  last_auto_refresh_at timestamptz null,
  last_placement_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auction_ends_at is null or auction_starts_at is null or auction_ends_at > auction_starts_at)
);

create table if not exists public.ad_boosts (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  boost_type text not null check (boost_type in ('super_boost','stealth_pin','auto_refresh')),
  coin_cost bigint not null check (coin_cost > 0),
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  last_used_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists ad_boosts_active_product_type_uidx
  on public.ad_boosts(product_id,boost_type) where status='active';
create index if not exists ad_boosts_owner_status_idx
  on public.ad_boosts(owner_id,status,ends_at desc);

create table if not exists private.order_trade_handshakes (
  order_id uuid primary key references public.orders(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  code_hash bytea not null,
  expires_at timestamptz not null,
  verified_at timestamptz null,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
\n
alter table public.offers
 add column if not exists smart_decision text null check (smart_decision in ('auto_countered','auto_counter_offer','accepted_escrow','expired_auction')),
 add column if not exists smart_decision_at timestamptz null;
create index if not exists offers_product_created_idx on public.offers(product_id,created_at desc);

alter table public.orders
 add column if not exists escrow_status text not null default 'not_required'
  check (escrow_status in ('not_required','pending_funding','funded','handoff_verified','released','refunded','disputed')),
 add column if not exists source_offer_id uuid null references public.offers(id) on delete set null,
 add column if not exists trade_handshake_required boolean not null default false;
create index if not exists orders_source_offer_idx on public.orders(source_offer_id) where source_offer_id is not null;

alter table public.user_coin_balances enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.ad_boosts enable row level security;

drop policy if exists user_coin_balances_select_own on public.user_coin_balances;
create policy user_coin_balances_select_own on public.user_coin_balances
  for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists coin_transactions_select_own on public.coin_transactions;
create policy coin_transactions_select_own on public.coin_transactions
  for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists ad_boosts_select_own on public.ad_boosts;
create policy ad_boosts_select_own on public.ad_boosts
  for select to authenticated using (owner_id=(select auth.uid()));

revoke insert,update,delete on public.user_coin_balances from anon,authenticated;
revoke insert,update,delete on public.coin_transactions from anon,authenticated;
revoke insert,update,delete on public.ad_boosts from anon,authenticated;
grant select on public.user_coin_balances,public.coin_transactions,public.ad_boosts to authenticated;
grant all on public.user_coin_balances,public.coin_transactions,public.ad_boosts to service_role;

create or replace function private.award_coins(
 p_user_id uuid,p_amount bigint,p_reason_code text,
 p_reference_type text default null,p_reference_id uuid default null,p_metadata jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_balance public.user_coin_balances%rowtype; v_existing public.coin_transactions%rowtype;
begin
 if p_user_id is null or p_amount<=0 then raise exception 'Invalid coin award'; end if;
 if p_reason_code not in ('first_listing','completed_sale','excellent_review','admin_adjustment') then raise exception 'Invalid coin reason'; end if;
 if p_reference_id is not null then
   select * into v_existing from public.coin_transactions
   where user_id=p_user_id and reason_code=p_reason_code and reference_id=p_reference_id limit 1;
   if found then return jsonb_build_object('awarded',false,'idempotent',true,'transaction_id',v_existing.id,'balance',v_existing.balance_after); end if;
 end if;
 insert into public.user_coin_balances(user_id) values(p_user_id) on conflict(user_id) do nothing;
 select * into v_balance from public.user_coin_balances where user_id=p_user_id for update;
 update public.user_coin_balances
 set balance=v_balance.balance+p_amount,lifetime_earned=v_balance.lifetime_earned+p_amount,updated_at=now()
 where user_id=p_user_id returning * into v_balance;
 insert into public.coin_transactions(user_id,amount,balance_after,reason_code,reference_type,reference_id,metadata)
 values(p_user_id,p_amount,v_balance.balance,p_reason_code,p_reference_type,p_reference_id,coalesce(p_metadata,'{}'::jsonb))
 returning * into v_existing;
 return jsonb_build_object('awarded',true,'idempotent',false,'transaction_id',v_existing.id,'balance',v_balance.balance);
end;
$function$;

create or replace function public.award_coins(
 p_user_id uuid,p_amount bigint,p_reason_code text,
 p_reference_type text default null,p_reference_id uuid default null,p_metadata jsonb default '{}'::jsonb
)
returns jsonb language sql security invoker set search_path='public','private','pg_temp'
as $function$ select private.award_coins(p_user_id,p_amount,p_reason_code,p_reference_type,p_reference_id,p_metadata); $function$;
revoke execute on function public.award_coins(uuid,bigint,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.award_coins(uuid,bigint,text,text,uuid,jsonb) to service_role;

create or replace function public.get_my_coin_balance()
returns jsonb language sql security invoker set search_path='public','pg_temp'
as $function$
select jsonb_build_object('userId',(select auth.uid()),
 'balance',coalesce((select balance from public.user_coin_balances where user_id=(select auth.uid())),0),
 'lifetimeEarned',coalesce((select lifetime_earned from public.user_coin_balances where user_id=(select auth.uid())),0),
 'lifetimeSpent',coalesce((select lifetime_spent from public.user_coin_balances where user_id=(select auth.uid())),0));
$function$;
revoke execute on function public.get_my_coin_balance() from public,anon;
grant execute on function public.get_my_coin_balance() to authenticated;

create or replace function public.spend_coins_for_boost(p_product_id uuid,p_boost_type text,p_duration_minutes integer)
returns jsonb language plpgsql security invoker set search_path='public','private','pg_temp'
as $function$
declare v_uid uuid=(select auth.uid()); v_product public.products%rowtype; v_catalog private.coin_boost_catalog%rowtype;
 v_balance public.user_coin_balances%rowtype; v_cost bigint; v_boost public.ad_boosts%rowtype;
begin
 if v_uid is null then raise exception 'Authentication is required' using errcode='42501'; end if;
 if p_boost_type not in ('super_boost','stealth_pin','auto_refresh') or p_duration_minutes is null or p_duration_minutes<60 then raise exception 'Invalid boost request'; end if;
 select * into v_product from public.products where id=p_product_id and owner_id=v_uid and status in ('published','paused') for update;
 if not found then raise exception 'Product not found or not owned' using errcode='42501'; end if;
 select * into v_catalog from private.coin_boost_catalog where boost_type=p_boost_type;
 if p_duration_minutes>v_catalog.max_duration_minutes then raise exception 'Boost duration exceeds configured maximum'; end if;
 if exists(select 1 from public.ad_boosts where product_id=p_product_id and boost_type=p_boost_type and status='active' and ends_at>now()) then raise exception 'An active boost of this type already exists'; end if;
 v_cost=ceil(v_catalog.base_cost::numeric*p_duration_minutes/v_catalog.default_duration_minutes)::bigint;
 insert into public.user_coin_balances(user_id) values(v_uid) on conflict(user_id) do nothing;
 select * into v_balance from public.user_coin_balances where user_id=v_uid for update;
 if v_balance.balance<v_cost then raise exception 'Insufficient coin balance'; end if;
 update public.user_coin_balances set balance=balance-v_cost,lifetime_spent=lifetime_spent+v_cost,updated_at=now()
 where user_id=v_uid returning * into v_balance;
 insert into public.coin_transactions(user_id,amount,balance_after,reason_code,reference_type,metadata)
 values(v_uid,-v_cost,v_balance.balance,'boost_purchase','ad_boost',
   jsonb_build_object('product_id',p_product_id,'boost_type',p_boost_type,'duration_minutes',p_duration_minutes));
 insert into public.ad_boosts(product_id,owner_id,boost_type,coin_cost,duration_minutes,status,starts_at,ends_at,metadata)
 values(p_product_id,v_uid,p_boost_type,v_cost,p_duration_minutes,'active',now(),now()+make_interval(mins=>p_duration_minutes),
   jsonb_build_object('source','coins')) returning * into v_boost;
 insert into private.product_ad_controls(product_id,owner_id) values(p_product_id,v_uid)
 on conflict(product_id) do update set owner_id=excluded.owner_id,updated_at=now();
 update private.product_ad_controls
 set auto_refresh_enabled=case when p_boost_type='auto_refresh' then true else auto_refresh_enabled end,
     last_placement_at=case when p_boost_type in ('super_boost','stealth_pin') then now() else last_placement_at end,
     updated_at=now()
 where product_id=p_product_id;
 return jsonb_build_object('boostId',v_boost.id,'boostType',v_boost.boost_type,'coinCost',v_cost,'remainingCoins',v_balance.balance,
  'startsAt',v_boost.starts_at,'endsAt',v_boost.ends_at);
end;
$function$;
revoke execute on function public.spend_coins_for_boost(uuid,text,integer) from public,anon;
grant execute on function public.spend_coins_for_boost(uuid,text,integer) to authenticated;

create or replace function public.set_smart_offer_floor(p_product_id uuid,p_floor_amount numeric,p_auto_counter_enabled boolean default true)
returns jsonb language plpgsql security invoker set search_path='public','private','pg_temp'
as $function$
declare v_uid uuid=(select auth.uid()); v_price numeric;
begin
 if v_uid is null then raise exception 'Authentication is required' using errcode='42501'; end if;
 select price into v_price from public.products where id=p_product_id and owner_id=v_uid for update;
 if not found then raise exception 'Product not found or not owned' using errcode='42501'; end if;
 if p_floor_amount is not null and (p_floor_amount<=0 or v_price is null or p_floor_amount>v_price) then raise exception 'Smart floor must be positive and not above the listing price'; end if;
 insert into private.product_ad_controls(product_id,owner_id,smart_floor_amount,auto_counter_enabled)
 values(p_product_id,v_uid,p_floor_amount,coalesce(p_auto_counter_enabled,true))
 on conflict(product_id) do update set owner_id=excluded.owner_id,smart_floor_amount=excluded.smart_floor_amount,
  auto_counter_enabled=excluded.auto_counter_enabled,updated_at=now();
 return jsonb_build_object('productId',p_product_id,'enabled',p_floor_amount is not null,'autoCounterEnabled',coalesce(p_auto_counter_enabled,true));
end;
$function$;
revoke execute on function public.set_smart_offer_floor(uuid,numeric,boolean) from public,anon;
grant execute on function public.set_smart_offer_floor(uuid,numeric,boolean) to authenticated;

create or replace function public.set_live_auction(p_product_id uuid,p_duration_minutes integer)
returns jsonb language plpgsql security invoker set search_path='public','private','pg_temp'
as $function$
declare v_uid uuid=(select auth.uid());v_ends_at timestamptz;
begin
 if v_uid is null then raise exception 'Authentication is required' using errcode='42501'; end if;
 if p_duration_minutes is null or p_duration_minutes<30 or p_duration_minutes>10080 then raise exception 'Invalid auction duration'; end if;
 if not exists(select 1 from public.products where id=p_product_id and owner_id=v_uid) then raise exception 'Product not found or not owned' using errcode='42501'; end if;
 v_ends_at=now()+make_interval(mins=>p_duration_minutes);
 insert into private.product_ad_controls(product_id,owner_id,auction_enabled,auction_starts_at,auction_ends_at)
 values(p_product_id,v_uid,true,now(),v_ends_at)
 on conflict(product_id) do update set owner_id=excluded.owner_id,auction_enabled=true,auction_starts_at=excluded.auction_starts_at,auction_ends_at=excluded.auction_ends_at,updated_at=now();
 return jsonb_build_object('productId',p_product_id,'isLive',true,'startsAt',now(),'endsAt',v_ends_at);
end;
$function$;
revoke execute on function public.set_live_auction(uuid,integer) from public,anon;
grant execute on function public.set_live_auction(uuid,integer) to authenticated;

create or replace function public.submit_smart_offer(p_product_id uuid,p_amount numeric,p_message text default null)
returns jsonb language plpgsql security invoker set search_path='public','private','pg_temp'
as $function$
declare v_uid uuid=(select auth.uid());v_product public.products%rowtype;v_offer public.offers%rowtype;
begin
 if v_uid is null then raise exception 'Authentication is required' using errcode='42501'; end if;
 if p_amount is null or p_amount<=0 or p_amount>1000000000 then raise exception 'Invalid smart offer amount'; end if;
 select * into v_product from public.products where id=p_product_id and status='published' and moderation_status='approved'
  and listing_type='sale' and owner_id is not null and quantity>0 and price>0 for share;
 if not found then raise exception 'Product is not available' using errcode='P0002'; end if;
 if v_product.owner_id=v_uid then raise exception 'Cannot offer on your own product' using errcode='42501'; end if;
 if exists(select 1 from private.product_ad_controls c where c.product_id=p_product_id and c.auction_enabled
   and c.auction_ends_at is not null and c.auction_ends_at<=now()) then raise exception 'Auction has ended'; end if;
 insert into public.offers(product_id,buyer_id,amount,currency,status,message,seller_id,created_by)
 values(p_product_id,v_uid,p_amount,coalesce(v_product.currency,'EGP'),'pending',
   nullif(left(trim(coalesce(p_message,'')),1000),''),
   v_product.owner_id,v_uid) returning * into v_offer;
 select * into v_offer from public.offers where id=v_offer.id;
 return jsonb_build_object('offerId',v_offer.id,'status',v_offer.status,'amount',v_offer.amount,'currency',v_offer.currency,
   'smartDecision',v_offer.smart_decision,
   'counterOfferId',(select id from public.offers where parent_offer_id=v_offer.id order by created_at desc limit 1),
   'counterAmount',(select amount from public.offers where parent_offer_id=v_offer.id order by created_at desc limit 1));
end;
$function$;
revoke execute on function public.submit_smart_offer(uuid,numeric,text) from public,anon;
grant execute on function public.submit_smart_offer(uuid,numeric,text) to authenticated;

create or replace function private.create_escrow_order_from_offer(p_offer_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_offer public.offers%rowtype;v_existing public.orders%rowtype;v_product public.products%rowtype;v_order public.orders%rowtype;
begin
 select * into v_offer from public.offers where id=p_offer_id for update;
 if not found then raise exception 'Offer not found' using errcode='P0002'; end if;
 select * into v_existing from public.orders where source_offer_id=v_offer.id limit 1;
 if found then return jsonb_build_object('order_id',v_existing.id,'existing',true,'status',v_existing.status); end if;
 select * into v_product from public.products where id=v_offer.product_id and status='published' and moderation_status='approved'
  and listing_type='sale' and owner_id=v_offer.seller_id and quantity>0 and price>0 for update;
 if not found then raise exception 'Product unavailable for escrow order' using errcode='P0002'; end if;
 update public.products set quantity=quantity-1,status=case when quantity-1=0 then 'reserved' else 'published' end,updated_at=now()
 where id=v_product.id and quantity>0 and status='published';
 if not found then raise exception 'Stock changed during smart offer acceptance' using errcode='P0003'; end if;
 insert into public.orders(
  buyer_id,seller_id,product_id,offer_id,source_offer_id,status,payment_status,fulfillment_status,
  subtotal,shipping_fee,platform_fee,total,currency,delivery_method,delivery_address_snapshot,
  notes,status_reason,escrow_status,trade_handshake_required,idempotency_key
 )
 values(
  v_offer.buyer_id,v_offer.seller_id,v_offer.product_id,null,v_offer.id,'pending','unpaid','pending',
  v_offer.amount,0,0,v_offer.amount,coalesce(v_offer.currency,v_product.currency,'EGP'),
  case when v_product.delivery_method='both' then 'pickup' else v_product.delivery_method end,'{}'::jsonb,null,
  'Smart offer accepted — awaiting payment and handoff','pending_funding',true,
  'smart-offer-'||replace(v_offer.id::text,'-','')
 ) returning * into v_order;
 insert into public.order_items(order_id,product_id,seller_id,quantity,unit_price,line_total)
 values(v_order.id,v_product.id,v_product.owner_id,1,v_offer.amount,v_offer.amount);
 perform private.assess_order_risk(v_order.id,v_offer.buyer_id,v_offer.amount);
 insert into public.order_status_history(order_id,from_status,to_status,actor_id,reason,metadata,idempotency_key)
 values(v_order.id,null,'pending',v_offer.buyer_id,'Smart offer accepted',jsonb_build_object('source','smart_offer','offer_id',v_offer.id),
  'smart-offer-'||replace(v_offer.id::text,'-',''));
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,after_data,metadata)
 values(v_offer.buyer_id,'order.created','order',v_order.id,
  jsonb_build_object('status','pending','total',v_order.total,'currency',v_order.currency,'source_offer_id',v_offer.id),
  jsonb_build_object('source','smart_offer'));
 insert into public.notifications(user_id,type,title,body,href,metadata)
 values(v_offer.buyer_id,'smart_offer.accepted','تم قبول عرضك مبدئيًا',
  'تم إنشاء مسار الصفقة بانتظار الدفع وإتمام التسليم الآمن.','/orders/'||v_order.id,
  jsonb_build_object('order_id',v_order.id,'offer_id',v_offer.id));
 insert into public.notifications(user_id,type,title,body,href,metadata)
 values(v_offer.seller_id,'smart_offer.accepted','تم قبول عرض ذكي',
  'تم إنشاء مسار الصفقة. أكمل خطوات الدفع والتسليم الآمن.','/orders/'||v_order.id,
  jsonb_build_object('order_id',v_order.id,'offer_id',v_offer.id));
 return jsonb_build_object('order_id',v_order.id,'existing',false,'status',v_order.status);
end;
$function$;

create or replace function private.process_smart_offer_intent(p_offer_id uuid,p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_offer public.offers%rowtype;v_product public.products%rowtype;v_control private.product_ad_controls%rowtype;
 v_counter public.offers%rowtype;v_message public.messages%rowtype;v_order jsonb;v_counter_amount numeric;
begin
 select * into v_offer from public.offers where id=p_offer_id for update;
 if not found then raise exception 'Offer not found' using errcode='P0002'; end if;
 if v_offer.status<>'pending' then return jsonb_build_object('processed',false,'reason','not_pending'); end if;
 select * into v_product from public.products where id=v_offer.product_id and owner_id=v_offer.seller_id
  and status='published' and moderation_status='approved' and listing_type='sale' and quantity>0 and price>0 for update;
 if not found then raise exception 'Product is not available for smart offer' using errcode='P0002'; end if;
 if p_actor_id is not null and p_actor_id<>v_offer.buyer_id and p_actor_id<>v_offer.seller_id then
   raise exception 'Actor is not a party to this offer' using errcode='42501';
 end if;
 select * into v_control from private.product_ad_controls where product_id=v_product.id for share;
 if not found or v_control.smart_floor_amount is null then return jsonb_build_object('processed',false,'reason','smart_floor_disabled'); end if;
 if v_control.auction_enabled and v_control.auction_ends_at is not null and v_control.auction_ends_at<=now() then
  update public.offers set status='expired',smart_decision='expired_auction',smart_decision_at=now(),responded_at=now(),updated_at=now() where id=v_offer.id;
  return jsonb_build_object('processed',true,'decision','expired_auction');
 end if;
 if v_offer.amount<v_control.smart_floor_amount and v_control.auto_counter_enabled then
  v_counter_amount=v_control.smart_floor_amount;
  update public.offers set status='countered',smart_decision='auto_countered',smart_decision_at=now(),responded_at=now(),updated_at=now() where id=v_offer.id;
  if v_offer.room_id is not null then
   insert into public.messages(room_id,sender_id,message_type,body,metadata)
   values(v_offer.room_id,v_offer.seller_id,'offer','عرض مقابل آلي من DEBA',
    jsonb_build_object('kind','offer','amount',v_counter_amount,'currency',v_offer.currency,'title','عرض مقابل آلي',
     'parentOfferMessageId',coalesce(v_offer.message_id::text,''))) returning * into v_message;
  end if;
  insert into public.offers(product_id,buyer_id,parent_offer_id,amount,currency,status,message,room_id,message_id,seller_id,created_by,smart_decision,smart_decision_at)
  values(v_offer.product_id,v_offer.buyer_id,v_offer.id,v_counter_amount,v_offer.currency,'pending',
   'أقرب سعر مقبول تلقائيًا من المعلن.',v_offer.room_id,v_message.id,v_offer.seller_id,v_offer.seller_id,'auto_counter_offer',now())
  returning * into v_counter;
  if v_message.id is not null then update public.messages set metadata=metadata||jsonb_build_object('offerId',v_counter.id) where id=v_message.id; end if;
  insert into public.notifications(user_id,type,title,body,href,metadata)
  values(v_offer.buyer_id,'smart_offer.countered','تم إنشاء عرض مقابل تلقائي',
   'المعلن حدد سعرًا أقرب للإتمام لعرضك.','/products/'||v_product.slug,
   jsonb_build_object('offer_id',v_offer.id,'counter_offer_id',v_counter.id));
  return jsonb_build_object('processed',true,'decision','auto_countered','offer_id',v_offer.id,
   'counter_offer_id',v_counter.id,'counter_amount',v_counter.amount);
 end if;
 if v_offer.amount<v_control.smart_floor_amount then
  return jsonb_build_object('processed',false,'decision','below_floor_waiting_seller','offer_id',v_offer.id);
 end if;
 update public.offers set status='accepted',smart_decision='accepted_escrow',smart_decision_at=now(),responded_at=now(),
   last_action_by=v_offer.seller_id,updated_at=now() where id=v_offer.id;
 v_order=private.create_escrow_order_from_offer(v_offer.id);
 return jsonb_build_object('processed',true,'decision','accepted_escrow','offer_id',v_offer.id,'order',v_order);
end;
$function$;

create or replace function public.process_smart_offer_intent(p_offer_id uuid)
returns jsonb language sql security invoker set search_path='public','private','pg_temp'
as $function$ select private.process_smart_offer_intent(p_offer_id,(select auth.uid())); $function$;
revoke execute on function public.process_smart_offer_intent(uuid) from public,anon;
grant execute on function public.process_smart_offer_intent(uuid) to authenticated;

create or replace function private.process_new_smart_offer()
returns trigger language plpgsql security definer set search_path=''
as $function$ begin if new.status='pending' and new.parent_offer_id is null then perform private.process_smart_offer_intent(new.id,null); end if; return new; end; $function$;
drop trigger if exists offers_smart_intent_trigger on public.offers;
create trigger offers_smart_intent_trigger after insert on public.offers for each row execute function private.process_new_smart_offer();

create or replace function public.get_live_auction_state(p_product_id uuid)
returns jsonb language sql security invoker set search_path='public','private','pg_temp'
as $function$
with p as(select id,price,currency from public.products where id=p_product_id and status='published' and moderation_status='approved' and listing_type='sale'),
c as(select * from private.product_ad_controls where product_id=p_product_id)
select jsonb_build_object(
 'productId',p_product_id,'isLive',coalesce(c.auction_enabled,false) and c.auction_starts_at is not null and c.auction_ends_at is not null and now() between c.auction_starts_at and c.auction_ends_at,
 'startsAt',c.auction_starts_at,'endsAt',c.auction_ends_at,
 'offerCount',(select count(*) from public.offers o where o.product_id=p_product_id and o.status in ('pending','accepted','countered')),
 'leadingAmount',(select max(o.amount) from public.offers o where o.product_id=p_product_id and o.status in ('pending','accepted')),
 'currency',coalesce(p.currency,'EGP'),'listingPrice',p.price)
from p left join c on true limit 1;
$function$;
revoke execute on function public.get_live_auction_state(uuid) from public;
grant execute on function public.get_live_auction_state(uuid) to anon,authenticated;

create or replace function private.get_peak_hour_for_product(p_product_id uuid,p_reference_at timestamptz default now())
returns integer language sql stable security definer set search_path=''
as $function$
with ctx as(select governorate,category_id from public.products where id=p_product_id),
hours as(
 select extract(hour from (v.viewed_at at time zone 'Africa/Cairo'))::integer h,count(*) n
 from public.product_views v join public.products p on p.id=v.product_id cross join ctx
 where v.viewed_at>=p_reference_at-interval '30 days'
  and p.status='published' and p.moderation_status='approved' and p.listing_type='sale'
  and (ctx.governorate is null or p.governorate=ctx.governorate)
  and (ctx.category_id is null or p.category_id=ctx.category_id)
 group by 1)
select h from hours order by n desc,h asc limit 1;
$function$;

create or replace function private.run_auto_refresh_engine(p_reference_at timestamptz default now())
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_count integer=0;v_current_hour integer;v_peak_hour integer;r record;
begin
 v_current_hour=extract(hour from (p_reference_at at time zone 'Africa/Cairo'))::integer;
 update public.ad_boosts set status='expired' where status='active' and ends_at<=p_reference_at;
 for r in select c.product_id,c.owner_id from private.product_ad_controls c
  where c.auto_refresh_enabled and exists(
   select 1 from public.ad_boosts b where b.product_id=c.product_id and b.owner_id=c.owner_id
    and b.boost_type='auto_refresh' and b.status='active' and b.ends_at>p_reference_at)
  order by c.updated_at limit 1000
 loop
  v_peak_hour=private.get_peak_hour_for_product(r.product_id,p_reference_at);
  if v_peak_hour is not null and v_peak_hour=v_current_hour and not exists(
   select 1 from private.product_ad_controls x where x.product_id=r.product_id and x.last_auto_refresh_at is not null
    and x.last_auto_refresh_at>=p_reference_at-interval '20 hours') then
   update public.products set bumped_at=p_reference_at,updated_at=p_reference_at
   where id=r.product_id and status='published' and moderation_status='approved' and quantity>0;
   if found then
    update private.product_ad_controls set last_auto_refresh_at=p_reference_at,updated_at=p_reference_at where product_id=r.product_id;
    update public.ad_boosts set last_used_at=p_reference_at where product_id=r.product_id and boost_type='auto_refresh' and status='active';
    v_count=v_count+1;
   end if;
  end if;
 end loop;
 return v_count;
end;
$function$;

create or replace function public.run_deba_auto_refresh_engine()
returns integer language sql security invoker set search_path='public','private','pg_temp'
as $function$ select private.run_auto_refresh_engine(now()); $function$;
revoke execute on function public.run_deba_auto_refresh_engine() from public,anon,authenticated;
grant execute on function public.run_deba_auto_refresh_engine() to service_role;

create or replace function public.generate_trade_handshake_code(p_order_id uuid)
returns jsonb language plpgsql security invoker set search_path='public','private','pg_temp'
as $function$
declare v_uid uuid=(select auth.uid());v_order public.orders%rowtype;v_code text;v_expires timestamptz;
begin
 if v_uid is null then raise exception 'Authentication is required' using errcode='42501'; end if;
 select * into v_order from public.orders where id=p_order_id and buyer_id=v_uid for update;
 if not found then raise exception 'Order not found' using errcode='P0002'; end if;
 if v_order.status in ('cancelled','refunded') then raise exception 'Order cannot use trade handshake'; end if;
 v_code=lpad((floor(random()*1000000))::bigint::text,6,'0');v_expires=now()+interval '24 hours';
 insert into private.order_trade_handshakes(order_id,buyer_id,code_hash,expires_at,verified_at,attempts,updated_at)
 values(p_order_id,v_uid,extensions.digest(convert_to(v_code,'UTF8'),'sha256'),v_expires,null,0,now())
 on conflict(order_id) do update set buyer_id=excluded.buyer_id,code_hash=excluded.code_hash,expires_at=excluded.expires_at,
  verified_at=null,attempts=0,updated_at=now();
 update public.orders set trade_handshake_required=true,escrow_status=case when escrow_status='not_required' then 'funded' else escrow_status end,updated_at=now()
 where id=p_order_id;
 return jsonb_build_object('orderId',p_order_id,'code',v_code,'expiresAt',v_expires);
end;
$function$;
revoke execute on function public.generate_trade_handshake_code(uuid) from public,anon;
grant execute on function public.generate_trade_handshake_code(uuid) to authenticated;

create or replace function public.verify_trade_handshake_code(p_order_id uuid,p_code text)
returns jsonb language plpgsql security invoker set search_path='public','private','pg_temp'
as $function$
declare v_uid uuid=(select auth.uid());v_order public.orders%rowtype;v_h private.order_trade_handshakes%rowtype;
begin
 if v_uid is null then raise exception 'Authentication is required' using errcode='42501'; end if;
 if p_code !~ '^[0-9]{6}$' then raise exception 'Invalid handshake code'; end if;
 select * into v_order from public.orders where id=p_order_id and seller_id=v_uid for update;
 if not found then raise exception 'Order not found' using errcode='P0002'; end if;
 if not v_order.trade_handshake_required then raise exception 'Trade handshake is not required'; end if;
 select * into v_h from private.order_trade_handshakes where order_id=p_order_id for update;
 if not found then raise exception 'Handshake code has not been generated'; end if;
 if v_h.verified_at is not null then return jsonb_build_object('verified',true,'alreadyVerified',true,'orderId',p_order_id); end if;
 if v_h.expires_at<=now() then raise exception 'Handshake code expired'; end if;
 if v_h.attempts>=5 then raise exception 'Handshake attempts exhausted'; end if;
 if extensions.digest(convert_to(p_code,'UTF8'),'sha256')<>v_h.code_hash then
  update private.order_trade_handshakes set attempts=attempts+1,updated_at=now() where order_id=p_order_id;
  return jsonb_build_object('verified',false,'attemptsRemaining',greatest(0,4-v_h.attempts),'orderId',p_order_id);
 end if;
 update private.order_trade_handshakes set verified_at=now(),updated_at=now() where order_id=p_order_id;
 update public.orders set escrow_status='handoff_verified',updated_at=now() where id=p_order_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,after_data,metadata)
 values(v_uid,'trade.handshake_verified','order',p_order_id,jsonb_build_object('escrow_status','handoff_verified'),jsonb_build_object('source','safe_handshake'));
 return jsonb_build_object('verified',true,'alreadyVerified',false,'orderId',p_order_id);
end;
$function$;
revoke execute on function public.verify_trade_handshake_code(uuid,text) from public,anon;
grant execute on function public.verify_trade_handshake_code(uuid,text) to authenticated;

create or replace function private.enforce_trade_handshake_on_completion()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if new.status='completed' and coalesce(old.status,'')<>'completed' and new.source_offer_id is not null and new.trade_handshake_required
  and not exists(select 1 from private.order_trade_handshakes h where h.order_id=new.id and h.verified_at is not null) then
  raise exception 'Trade handshake is required before completion' using errcode='42501';
 end if;
 return new;
end;
$function$;

drop trigger if exists orders_trade_handshake_guard on public.orders;
create trigger orders_trade_handshake_guard before update of status on public.orders
for each row execute function private.enforce_trade_handshake_on_completion();

create or replace function public.predictive_search_suggest(p_query text,p_governorate text default null,p_city text default null)
returns jsonb language sql stable security invoker set search_path='public','private','extensions','pg_catalog'
as $function$
with q as(select nullif(private.deba_normalize_arabic(coalesce(p_query,'')),'') normalized),
matched_categories as(
 select c.id from public.categories c cross join q
 where c.is_active and q.normalized is not null
  and (c.search_text%q.normalized or (private.deba_search_tsquery(q.normalized) is not null and c.search_vector@@private.deba_search_tsquery(q.normalized)))
 order by word_similarity(q.normalized,c.search_text) desc nulls last,c.sort_order limit 5),
peers as(
 select p.* from public.products p cross join q
 where p.status='published' and p.moderation_status='approved' and p.listing_type='sale' and p.owner_id is not null
  and p.quantity>0 and p.price>0
  and (p_governorate is null or p.governorate ilike p_governorate)
  and (p_city is null or p.city ilike p_city)
  and q.normalized is not null
  and (p.search_text%q.normalized or p.category_id in(select id from matched_categories))),
ranked as(
 select pe.*,row_number() over(order by greatest(word_similarity(q.normalized,pe.search_text),0) desc,pe.created_at desc) rn
 from peers pe cross join q),
stats as(select coalesce(round(avg(price),0),0)::numeric avg_price,count(distinct owner_id)::integer sellers from peers)
select coalesce(jsonb_agg(jsonb_build_object(
 'query',r.title,'category',coalesce(c.name_ar,c.name_en,''),'averagePrice',s.avg_price,'activeSellerCount',s.sellers,
 'governorate',p_governorate,'city',p_city) order by r.rn),'[]'::jsonb)
from ranked r join public.products p on p.id=r.id left join public.categories c on c.id=p.category_id cross join stats s
where r.rn<=8;
$function$;
revoke execute on function public.predictive_search_suggest(text,text,text) from public;
grant execute on function public.predictive_search_suggest(text,text,text) to anon,authenticated;

create or replace function private.award_first_listing_coins()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_amount bigint;
begin
 if new.status='published' and new.moderation_status='approved' and new.owner_id is not null and not exists(
  select 1 from public.products p where p.owner_id=new.owner_id and p.status='published'
   and p.moderation_status='approved' and p.listing_type='sale' and p.id<>new.id) then
  select amount into v_amount from private.coin_reward_catalog where reason_code='first_listing';
  if v_amount is not null then perform private.award_coins(new.owner_id,v_amount,'first_listing','product',new.id); end if;
 end if;
 return new;
end;
$function$;
drop trigger if exists products_award_first_listing_coins on public.products;
create trigger products_award_first_listing_coins after insert or update of status,moderation_status,owner_id on public.products
for each row execute function private.award_first_listing_coins();

create or replace function private.award_completed_sale_coins()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_amount bigint;
begin
 if new.status='completed' and coalesce(old.status,'')<>'completed' and new.seller_id is not null then
  select amount into v_amount from private.coin_reward_catalog where reason_code='completed_sale';
  if v_amount is not null then perform private.award_coins(new.seller_id,v_amount,'completed_sale','order',new.id); end if;
 end if;
 return new;
end;
$function$;
drop trigger if exists orders_award_completed_sale_coins on public.orders;
create trigger orders_award_completed_sale_coins after update of status on public.orders
for each row execute function private.award_completed_sale_coins();

create or replace function private.award_excellent_review_coins()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_amount bigint;
begin
 if new.status='published' and new.rating=5 and new.verified_purchase and new.seller_id is not null
  and (tg_op='INSERT' or old.status<>'published' or old.rating<>5 or not old.verified_purchase) then
  select amount into v_amount from private.coin_reward_catalog where reason_code='excellent_review';
  if v_amount is not null then perform private.award_coins(new.seller_id,v_amount,'excellent_review','review',new.id); end if;
 end if;
 return new;
end;
$function$;

drop trigger if exists reviews_award_excellent_review_coins on public.reviews;
create trigger reviews_award_excellent_review_coins after insert or update of status,rating,verified_purchase,seller_id on public.reviews
for each row execute function private.award_excellent_review_coins();

do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='offers') then
   execute 'alter publication supabase_realtime add table public.offers';
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ad_boosts') then
   execute 'alter publication supabase_realtime add table public.ad_boosts';
  end if;
 end if;
end $$;
