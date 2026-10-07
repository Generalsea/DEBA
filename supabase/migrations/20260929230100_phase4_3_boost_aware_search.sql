-- DEBA Phase 4.3 — boost-aware placement search
-- Placement signals are computed from private ad state; no public product row is mutated.

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
      coalesce(c.last_placement_at,'epoch'::timestamptz),
      coalesce(b.boost_started_at,'epoch'::timestamptz)
    )
  end
  from (
    select last_placement_at
    from private.product_ad_controls
    where product_id=p_product_id
  ) c
  full join (
    select max(starts_at) as boost_started_at
    from public.ad_boosts
    where product_id=p_product_id
      and status='active'
      and ends_at>now()
      and boost_type in ('super_boost','stealth_pin','auto_refresh')
  ) b on true;
$function$;

revoke execute on function private.get_product_placement_at(uuid) from public;
grant execute on function private.get_product_placement_at(uuid) to anon,authenticated;

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
      ad.placement_at as product_placement_at,
      private.deba_normalize_arabic(coalesce(p.title, '')) as normalized_title,
      p.search_text as normalized_document
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
        + case when filtered.product_placement_at >= now() - interval '24 hours' then 0.08 else 0 end
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
    case when safe_sort = 'newest' then coalesce(counted.product_placement_at, counted.product_published_at) end desc nulls last,
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

revoke execute on function public.search_marketplace_products(
  text, integer, integer, text, numeric, numeric, text, text, text, text
) from public;
grant execute on function public.search_marketplace_products(
  text, integer, integer, text, numeric, numeric, text, text, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
