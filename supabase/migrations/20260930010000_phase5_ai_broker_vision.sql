-- DEBA Phase 5: AI-assisted negotiation policy + multi-modal condition inspection.
-- Design-first infrastructure. This migration is not applied by this branch.
--
-- Critical boundary:
--   The LLM/vision provider proposes evidence only.
--   Database policy functions enforce all financial and state invariants.
--   No payment, fulfillment, or irreversible transaction is executed by a model.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ai_broker_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  role text not null check (role in ('buyer','seller')),
  enabled boolean not null default false,
  max_rounds integer not null default 6 check (max_rounds between 1 and 20),
  expires_at timestamptz null,
  policy_version text not null default 'phase5-v1',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, role)
);

alter table public.ai_broker_rules enable row level security;
revoke all on public.ai_broker_rules from anon;
grant select, insert, update, delete on public.ai_broker_rules to authenticated;

drop policy if exists ai_broker_rules_owner_select on public.ai_broker_rules;
create policy ai_broker_rules_owner_select
on public.ai_broker_rules for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists ai_broker_rules_owner_insert on public.ai_broker_rules;
create policy ai_broker_rules_owner_insert
on public.ai_broker_rules for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists ai_broker_rules_owner_update on public.ai_broker_rules;
create policy ai_broker_rules_owner_update
on public.ai_broker_rules for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists ai_broker_rules_owner_delete on public.ai_broker_rules;
create policy ai_broker_rules_owner_delete
on public.ai_broker_rules for delete
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists private.ai_broker_rule_secrets (
  rule_id uuid primary key references public.ai_broker_rules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_policy bytea not null,
  key_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.ai_broker_rule_secrets enable row level security;
revoke all on private.ai_broker_rule_secrets from public, anon, authenticated;
grant all on private.ai_broker_rule_secrets to service_role;

create or replace function private.ai_broker_vault_key()
returns text
language sql
stable
security definer
set search_path = public, private, vault, extensions, pg_catalog, pg_temp
as $function$
  select max(ds.decrypted_secret)
  from vault.decrypted_secrets ds
  where ds.name = 'deba_ai_broker_policy_key';
$function$;

revoke execute on function private.ai_broker_vault_key()
  from public, anon, authenticated;

create or replace function private.upsert_ai_broker_rule_secret(
  p_rule_id uuid,
  p_user_id uuid,
  p_policy jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, vault, extensions, pg_catalog, pg_temp
as $function$
declare
  v_key text;
begin
  if p_rule_id is null or p_user_id is null or p_policy is null then
    raise exception 'AI broker secret inputs are required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.ai_broker_rules r
    where r.id = p_rule_id
      and r.user_id = p_user_id
  ) then
    raise exception 'AI broker rule not found' using errcode = 'P0002';
  end if;

  v_key := private.ai_broker_vault_key();
  if nullif(trim(v_key), '') is null then
    raise exception 'AI broker policy key is not configured' using errcode = '55000';
  end if;

  insert into private.ai_broker_rule_secrets(
    rule_id, user_id, encrypted_policy, key_version, updated_at
  )
  values (
    p_rule_id,
    p_user_id,
    extensions.pgp_sym_encrypt(
      p_policy::text,
      v_key,
      'cipher-algo=aes256'
    ),
    'v1',
    now()
  )
  on conflict (rule_id) do update set
    user_id = excluded.user_id,
    encrypted_policy = excluded.encrypted_policy,
    key_version = excluded.key_version,
    updated_at = now();
end;
$function$;

revoke execute on function private.upsert_ai_broker_rule_secret(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function private.upsert_ai_broker_rule_secret(uuid, uuid, jsonb)
  to service_role;

create table if not exists public.ai_negotiation_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  broker_user_id uuid not null references auth.users(id) on delete cascade,
  broker_role text not null check (broker_role in ('buyer','seller')),
  status text not null default 'active'
    check (status in ('active','paused','completed','declined','expired','cancelled')),
  current_round integer not null default 0 check (current_round >= 0),
  last_offer_amount numeric null check (last_offer_amount is null or last_offer_amount >= 0),
  last_decision text null,
  policy_version text not null default 'phase5-v1',
  last_action_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_negotiation_sessions enable row level security;
revoke all on public.ai_negotiation_sessions from anon, authenticated;
grant select on public.ai_negotiation_sessions to authenticated;
revoke insert, update, delete on public.ai_negotiation_sessions from authenticated;

drop policy if exists ai_negotiation_sessions_participant_select on public.ai_negotiation_sessions;
create policy ai_negotiation_sessions_participant_select
on public.ai_negotiation_sessions for select
to authenticated
using (
  (select auth.uid()) = buyer_id
  or (select auth.uid()) = seller_id
);

create unique index if not exists ai_negotiation_sessions_active_offer_uidx
on public.ai_negotiation_sessions(offer_id)
where status = 'active';

create index if not exists ai_negotiation_sessions_buyer_idx
on public.ai_negotiation_sessions(buyer_id, updated_at desc);

create index if not exists ai_negotiation_sessions_seller_idx
on public.ai_negotiation_sessions(seller_id, updated_at desc);


create table if not exists public.ai_broker_proposals (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.ai_negotiation_sessions(id) on delete cascade,
  source_offer_id uuid not null references public.offers(id) on delete cascade,
  broker_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('counter_offer','accept','hold','decline')),
  proposed_amount numeric null check (proposed_amount is null or proposed_amount >= 0),
  policy_floor numeric not null check (policy_floor >= 0),
  buyer_ceiling numeric not null check (buyer_ceiling >= 0),
  product_price numeric not null check (product_price >= 0),
  round_number integer not null check (round_number >= 1),
  policy_version text not null,
  market_median numeric null check (market_median is null or market_median >= 0),
  market_confidence numeric not null default 0 check (market_confidence between 0 and 1),
  status text not null default 'proposed'
    check (status in ('proposed','accepted_by_policy','applied','rejected','expired','superseded','failed')),
  applied_offer_id uuid null references public.offers(id) on delete set null,
  applied_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.ai_broker_proposals enable row level security;
revoke all on public.ai_broker_proposals from anon, authenticated;
grant select on public.ai_broker_proposals to authenticated;

drop policy if exists ai_broker_proposals_participant_select on public.ai_broker_proposals;
create policy ai_broker_proposals_participant_select
on public.ai_broker_proposals
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_negotiation_sessions s
    where s.id = session_id
      and (
        (select auth.uid()) = s.buyer_id
        or (select auth.uid()) = s.seller_id
      )
  )
);

revoke insert, update, delete on public.ai_broker_proposals from authenticated;
grant all on public.ai_broker_proposals to service_role;

create unique index if not exists ai_broker_proposals_session_round_idx
on public.ai_broker_proposals(session_id, round_number);

create index if not exists ai_broker_proposals_offer_created_idx
on public.ai_broker_proposals(source_offer_id, created_at desc);

create table if not exists public.ai_negotiation_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.ai_negotiation_sessions(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  actor text not null check (actor in ('buyer','seller','broker','system')),
  event_type text not null check (
    event_type in (
      'session_started',
      'policy_evaluated',
      'counter_proposed',
      'accepted',
      'declined',
      'paused',
      'expired',
      'error'
    )
  ),
  observed_offer_amount numeric null check (observed_offer_amount is null or observed_offer_amount >= 0),
  proposed_amount numeric null check (proposed_amount is null or proposed_amount >= 0),
  market_median_amount numeric null check (market_median_amount is null or market_median_amount >= 0),
  market_confidence numeric null check (market_confidence is null or market_confidence between 0 and 1),
  market_source text null,
  policy_decision text not null,
  model_name text null,
  prompt_hash text null check (prompt_hash is null or prompt_hash ~ '^[0-9a-f]{64}$'),
  input_hash text null check (input_hash is null or input_hash ~ '^[0-9a-f]{64}$'),
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_negotiation_logs enable row level security;
revoke all on public.ai_negotiation_logs from anon, authenticated;
grant select on public.ai_negotiation_logs to authenticated;
revoke insert, update, delete on public.ai_negotiation_logs from authenticated;

drop policy if exists ai_negotiation_logs_participant_select on public.ai_negotiation_logs;
create policy ai_negotiation_logs_participant_select
on public.ai_negotiation_logs for select
to authenticated
using (
  exists (
    select 1
    from public.ai_negotiation_sessions s
    where s.id = session_id
      and (
        (select auth.uid()) = s.buyer_id
        or (select auth.uid()) = s.seller_id
      )
  )
);

create index if not exists ai_negotiation_logs_session_created_idx
on public.ai_negotiation_logs(session_id, created_at desc);

create index if not exists ai_negotiation_logs_offer_created_idx
on public.ai_negotiation_logs(offer_id, created_at desc);

create table if not exists public.product_visual_inspections (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed','cancelled')),
  image_urls jsonb not null default '[]'::jsonb,
  visual_score numeric null check (visual_score is null or visual_score between 0 and 100),
  structural_score numeric null check (structural_score is null or structural_score between 0 and 100),
  cleanliness_score numeric null check (cleanliness_score is null or cleanliness_score between 0 and 100),
  description_consistency_score numeric null check (
    description_consistency_score is null or description_consistency_score between 0 and 100
  ),
  condition_grade text null,
  confidence numeric null check (confidence is null or confidence between 0 and 100),
  damage_flags jsonb not null default '[]'::jsonb,
  observations jsonb not null default '[]'::jsonb,
  verified_badge boolean not null default false,
  provider text null,
  model_name text null,
  source_hash text null check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$'),
  error_code text null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

alter table public.product_visual_inspections enable row level security;
revoke all on public.product_visual_inspections from anon, authenticated;
revoke insert, update, delete on public.product_visual_inspections from authenticated;

grant select (
  product_id,
  visual_score,
  structural_score,
  cleanliness_score,
  description_consistency_score,
  condition_grade,
  confidence,
  damage_flags,
  observations,
  verified_badge,
  provider,
  model_name,
  created_at,
  completed_at
) on public.product_visual_inspections to anon, authenticated;

drop policy if exists product_visual_inspections_public_select on public.product_visual_inspections;
create policy product_visual_inspections_public_select
on public.product_visual_inspections
for select
to anon, authenticated
using (
  status = 'completed'
  and exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
  )
);

drop policy if exists product_visual_inspections_owner_select on public.product_visual_inspections;
create policy product_visual_inspections_owner_select
on public.product_visual_inspections for select
to authenticated
using (
  (select auth.uid()) = requested_by
  or exists (
    select 1
    from public.products p
    where p.id = product_id
      and (select auth.uid()) = p.owner_id
  )
);

create index if not exists product_visual_inspections_product_created_idx
on public.product_visual_inspections(product_id, created_at desc);

create index if not exists product_visual_inspections_pending_idx
on public.product_visual_inspections(created_at)
where status in ('pending','processing');

create or replace function private.get_ai_broker_policy(p_session_id uuid)
returns table (
  seller_floor numeric,
  buyer_ceiling numeric,
  max_rounds integer
)
language plpgsql
security definer
set search_path = public, private, vault, extensions, pg_catalog, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_session public.ai_negotiation_sessions%rowtype;
  v_product public.products%rowtype;
  v_key text;
  v_seller_policy jsonb := '{}'::jsonb;
  v_buyer_policy jsonb := '{}'::jsonb;
  v_seller_rule public.ai_broker_rules%rowtype;
  v_buyer_rule public.ai_broker_rules%rowtype;
  v_seller_secret bytea;
  v_buyer_secret bytea;
  v_floor numeric;
  v_buyer_max numeric;
  v_rounds integer;
begin
  select *
  into v_session
  from public.ai_negotiation_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'AI negotiation session not found' using errcode = 'P0002';
  end if;

  if v_uid is null
     or (v_uid <> v_session.buyer_id and v_uid <> v_session.seller_id) then
    raise exception 'Not a negotiation participant' using errcode = '42501';
  end if;

  select *
  into v_product
  from public.products
  where id = v_session.product_id
    and status = 'published'
    and moderation_status = 'approved'
    and listing_type = 'sale'
    and owner_id = v_session.seller_id
    and quantity > 0
    and coalesce(price, 0) > 0;

  if not found then
    raise exception 'Product is unavailable for AI negotiation' using errcode = 'P0002';
  end if;

  v_key := private.ai_broker_vault_key();

  if nullif(trim(v_key), '') is not null then
    select r.*
    into v_seller_rule
    from public.ai_broker_rules r
    where r.user_id = v_session.seller_id
      and r.product_id = v_session.product_id
      and r.role = 'seller'
      and r.enabled = true
      and (r.expires_at is null or r.expires_at > now())
    limit 1;

    if found then
      select s.encrypted_policy
      into v_seller_secret
      from private.ai_broker_rule_secrets s
      where s.rule_id = v_seller_rule.id;

      if v_seller_secret is not null then
        v_seller_policy := (extensions.pgp_sym_decrypt(v_seller_secret, v_key))::jsonb;
      end if;
    end if;

    select r.*
    into v_buyer_rule
    from public.ai_broker_rules r
    where r.user_id = v_session.buyer_id
      and r.product_id = v_session.product_id
      and r.role = 'buyer'
      and r.enabled = true
      and (r.expires_at is null or r.expires_at > now())
    limit 1;

    if found then
      select s.encrypted_policy
      into v_buyer_secret
      from private.ai_broker_rule_secrets s
      where s.rule_id = v_buyer_rule.id;

      if v_buyer_secret is not null then
        v_buyer_policy := (extensions.pgp_sym_decrypt(v_buyer_secret, v_key))::jsonb;
      end if;
    end if;
  end if;

  v_floor := greatest(
    coalesce(v_product.minimum_offer_amount, 0),
    coalesce((v_seller_policy ->> 'min_acceptable_amount')::numeric, 0)
  );

  v_buyer_max := nullif((v_buyer_policy ->> 'max_acceptable_amount')::numeric, null);
  v_rounds := least(
    coalesce(v_seller_rule.max_rounds, 6),
    coalesce(v_buyer_rule.max_rounds, 6)
  );

  seller_floor := v_floor;
  buyer_ceiling := least(
    v_product.price,
    coalesce(v_buyer_max, v_product.price)
  );
  max_rounds := greatest(1, least(v_rounds, 20));
end;
$function$;

revoke execute on function private.get_ai_broker_policy(uuid)
  from public, anon, authenticated;

create or replace function private.get_broker_market_context(p_offer_id uuid)
returns table (
  product_id uuid,
  current_price numeric,
  market_median numeric,
  market_confidence numeric,
  market_source text
)
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog, pg_temp
as $function$
declare
  v_offer public.offers%rowtype;
  v_product public.products%rowtype;
  v_deal record;
begin
  select * into v_offer
  from public.offers
  where id = p_offer_id;

  if not found then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;

  select * into v_product
  from public.products
  where id = v_offer.product_id
    and status = 'published'
    and moderation_status = 'approved'
    and listing_type = 'sale'
    and owner_id = v_offer.seller_id
    and quantity > 0
    and coalesce(price, 0) > 0;

  if not found then
    raise exception 'Product unavailable for market context' using errcode = 'P0002';
  end if;

  product_id := v_product.id;
  current_price := v_product.price;
  market_median := null;
  market_confidence := 0;
  market_source := 'fallback';

  if exists (
    select 1
    from pg_proc fn
    join pg_namespace ns on ns.oid = fn.pronamespace
    where ns.nspname = 'public'
      and fn.proname = 'get_product_deal_score'
      and pg_get_function_identity_arguments(fn.oid) = 'p_product_id uuid'
  ) then
    execute 'select current_price, median_price, confidence from public.get_product_deal_score($1)'
      into v_deal
      using v_product.id;

    if v_deal.median_price is not null then
      market_median := v_deal.median_price;
      market_confidence := greatest(0, least(1, coalesce(v_deal.confidence, 0)));
      market_source := 'phase4.2';
    end if;
  end if;

  if market_median is null then
    select percentile_cont(0.5) within group (order by p.price)
    into market_median
    from public.products p
    where p.id <> v_product.id
      and p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
      and p.owner_id is not null
      and p.quantity > 0
      and p.price > 0
      and p.currency = v_product.currency
      and (v_product.category_id is null or p.category_id = v_product.category_id)
      and (
        v_product.condition_grade is null
        or p.condition_grade = v_product.condition_grade
      );

    if market_median is not null then
      market_confidence := 0.25;
      market_source := 'fallback-comparables';
    end if;
  end if;

  return next;
end;
$function$;

revoke execute on function private.get_broker_market_context(uuid)
  from public, anon, authenticated;

create or replace function public.initiate_ai_broker_negotiation(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_session_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;

  if v_uid <> v_offer.buyer_id and v_uid <> v_offer.seller_id then
    raise exception 'Not authorized for this offer' using errcode = '42501';
  end if;

  if v_offer.status in ('accepted','rejected','expired','cancelled') then
    raise exception 'Offer is not negotiable' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = v_offer.product_id
      and p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
      and p.owner_id = v_offer.seller_id
      and p.quantity > 0
      and p.price > 0
  ) then
    raise exception 'Product is unavailable for AI negotiation' using errcode = 'P0002';
  end if;

  select id
  into v_session_id
  from public.ai_negotiation_sessions
  where offer_id = v_offer.id
    and status = 'active'
  for update;

  if v_session_id is not null then
    return v_session_id;
  end if;

  insert into public.ai_negotiation_sessions(
    offer_id,
    buyer_id,
    seller_id,
    product_id,
    broker_user_id,
    broker_role,
    status,
    current_round,
    last_offer_amount,
    policy_version,
    last_action_at
  )
  values (
    v_offer.id,
    v_offer.buyer_id,
    v_offer.seller_id,
    v_offer.product_id,
    v_uid,
    case when v_uid = v_offer.buyer_id then 'buyer' else 'seller' end,
    'active',
    0,
    v_offer.amount,
    'phase5-v1',
    now()
  )
  returning id into v_session_id;

  insert into public.ai_negotiation_logs(
    session_id,
    offer_id,
    actor,
    event_type,
    observed_offer_amount,
    policy_decision,
    output
  )
  values (
    v_session_id,
    v_offer.id,
    'broker',
    'session_started',
    v_offer.amount,
    'session_started',
    jsonb_build_object('policyVersion','phase5-v1')
  );

  return v_session_id;
end;
$function$;

revoke execute on function public.initiate_ai_broker_negotiation(uuid)
  from public, anon;
grant execute on function public.initiate_ai_broker_negotiation(uuid)
  to authenticated;

create or replace function public.evaluate_broker_counter_offer(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_session public.ai_negotiation_sessions%rowtype;
  v_offer public.offers%rowtype;
  v_product public.products%rowtype;
  v_policy record;
  v_market record;
  v_anchor numeric;
  v_proposed numeric;
  v_next_round integer;
  v_decision text;
  v_proposal_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_session
  from public.ai_negotiation_sessions
  where id = p_session_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Active AI negotiation session not found' using errcode = 'P0002';
  end if;

  if v_uid <> v_session.buyer_id and v_uid <> v_session.seller_id then
    raise exception 'Not a negotiation participant' using errcode = '42501';
  end if;

  select * into v_offer
  from public.offers
  where id = v_session.offer_id
  for update;

  select * into v_product
  from public.products
  where id = v_session.product_id
    and status = 'published'
    and moderation_status = 'approved'
    and listing_type = 'sale'
    and quantity > 0
    and price > 0
  for update;

  if not found then
    raise exception 'Product became unavailable during negotiation' using errcode = 'P0002';
  end if;

  select * into v_policy from private.get_ai_broker_policy(v_session.id);
  select * into v_market from private.get_broker_market_context(v_offer.id);

  if v_session.current_round >= v_policy.max_rounds then
    v_decision := 'round_limit';
    update public.ai_negotiation_sessions
    set status = 'paused',
        last_decision = v_decision,
        updated_at = now(),
        last_action_at = now()
    where id = v_session.id;

    insert into public.ai_negotiation_logs(
      session_id, offer_id, actor, event_type, observed_offer_amount,
      market_median_amount, market_confidence, market_source, policy_decision
    )
    values (
      v_session.id, v_offer.id, 'broker', 'paused', v_offer.amount,
      v_market.market_median, v_market.market_confidence, v_market.market_source, v_decision
    );

    return jsonb_build_object(
      'sessionId', v_session.id,
      'decision', v_decision,
      'round', v_session.current_round,
      'proposedAmount', null,
      'marketMedianAmount', v_market.market_median,
      'marketConfidence', v_market.market_confidence,
      'marketSource', v_market.market_source
    );
  end if;

  if v_market.market_median is null then
    v_decision := 'insufficient_market_context';
    insert into public.ai_negotiation_logs(
      session_id, offer_id, actor, event_type, observed_offer_amount,
      market_confidence, market_source, policy_decision
    )
    values (
      v_session.id, v_offer.id, 'broker', 'error', v_offer.amount,
      0, v_market.market_source, v_decision
    );

    return jsonb_build_object(
      'sessionId', v_session.id,
      'decision', v_decision,
      'round', v_session.current_round,
      'proposedAmount', null,
      'marketMedianAmount', null,
      'marketConfidence', 0,
      'marketSource', v_market.market_source
    );
  end if;

  v_anchor := greatest(v_policy.seller_floor, least(v_product.price, v_market.market_median));
  v_proposed := round(((v_offer.amount + v_anchor) / 2), 2);
  v_proposed := greatest(v_policy.seller_floor, v_proposed);
  v_proposed := least(v_product.price, v_proposed);

  if v_proposed < v_offer.amount then
    v_proposed := v_offer.amount;
  end if;

  if v_proposed > v_policy.buyer_ceiling then
    v_proposed := v_policy.buyer_ceiling;
  end if;

  if v_policy.buyer_ceiling < v_policy.seller_floor then
    v_decision := 'no_feasible_deal';
    v_proposed := null;
  elsif v_proposed is null or v_proposed <= v_offer.amount then
    v_decision := 'hold';
  else
    v_decision := 'counter_offer';
  end if;

  v_next_round := v_session.current_round + 1;

  update public.ai_negotiation_sessions
  set current_round = v_next_round,
      last_offer_amount = coalesce(v_proposed, last_offer_amount),
      last_decision = v_decision,
      updated_at = now(),
      last_action_at = now()
  where id = v_session.id;

  if v_decision in ('counter_offer','hold','accept') then
    insert into public.ai_broker_proposals(
      session_id,
      source_offer_id,
      broker_user_id,
      action,
      proposed_amount,
      policy_floor,
      buyer_ceiling,
      product_price,
      round_number,
      policy_version,
      market_median,
      market_confidence,
      status
    )
    values (
      v_session.id,
      v_offer.id,
      v_session.broker_user_id,
      v_decision,
      v_proposed,
      v_policy.seller_floor,
      v_policy.buyer_ceiling,
      v_product.price,
      v_next_round,
      v_session.policy_version,
      v_market.market_median,
      v_market.market_confidence,
      'accepted_by_policy'
    )
    returning id into v_proposal_id;
  end if;

  insert into public.ai_negotiation_logs(
    session_id,
    offer_id,
    actor,
    event_type,
    observed_offer_amount,
    proposed_amount,
    market_median_amount,
    market_confidence,
    market_source,
    policy_decision,
    output
  )
  values (
    v_session.id,
    v_offer.id,
    'broker',
    case when v_decision = 'counter_offer' then 'counter_proposed' else 'policy_evaluated' end,
    v_offer.amount,
    v_proposed,
    v_market.market_median,
    v_market.market_confidence,
    v_market.market_source,
    v_decision,
    jsonb_build_object(
      'policyVersion','phase5-v1',
      'round',v_next_round
    )
  );

  return jsonb_build_object(
    'sessionId', v_session.id,
    'proposalId', v_proposal_id,
    'decision', v_decision,
    'round', v_next_round,
    'proposedAmount', v_proposed,
    'marketMedianAmount', v_market.market_median,
    'marketConfidence', v_market.market_confidence,
    'marketSource', v_market.market_source
  );
end;
$function$;

revoke execute on function public.evaluate_broker_counter_offer(uuid)
  from public, anon;
grant execute on function public.evaluate_broker_counter_offer(uuid)
  to authenticated;

create or replace function public.grade_product_visual_condition(
  p_product_id uuid,
  p_image_urls jsonb
)
returns table (
  inspection_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_urls jsonb := coalesce(p_image_urls, '[]'::jsonb);
  v_count integer;
  v_inspection_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(v_urls) <> 'array' then
    raise exception 'image_urls must be a JSON array' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(v_urls);
  if v_count < 1 or v_count > 12 then
    raise exception 'image_urls must contain between 1 and 12 URLs' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_urls) url
    where url !~* '^https?://'
  ) then
    raise exception 'Only HTTP(S) image URLs are accepted' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.owner_id = v_uid
      and p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
  ) then
    raise exception 'Only the listing owner may request visual inspection' using errcode = '42501';
  end if;

  insert into public.product_visual_inspections(
    product_id,
    requested_by,
    status,
    image_urls
  )
  values (
    p_product_id,
    v_uid,
    'pending',
    v_urls
  )
  returning id into v_inspection_id;

  return query select v_inspection_id, 'pending'::text;
end;
$function$;

revoke execute on function public.grade_product_visual_condition(uuid, jsonb)
  from public, anon;
grant execute on function public.grade_product_visual_condition(uuid, jsonb)
  to authenticated;



create or replace function public.get_product_trust_evidence(p_product_id uuid)
returns table (
  inspection_id uuid,
  visual_score numeric,
  structural_score numeric,
  cleanliness_score numeric,
  description_consistency_score numeric,
  condition_grade text,
  confidence numeric,
  damage_flags jsonb,
  observations jsonb,
  verified_badge boolean,
  provider text,
  model_name text,
  completed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    i.id,
    i.visual_score,
    i.structural_score,
    i.cleanliness_score,
    i.description_consistency_score,
    i.condition_grade,
    i.confidence,
    i.damage_flags,
    i.observations,
    i.verified_badge,
    i.provider,
    i.model_name,
    i.completed_at
  from public.product_visual_inspections i
  where i.product_id = p_product_id
    and i.status = 'completed'
  order by i.completed_at desc nulls last, i.created_at desc
  limit 1;
$function$;

revoke execute on function public.get_product_trust_evidence(uuid)
  from public, anon, authenticated;
grant execute on function public.get_product_trust_evidence(uuid)
  to anon, authenticated;

create or replace function private.apply_product_visual_grade(
  p_inspection_id uuid,
  p_visual_score numeric,
  p_structural_score numeric,
  p_cleanliness_score numeric,
  p_description_consistency_score numeric,
  p_condition_grade text,
  p_confidence numeric,
  p_damage_flags jsonb,
  p_observations jsonb,
  p_provider text,
  p_model_name text,
  p_source_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog, pg_temp
as $function$
declare
  v_verified boolean;
  v_product_id uuid;
begin
  if p_inspection_id is null then
    raise exception 'Inspection id is required' using errcode = '22023';
  end if;

  if p_condition_grade is not null
     and p_condition_grade not in ('new','like_new','excellent','good','fair','poor','for_parts') then
    raise exception 'Unsupported condition grade' using errcode = '22023';
  end if;

  v_verified := coalesce(p_confidence, 0) >= 85
    and coalesce(p_description_consistency_score, 0) >= 80
    and jsonb_array_length(coalesce(p_damage_flags, '[]'::jsonb)) = 0;

  update public.product_visual_inspections
  set status = 'completed',
      visual_score = p_visual_score,
      structural_score = p_structural_score,
      cleanliness_score = p_cleanliness_score,
      description_consistency_score = p_description_consistency_score,
      condition_grade = p_condition_grade,
      confidence = p_confidence,
      damage_flags = coalesce(p_damage_flags, '[]'::jsonb),
      observations = coalesce(p_observations, '[]'::jsonb),
      verified_badge = v_verified,
      provider = left(p_provider, 80),
      model_name = left(p_model_name, 160),
      source_hash = p_source_hash,
      completed_at = now()
  where id = p_inspection_id
  returning product_id into v_product_id;

  if not found then
    raise exception 'Inspection not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'inspectionId', p_inspection_id,
    'productId', v_product_id,
    'verifiedBadge', v_verified
  );
end;
$function$;

revoke execute on function private.apply_product_visual_grade(uuid, numeric, numeric, numeric, numeric, text, numeric, jsonb, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function private.apply_product_visual_grade(uuid, numeric, numeric, numeric, numeric, text, numeric, jsonb, jsonb, text, text, text)
  to service_role;



create or replace function public.apply_ai_broker_accepted_proposal(
  p_session_id uuid,
  p_proposal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session public.ai_negotiation_sessions%rowtype;
  v_proposal public.ai_broker_proposals%rowtype;
  v_offer public.offers%rowtype;
  v_product public.products%rowtype;
  v_policy record;
  v_actor uuid;
  v_message_id uuid;
  v_new_offer_id uuid;
  v_expected_amount numeric;
  v_execution_actor uuid;
begin
  select *
  into v_session
  from public.ai_negotiation_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'AI negotiation session not found' using errcode = 'P0002';
  end if;

  select *
  into v_proposal
  from public.ai_broker_proposals
  where id = p_proposal_id
    and session_id = p_session_id
  for update;

  if not found then
    raise exception 'AI broker proposal not found' using errcode = 'P0002';
  end if;

  if v_proposal.status = 'applied' then
    return jsonb_build_object(
      'applied', true,
      'idempotent', true,
      'proposalId', v_proposal.id,
      'offerId', v_proposal.applied_offer_id
    );
  end if;

  if v_proposal.status <> 'accepted_by_policy' then
    raise exception 'Only accepted_by_policy proposals can be applied' using errcode = '42501';
  end if;

  if v_proposal.round_number <> v_session.current_round then
    update public.ai_broker_proposals
    set status = 'superseded'
    where id = v_proposal.id;
    raise exception 'Proposal round is stale' using errcode = '40001';
  end if;

  if v_session.current_round < 1
     or v_session.current_round > 20 then
    raise exception 'Negotiation round is outside the allowed bounds' using errcode = '22023';
  end if;

  v_actor := v_proposal.broker_user_id;
  if v_actor <> v_session.buyer_id and v_actor <> v_session.seller_id then
    raise exception 'Broker actor is not a negotiation participant' using errcode = '42501';
  end if;

  select * into v_offer
  from public.offers
  where id = v_proposal.source_offer_id
  for update;

  if not found then
    raise exception 'Source offer not found' using errcode = 'P0002';
  end if;

  if v_offer.status <> 'pending' then
    raise exception 'Source offer is no longer pending' using errcode = '40900';
  end if;

  select * into v_product
  from public.products
  where id = v_offer.product_id
    and status = 'published'
    and moderation_status = 'approved'
    and listing_type = 'sale'
    and owner_id = v_session.seller_id
    and quantity > 0
    and price > 0
  for update;

  if not found then
    raise exception 'Product is unavailable for broker execution' using errcode = 'P0002';
  end if;

  select * into v_policy from private.get_ai_broker_policy(v_session.id);

  if v_proposal.product_price <> v_product.price
     or v_proposal.policy_floor <> v_policy.seller_floor
     or v_proposal.buyer_ceiling <> v_policy.buyer_ceiling then
    raise exception 'Broker proposal financial context changed' using errcode = '40001';
  end if;

  if v_proposal.action = 'counter_offer' then
    v_expected_amount := v_proposal.proposed_amount;

    if v_expected_amount is null
       or v_expected_amount < v_policy.seller_floor
       or v_expected_amount > least(v_product.price, v_policy.buyer_ceiling) then
      raise exception 'Broker proposal violates current financial policy' using errcode = '42501';
    end if;

    -- The existing offer trigger intentionally derives buyer_id from auth.uid().
    -- Execute the broker-created message and offer with transaction-local actor claims,
    -- while keeping the gate itself service_role-only.
    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    insert into public.messages(
      room_id,
      sender_id,
      message_type,
      body,
      metadata
    )
    values (
      v_offer.room_id,
      v_actor,
      'offer',
      'عرض مقابل عبر وكيل DEBA',
      jsonb_build_object(
        'kind','offer',
        'amount',v_expected_amount,
        'currency',coalesce(v_offer.currency,v_product.currency,'EGP'),
        'brokerProposalId',v_proposal.id,
        'parentOfferMessageId',v_offer.message_id
      )
    )
    returning id into v_message_id;

    perform set_config('request.jwt.claim.sub', v_offer.buyer_id::text, true);
    insert into public.offers(
      product_id,
      buyer_id,
      parent_offer_id,
      amount,
      currency,
      status,
      expires_at,
      message,
      room_id,
      message_id,
      seller_id,
      created_by,
      updated_at
    )
    values (
      v_offer.product_id,
      v_offer.buyer_id,
      v_offer.id,
      v_expected_amount,
      coalesce(v_offer.currency,v_product.currency,'EGP'),
      'pending',
      null,
      'AI broker counter offer',
      v_offer.room_id,
      v_message_id,
      v_offer.seller_id,
      v_actor,
      now()
    )
    returning id into v_new_offer_id;

    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    update public.messages
    set metadata = metadata || jsonb_build_object('offerId',v_new_offer_id)
    where id = v_message_id;

    update public.offers
    set status='countered',
        responded_at=now(),
        last_action_by=v_actor,
        updated_at=now()
    where id=v_offer.id;

    update public.ai_broker_proposals
    set status='applied',
        applied_offer_id=v_new_offer_id,
        applied_at=now()
    where id=v_proposal.id;

    update public.ai_negotiation_sessions
    set last_offer_amount=v_expected_amount,
        last_decision='counter_offer_applied',
        updated_at=now(),
        last_action_at=now()
    where id=v_session.id;

    insert into public.ai_negotiation_logs(
      session_id,offer_id,actor,event_type,proposed_amount,policy_decision,output
    )
    values (
      v_session.id,v_offer.id,'system','counter_proposed',v_expected_amount,
      'executed_by_policy',
      jsonb_build_object('proposalId',v_proposal.id,'newOfferId',v_new_offer_id)
    );

    return jsonb_build_object(
      'applied',true,
      'idempotent',false,
      'action','counter_offer',
      'proposalId',v_proposal.id,
      'offerId',v_new_offer_id
    );
  end if;

  if v_proposal.action = 'accept' then
    if v_offer.amount < v_policy.seller_floor
       or v_offer.amount > least(v_product.price, v_policy.buyer_ceiling) then
      raise exception 'Source offer violates current financial policy' using errcode = '42501';
    end if;

    perform set_config('request.jwt.claim.sub', v_actor::text, true);

    update public.offers
    set status='accepted',
        responded_at=now(),
        last_action_by=v_actor,
        updated_at=now()
    where id=v_offer.id;

    update public.offers
    set status='rejected',
        responded_at=now(),
        last_action_by=v_actor,
        updated_at=now()
    where room_id=v_offer.room_id
      and product_id=v_offer.product_id
      and status='pending'
      and id<>v_offer.id;

    update public.ai_broker_proposals
    set status='applied',
        applied_offer_id=v_offer.id,
        applied_at=now()
    where id=v_proposal.id;

    update public.ai_negotiation_sessions
    set status='completed',
        last_decision='accept_applied',
        updated_at=now(),
        last_action_at=now()
    where id=v_session.id;

    insert into public.ai_negotiation_logs(
      session_id,offer_id,actor,event_type,observed_offer_amount,policy_decision,output
    )
    values (
      v_session.id,v_offer.id,'system','accepted',v_offer.amount,
      'executed_by_policy',
      jsonb_build_object('proposalId',v_proposal.id)
    );

    return jsonb_build_object(
      'applied',true,
      'idempotent',false,
      'action','accept',
      'proposalId',v_proposal.id,
      'offerId',v_offer.id
    );
  end if;

  raise exception 'Proposal action is not executable' using errcode = '42501';
end;
$function$;

revoke execute on function public.apply_ai_broker_accepted_proposal(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_ai_broker_accepted_proposal(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';

create or replace function public.upsert_ai_broker_rule_secret(
  p_rule_id uuid,
  p_user_id uuid,
  p_policy jsonb
)
returns void
language sql
security definer
set search_path = ''
as $function$
  select private.upsert_ai_broker_rule_secret(p_rule_id, p_user_id, p_policy);
$function$;

revoke execute on function public.upsert_ai_broker_rule_secret(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_ai_broker_rule_secret(uuid, uuid, jsonb)
  to service_role;

create or replace function public.complete_product_visual_inspection(
  p_inspection_id uuid,
  p_visual_score numeric,
  p_structural_score numeric,
  p_cleanliness_score numeric,
  p_description_consistency_score numeric,
  p_condition_grade text,
  p_confidence numeric,
  p_damage_flags jsonb,
  p_observations jsonb,
  p_provider text,
  p_model_name text,
  p_source_hash text
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select private.apply_product_visual_grade(
    p_inspection_id,
    p_visual_score,
    p_structural_score,
    p_cleanliness_score,
    p_description_consistency_score,
    p_condition_grade,
    p_confidence,
    p_damage_flags,
    p_observations,
    p_provider,
    p_model_name,
    p_source_hash
  );
$function$;

revoke execute on function public.complete_product_visual_inspection(
  uuid, numeric, numeric, numeric, numeric, text, numeric, jsonb, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.complete_product_visual_inspection(
  uuid, numeric, numeric, numeric, numeric, text, numeric, jsonb, jsonb, text, text, text
) to service_role;
create or replace function public.record_ai_broker_advisory(
  p_session_id uuid,
  p_action text,
  p_amount numeric,
  p_rationale text,
  p_confidence numeric,
  p_model_name text,
  p_prompt_hash text,
  p_input_hash text
)
returns void
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog, pg_temp
as $function$
declare
  v_session public.ai_negotiation_sessions%rowtype;
  v_policy text;
begin
  if p_session_id is null then
    raise exception 'Session id is required' using errcode = '22023';
  end if;

  if p_action not in ('counter_offer','hold','accept','decline','rejected_by_policy') then
    raise exception 'Invalid broker advisory action' using errcode = '22023';
  end if;

  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then
    raise exception 'Invalid broker advisory confidence' using errcode = '22023';
  end if;

  select * into v_session
  from public.ai_negotiation_sessions
  where id = p_session_id;

  if not found then
    raise exception 'AI negotiation session not found' using errcode = 'P0002';
  end if;

  if p_amount is not null and p_amount < 0 then
    raise exception 'Broker advisory amount cannot be negative' using errcode = '22023';
  end if;

  v_policy := case
    when p_action = 'rejected_by_policy' then 'model_rejected_by_policy'
    else 'model_advisory_recorded'
  end;

  insert into public.ai_negotiation_logs(
    session_id,
    offer_id,
    actor,
    event_type,
    proposed_amount,
    policy_decision,
    model_name,
    prompt_hash,
    input_hash,
    output
  )
  values (
    p_session_id,
    v_session.offer_id,
    'broker',
    case when p_action = 'counter_offer' then 'counter_proposed' else 'policy_evaluated' end,
    p_amount,
    v_policy,
    left(p_model_name, 160),
    p_prompt_hash,
    p_input_hash,
    jsonb_build_object(
      'action', p_action,
      'rationale', left(coalesce(p_rationale, ''), 2000),
      'confidence', p_confidence
    )
  );
end;
$function$;

revoke execute on function public.record_ai_broker_advisory(
  uuid, text, numeric, text, numeric, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_ai_broker_advisory(
  uuid, text, numeric, text, numeric, text, text, text
) to service_role;
create or replace function public.fail_product_visual_inspection(
  p_inspection_id uuid,
  p_error_code text
)
returns void
language sql
security definer
set search_path = ''
as $function$
  update public.product_visual_inspections
  set status = 'failed',
      error_code = left(p_error_code, 120),
      completed_at = now()
  where id = p_inspection_id;
$function$;

revoke execute on function public.fail_product_visual_inspection(uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_product_visual_inspection(uuid, text)
  to service_role;
