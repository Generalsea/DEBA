-- DEBA Phase 4.3 — placement storage correction
-- Avoid touching public.products for advertiser placement because DEBA's seller-product
-- contract validates product updates. Placement state belongs in the ad-control layer.

alter table private.product_ad_controls
  add column if not exists last_placement_at timestamptz null;

create or replace function private.get_product_placement_at(p_product_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when c.last_placement_at is null and b.boost_started_at is null then null
    else greatest(
      coalesce(c.last_placement_at, 'epoch'::timestamptz),
      coalesce(b.boost_started_at, 'epoch'::timestamptz)
    )
  end
  from (
    select last_placement_at
    from private.product_ad_controls
    where product_id = p_product_id
  ) c
  full join (
    select max(starts_at) as boost_started_at
    from public.ad_boosts
    where product_id = p_product_id
      and status = 'active'
      and ends_at > now()
      and boost_type in ('super_boost','stealth_pin','auto_refresh')
  ) b on true;
$function$;

revoke execute on function private.get_product_placement_at(uuid) from public;
grant execute on function private.get_product_placement_at(uuid) to anon, authenticated;

drop index if exists public.products_bumped_at_idx;
alter table public.products drop column if exists bumped_at;

create or replace function public.search_marketplace_products(
  p_query text default null,
  p_limit integer default 36,
  p_offset integer default 0,
  p_category_slug text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_condition text default null,
  p_governorate text default null,
  p_city text default null,
  p_sort text default 'relevance'
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  slug text,
  description text,
  price numeric,
  currency text,
  condition_grade text,
  city text,
  governorate text,
  published_at timestamptz,
  created_at timestamptz,
  category_id uuid,
  quantity integer,
  relevance real
)
language plpgsql
stable
security invoker
set search_path = public, private, extensions, pg_catalog
as $$
declare
  normalized_query text := nullif(private.deba_normalize_arabic(coalesce(p_query, '')), '');
  query_vector tsquery := private.deba_search_tsquery(coalesce(p_query, ''));
  safe_limit integer := least(greatest(coalesce(p_limit, 36), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  safe_sort text := lower(coalesce(p_sort, 'relevance'));
begin
  perform set_config('pg_trgm.similarity_threshold', '0.30', true);

  return query
  with category_hits as (
    select c.id as matched_category_id
    from public.categories as c
    where c.is_active = true
      and normalized_query is not null
      and (
        (query_vector is not null and c.search_vector @@ query_vector)
        or c.search_text % normalized_query
      )
  ),
  ranked as (
    select
      p.id as product_id,
      p.owner_id as product_owner_id,
      p.title as product_title,
      p.slug as product_slug,
      p.description as product_description,
      p.price as product_price,
      p.currency as product_currency,
      p.condition_grade as product_condition_grade,
      p.city as product_city,
      p.governorate as product_governorate,
      p.published_at as product_published_at,
      p.created_at as product_created_at,
      p.category_id as product_category_id,
      p.quantity as product_quantity,
      (
        case
          when normalized_query is null then 0
          else coalesce(ts_rank_cd(p.search_vector, query_vector, 32), 0)
        end
        +
        case
          when p.category_id in (select ch.matched_category_id from category_hits as ch)
          then 0.35
          else 0
        end
        +
        case
          when normalized_query is null then 0
          else least(word_similarity(normalized_query, p.search_text), 1) * 0.15
        end
        + case when ad.placement_at >= now() - interval '24 hours' then 0.08 else 0 end
      )::real as product_relevance
    from public.products as p
    cross join lateral (
      select private.get_product_placement_at(p.id) as placement_at
    ) as ad
    where p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
      and p.owner_id is not null
      and p.quantity > 0
      and p.price > 0
      and (p_category_slug is null or exists (
        select 1
        from public.categories as filter_category
        where filter_category.id = p.category_id
          and filter_category.is_active = true
          and filter_category.slug = p_category_slug
      ))
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (
        p_condition is null
        or case
          when p_condition = 'new' then p.condition_grade = 'new'
          when p_condition = 'used' then p.condition_grade in ('like_new','excellent','good','fair','poor','for_parts')
          else p.condition_grade = p_condition
        end
      )
      and (p_governorate is null or p.governorate ilike p_governorate)
      and (p_city is null or p.city ilike p_city)
      and (
        normalized_query is null
        or (
          (query_vector is not null and p.search_vector @@ query_vector)
          or p.category_id in (select ch.matched_category_id from category_hits as ch)
          or p.search_text % normalized_query
        )
      )
  )
  select
    ranked.product_id,
    ranked.product_owner_id,
    ranked.product_title,
    ranked.product_slug,
    ranked.product_description,
    ranked.product_price,
    ranked.product_currency,
    ranked.product_condition_grade,
    ranked.product_city,
    ranked.product_governorate,
    ranked.product_published_at,
    ranked.product_created_at,
    ranked.product_category_id,
    ranked.product_quantity,
    ranked.product_relevance
  from ranked
  order by
    case when safe_sort = 'relevance' and normalized_query is not null then ranked.product_relevance end desc nulls last,
    case when safe_sort = 'price_low' then ranked.product_price end asc nulls last,
    case when safe_sort = 'price_high' then ranked.product_price end desc nulls last,
    case when safe_sort = 'newest' then coalesce(ranked.product_placement_at, ranked.product_published_at) end desc nulls last,
    ranked.product_published_at desc nulls last,
    ranked.product_created_at desc
  limit safe_limit
  offset safe_offset;
end;
$$;

revoke execute on function public.search_marketplace_products(
  text, integer, integer, text, numeric, numeric, text, text, text, text
) from public;

grant execute on function public.search_marketplace_products(
  text, integer, integer, text, numeric, numeric, text, text, text, text
) to anon, authenticated;

-- Move immediate boost placement and Auto-Refresh placement into private controls.
create or replace function public.spend_coins_for_boost(p_product_id uuid,p_boost_type text,p_duration_minutes integer)
returns jsonb language plpgsql security definer set search_path=''
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
 insert into private.product_ad_controls(product_id,owner_id)
 values(p_product_id,v_uid)
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
   update private.product_ad_controls
   set last_auto_refresh_at=p_reference_at,last_placement_at=p_reference_at,updated_at=p_reference_at
   where product_id=r.product_id;
   if found then
    update public.ad_boosts set last_used_at=p_reference_at where product_id=r.product_id and boost_type='auto_refresh' and status='active';
    v_count=v_count+1;
   end if;
  end if;
 end loop;
 return v_count;
end;
$function$;
