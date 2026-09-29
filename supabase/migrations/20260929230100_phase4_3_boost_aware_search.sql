-- DEBA Phase 4.3 — boost-aware marketplace ordering
alter table public.products add column if not exists bumped_at timestamptz null;
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
        + case when p.bumped_at >= now() - interval '24 hours' then 0.08 else 0 end
      )::real as product_relevance
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
    case when safe_sort = 'newest' then coalesce(ranked.product_bumped_at, ranked.product_published_at) end desc nulls last,
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
