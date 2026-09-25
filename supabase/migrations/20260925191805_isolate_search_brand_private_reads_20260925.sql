-- Phase 2 / Step 2.1 follow-up
-- Keep marketplace search SECURITY INVOKER while isolating private synonym reads
-- inside controlled SECURITY DEFINER helpers.

begin;

grant usage on schema private to anon;

create or replace function private.deba_product_has_all_brands(
  search_text_value text,
  requested_brands text[]
)
returns boolean
language sql
stable
security definer
set search_path = private, extensions, pg_catalog
as $function$
  select
    coalesce(cardinality(requested_brands), 0) = 0
    or not exists (
      select 1
      from unnest(requested_brands) as requested_brand(group_key)
      where not exists (
        select 1
        from private.search_synonyms as bs
        where bs.group_key = requested_brand.group_key
          and position(
            ' ' || bs.normalized_term || ' '
            in ' ' || coalesce(search_text_value, '') || ' '
          ) > 0
      )
    );
$function$;

create or replace function private.deba_product_has_any_brand(
  search_text_value text,
  requested_brands text[]
)
returns boolean
language sql
stable
security definer
set search_path = private, extensions, pg_catalog
as $function$
  select
    coalesce(cardinality(requested_brands), 0) > 0
    and exists (
      select 1
      from private.search_synonyms as bs
      where bs.group_key = any(requested_brands)
        and position(
          ' ' || bs.normalized_term || ' '
          in ' ' || coalesce(search_text_value, '') || ' '
        ) > 0
    );
$function$;

create or replace function private.deba_expand_search_variants(input text)
returns text[]
language plpgsql
stable
strict
security definer
set search_path = private, extensions, pg_catalog
as $function$
declare
  normalized text := private.deba_normalize_arabic(input);
  variants text[] := array[normalized];
  next_variants text[];
  group_row record;
  base_variant text;
  matched_term text;
  matched_token text;
  alternative record;
  candidate text;
  exact_match boolean;
begin
  if normalized = '' then
    return array[]::text[];
  end if;

  for group_row in
    select distinct s.group_key
    from private.search_synonyms s
    where position(' ' || s.normalized_term || ' ' in ' ' || normalized || ' ') > 0
       or exists (
         select 1
         from regexp_split_to_table(normalized, '\s+') as query_token
         where length(query_token) >= 4
           and similarity(query_token, s.normalized_term) >= 0.55
           and query_token <> s.normalized_term
       )
    order by s.group_key
  loop
    exact_match := false;
    matched_term := null;
    matched_token := null;

    select s.normalized_term
      into matched_term
    from private.search_synonyms s
    where s.group_key = group_row.group_key
      and position(' ' || s.normalized_term || ' ' in ' ' || normalized || ' ') > 0
    order by length(s.normalized_term) desc, s.normalized_term
    limit 1;

    if matched_term is not null then
      exact_match := true;
    else
      select q.query_token, s.normalized_term
        into matched_token, matched_term
      from regexp_split_to_table(normalized, '\s+') as q(query_token)
      join private.search_synonyms s
        on s.group_key = group_row.group_key
       and length(q.query_token) >= 4
       and similarity(q.query_token, s.normalized_term) >= 0.55
       and q.query_token <> s.normalized_term
      order by similarity(q.query_token, s.normalized_term) desc,
               length(s.normalized_term) desc
      limit 1;
    end if;

    if matched_term is null then
      continue;
    end if;

    next_variants := variants;

    foreach base_variant in array variants
    loop
      if exact_match then
        if position(' ' || matched_term || ' ' in ' ' || base_variant || ' ') = 0 then
          continue;
        end if;
      elsif position(' ' || matched_token || ' ' in ' ' || base_variant || ' ') = 0 then
        continue;
      end if;

      for alternative in
        select s.normalized_term
        from private.search_synonyms s
        where s.group_key = group_row.group_key
        order by s.normalized_term
      loop
        candidate := replace(
          base_variant,
          case when exact_match then matched_term else matched_token end,
          alternative.normalized_term
        );

        if candidate <> '' and not candidate = any(next_variants) then
          next_variants := array_append(next_variants, candidate);
        end if;

        exit when cardinality(next_variants) >= 12;
      end loop;

      exit when cardinality(next_variants) >= 12;
    end loop;

    variants := next_variants;
    exit when cardinality(variants) >= 12;
  end loop;

  return variants;
end;
$function$;

create or replace function private.deba_detect_search_brands(input text)
returns text[]
language sql
stable
strict
security definer
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

-- The public RPC stays SECURITY INVOKER so public.products RLS is preserved.
-- It must not read private.search_synonyms directly; the brand predicates below
-- delegate those reads to the SECURITY DEFINER helpers above.
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
  strict_filtered as (
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
      and private.deba_product_has_all_brands(p.search_text, brand_groups)
  ),
  brand_fallback as (
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
    where normalized_query is not null
      and cardinality(brand_groups) > 0
      and p.status = 'published'
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
      and not exists (select 1 from strict_filtered)
      and private.deba_product_has_all_brands(p.search_text, brand_groups)
  ),
  filtered as (
    select * from strict_filtered
    union all
    select * from brand_fallback
  ),
  ranked as (
    select
      filtered.*,
      (
        case
          when normalized_query is null then 0
          when filtered.normalized_title = normalized_query then 8.0
          when position(' ' || normalized_query || ' ' in ' ' || filtered.normalized_title || ' ') > 0 then 4.5
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
          when private.deba_product_has_any_brand(filtered.normalized_title, brand_groups) then 3.0
          else 1.0
        end
        +
        case
          when filtered.product_category_id in (select ch.matched_category_id from category_hits as ch) then 0.35
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
    select ranked.*, count(*) over() as match_count
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

revoke execute on function private.deba_product_has_all_brands(text, text[]) from public, anon, authenticated;
revoke execute on function private.deba_product_has_any_brand(text, text[]) from public, anon, authenticated;
grant execute on function private.deba_product_has_all_brands(text, text[]) to anon, authenticated;
grant execute on function private.deba_product_has_any_brand(text, text[]) to anon, authenticated;

revoke select on private.search_synonyms from anon, authenticated;
revoke all on private.search_brand_groups from anon, authenticated;

notify pgrst, 'reload schema';

commit;
