-- Phase 2 / Search Quality, Relevance Hardening & Telemetry
-- Adds brand-intent isolation, exact/phrase ranking priority, total-count pagination,
-- server-side asynchronous telemetry, and an explicit deny RLS policy for rate limits.

begin;

create table if not exists private.search_brand_groups (
  group_key text primary key,
  created_at timestamptz not null default now()
);

insert into private.search_brand_groups (group_key)
values ('samsung'), ('apple'), ('huawei'), ('xiaomi')
on conflict (group_key) do nothing;

create or replace function private.deba_detect_search_brands(input text)
returns text[]
language sql
stable
strict
set search_path = private, extensions, pg_catalog
as $function$
  select coalesce(array_agg(distinct s.group_key order by s.group_key), array[]::text[])
  from private.search_synonyms as s
  where s.group_key in (select b.group_key from private.search_brand_groups as b)
    and (
      position(' ' || s.normalized_term || ' ' in ' ' || private.deba_normalize_arabic(input) || ' ') > 0
      or exists (
        select 1
        from regexp_split_to_table(private.deba_normalize_arabic(input), '\s+') as q(query_token)
        where length(q.query_token) >= 4
          and similarity(q.query_token, s.normalized_term) >= 0.55
          and q.query_token <> s.normalized_term
      )
    );
$function$;

drop function if exists public.search_marketplace_products(
  text, integer, integer, text, numeric, numeric, text, text, text, text
);

create function public.search_marketplace_products(
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
  relevance real,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = public, private, extensions, pg_catalog
as $function$
declare
  normalized_query text := nullif(private.deba_normalize_arabic(coalesce(p_query, '')), '');
  query_vector tsquery := private.deba_search_tsquery(coalesce(p_query, ''));
  brand_groups text[] := private.deba_detect_search_brands(coalesce(p_query, ''));
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
  filtered as (
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
      p.search_vector as product_search_vector,
      private.deba_normalize_arabic(coalesce(p.title, '')) as normalized_title,
      p.search_text as normalized_document
    from public.products as p
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
      and (
        cardinality(brand_groups) = 0
        or not exists (
          select 1
          from unnest(brand_groups) as requested_brand(group_key)
          where not exists (
            select 1
            from private.search_synonyms as bs
            where bs.group_key = requested_brand.group_key
              and position(
                ' ' || bs.normalized_term || ' '
                in ' ' || p.search_text || ' '
              ) > 0
          )
        )
      )
  ),
  ranked as (
    select
      filtered.*,
      (
        case
          when normalized_query is null then 0
          when filtered.normalized_title = normalized_query then 8.0
          when position(
            ' ' || normalized_query || ' '
            in ' ' || filtered.normalized_title || ' '
          ) > 0 then 4.5
          else 0
        end
        +
        case
          when normalized_query is null then 0
          else coalesce(ts_rank_cd(filtered.product_search_vector, query_vector, 32), 0) * 1.5
        end
        +
        case
          when cardinality(brand_groups) = 0 then 0
          when exists (
            select 1
            from private.search_synonyms as bs
            where bs.group_key = any(brand_groups)
              and position(
                ' ' || bs.normalized_term || ' '
                in ' ' || filtered.normalized_title || ' '
              ) > 0
          ) then 3.0
          else 1.0
        end
        +
        case
          when filtered.product_category_id in (
            select ch.matched_category_id from category_hits as ch
          ) then 0.35
          else 0
        end
        +
        case
          when normalized_query is null then 0
          else least(word_similarity(normalized_query, filtered.normalized_document), 1) * 0.10
        end
      )::real as product_relevance
    from filtered
  ),
  counted as (
    select
      ranked.*,
      count(*) over() as match_count
    from ranked
  )
  select
    counted.product_id,
    counted.product_owner_id,
    counted.product_title,
    counted.product_slug,
    counted.product_description,
    counted.product_price,
    counted.product_currency,
    counted.product_condition_grade,
    counted.product_city,
    counted.product_governorate,
    counted.product_published_at,
    counted.product_created_at,
    counted.product_category_id,
    counted.product_quantity,
    counted.product_relevance,
    counted.match_count
  from counted
  order by
    case when safe_sort = 'relevance' and normalized_query is not null then counted.product_relevance end desc nulls last,
    case when safe_sort = 'price_low' then counted.product_price end asc nulls last,
    case when safe_sort = 'price_high' then counted.product_price end desc nulls last,
    counted.product_published_at desc nulls last,
    counted.product_created_at desc,
    counted.product_id desc
  limit safe_limit
  offset safe_offset;
end;
$function$;

revoke execute on function public.search_marketplace_products(
  text, integer, integer, text, numeric, numeric, text, text, text, text
) from public;
grant execute on function public.search_marketplace_products(
  text, integer, integer, text, numeric, numeric, text, text, text, text
) to anon, authenticated;

comment on function public.search_marketplace_products(
  text, integer, integer, text, numeric, numeric, text, text, text, text
) is 'DEBA Arabic/English marketplace search with exact/phrase title priority, brand-intent filtering, category boosts, typo-tolerant expansion, offset pagination, and total match count.';

create table if not exists private.search_telemetry_daily (
  telemetry_date date not null,
  query_hash text not null,
  normalized_query text not null,
  category_slug text not null default '',
  search_count bigint not null default 0,
  zero_result_count bigint not null default 0,
  total_duration_ms bigint not null default 0,
  last_duration_ms integer not null default 0,
  last_result_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (telemetry_date, query_hash, category_slug)
);

create index if not exists search_telemetry_zero_result_idx
  on private.search_telemetry_daily (telemetry_date, zero_result_count desc);

create or replace function private.record_search_telemetry(
  p_query text,
  p_result_count integer,
  p_duration_ms integer,
  p_category_slug text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_query text := trim(p_query);
  v_category text := coalesce(nullif(trim(p_category_slug), ''), '');
  v_date date := timezone('utc', clock_timestamp())::date;
  v_hash text;
begin
  if v_query = '' or length(v_query) > 80 then
    return;
  end if;

  if p_result_count < 0 or p_result_count > 1000000 then
    return;
  end if;

  if p_duration_ms < 0 or p_duration_ms > 120000 then
    return;
  end if;

  if length(v_category) > 120 then
    return;
  end if;

  v_hash := md5(v_query || '|' || v_category);

  insert into private.search_telemetry_daily (
    telemetry_date,
    query_hash,
    normalized_query,
    category_slug,
    search_count,
    zero_result_count,
    total_duration_ms,
    last_duration_ms,
    last_result_count
  )
  values (
    v_date,
    v_hash,
    v_query,
    v_category,
    1,
    case when p_result_count = 0 then 1 else 0 end,
    p_duration_ms,
    p_duration_ms,
    p_result_count
  )
  on conflict (telemetry_date, query_hash, category_slug) do update
  set
    search_count = private.search_telemetry_daily.search_count + 1,
    zero_result_count = private.search_telemetry_daily.zero_result_count
      + case when excluded.last_result_count = 0 then 1 else 0 end,
    total_duration_ms = private.search_telemetry_daily.total_duration_ms + excluded.last_duration_ms,
    last_duration_ms = excluded.last_duration_ms,
    last_result_count = excluded.last_result_count,
    updated_at = now();
end;
$function$;

revoke execute on function private.record_search_telemetry(text, integer, integer, text) from public, anon, authenticated;
grant execute on function private.record_search_telemetry(text, integer, integer, text) to service_role;

create or replace function public.record_search_telemetry(
  p_query text,
  p_result_count integer,
  p_duration_ms integer,
  p_category_slug text default null
)
returns void
language sql
security definer
set search_path = ''
as $function$
  select private.record_search_telemetry(
    p_query,
    p_result_count,
    p_duration_ms,
    p_category_slug
  );
$function$;

revoke execute on function public.record_search_telemetry(text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.record_search_telemetry(text, integer, integer, text) to service_role;

comment on function public.record_search_telemetry(text, integer, integer, text)
is 'Internal server-only aggregated search telemetry. Stores daily query counts and zero-result counts without user identity.';

alter table public.api_rate_limits enable row level security;
drop policy if exists "api_rate_limits_client_denied" on public.api_rate_limits;
create policy "api_rate_limits_client_denied"
  on public.api_rate_limits
  as permissive
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on public.api_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.api_rate_limits to service_role;

notify pgrst, 'reload schema';

commit;
