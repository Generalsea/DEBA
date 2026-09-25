
create extension if not exists pg_trgm;

create schema if not exists private;

create or replace function private.deba_normalize_arabic(input text)
returns text
language sql
immutable
strict
set search_path = private, extensions, pg_catalog
as $$
  select translate(
    lower(
      btrim(
        regexp_replace(
          regexp_replace(
            replace(replace(replace(replace(input, 'ﻷ', 'لا'), 'ﻹ', 'لا'), 'ﻵ', 'لا'), 'ﻼ', 'لا'),
            '[ًٌٍَُِّْٰٕٖٜٟٓٔٗ٘ٙٚٛٝٞـ]',
            '',
            'g'
          ),
          '[^[:alnum:][:space:]-]+',
          ' ',
          'g'
        )
      )
    ),
    'أإآٱىةؤئك',
    'اااايهويك'
  )
$$;

create table if not exists private.search_synonyms (
  group_key text not null,
  term text not null,
  normalized_term text generated always as (private.deba_normalize_arabic(term)) stored,
  created_at timestamptz not null default now(),
  primary key (group_key, term),
  unique (normalized_term)
);

insert into private.search_synonyms (group_key, term)
values
  ('phone', 'هاتف'),
  ('phone', 'موبايل'),
  ('phone', 'تليفون'),
  ('car', 'سيارة'),
  ('car', 'عربية'),
  ('laptop', 'لابتوب'),
  ('laptop', 'لاب توب'),
  ('laptop', 'كمبيوتر محمول'),
  ('television', 'تلفزيون'),
  ('television', 'شاشة'),
  ('refrigerator', 'ثلاجة'),
  ('refrigerator', 'تلاجة'),
  ('samsung', 'سامسونج'),
  ('samsung', 'ساسمونج'),
  ('samsung', 'سامسنج'),
  ('samsung', 'samsung'),
  ('apple', 'ابل'),
  ('apple', 'ايفون'),
  ('apple', 'iphone'),
  ('huawei', 'هواوي'),
  ('huawei', 'huawei'),
  ('xiaomi', 'شاومي'),
  ('xiaomi', 'xiaomi')
on conflict (group_key, term) do nothing;

create or replace function private.deba_expand_search_variants(input text)
returns text[]
language plpgsql
stable
strict
set search_path = private, extensions, pg_catalog
as $$
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
         from regexp_split_to_table(normalized, '\s+') as q(query_token)
         where length(q.query_token) >= 4
           and similarity(q.query_token, s.normalized_term) >= 0.55
           and q.query_token <> s.normalized_term
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
$$;

create or replace function private.deba_search_tsquery(input text)
returns tsquery
language plpgsql
stable
strict
set search_path = private, extensions, pg_catalog
as $$
declare
  variant text;
  result_query tsquery;
  variant_query tsquery;
begin
  if btrim(input) = '' then
    return null;
  end if;

  foreach variant in array private.deba_expand_search_variants(input)
  loop
    variant_query :=
      websearch_to_tsquery('arabic', variant)
      || websearch_to_tsquery('simple', variant);

    if result_query is null then
      result_query := variant_query;
    else
      result_query := result_query || variant_query;
    end if;
  end loop;

  return result_query;
end;
$$;

alter table public.products
  add column if not exists search_text text
  generated always as (
    private.deba_normalize_arabic(coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored;

alter table public.products
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('arabic', private.deba_normalize_arabic(coalesce(title, ''))), 'A')
    ||
    setweight(to_tsvector('simple', private.deba_normalize_arabic(coalesce(title, ''))), 'A')
    ||
    setweight(to_tsvector('arabic', private.deba_normalize_arabic(coalesce(description, ''))), 'C')
    ||
    setweight(to_tsvector('simple', private.deba_normalize_arabic(coalesce(description, ''))), 'C')
  ) stored;

alter table public.categories
  add column if not exists search_text text
  generated always as (
    private.deba_normalize_arabic(
      coalesce(name_ar, '') || ' ' ||
      coalesce(name_en, '') || ' ' ||
      coalesce(description_ar, '') || ' ' ||
      coalesce(description_en, '')
    )
  ) stored;

alter table public.categories
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('arabic', private.deba_normalize_arabic(
      coalesce(name_ar, '') || ' ' || coalesce(description_ar, '')
    )), 'A')
    ||
    setweight(to_tsvector('simple', private.deba_normalize_arabic(
      coalesce(name_en, '') || ' ' || coalesce(description_en, '')
    )), 'B')
  ) stored;

create index if not exists products_search_vector_gin_idx
  on public.products using gin (search_vector)
  where status = 'published'
    and moderation_status = 'approved'
    and listing_type = 'sale'
    and owner_id is not null
    and quantity > 0
    and price > 0;

create index if not exists products_search_text_trgm_idx
  on public.products using gin (search_text gin_trgm_ops)
  where status = 'published'
    and moderation_status = 'approved'
    and listing_type = 'sale'
    and owner_id is not null
    and quantity > 0
    and price > 0;

create index if not exists categories_search_vector_gin_idx
  on public.categories using gin (search_vector)
  where is_active = true;

create index if not exists categories_search_text_trgm_idx
  on public.categories using gin (search_text gin_trgm_ops)
  where is_active = true;

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

comment on function public.search_marketplace_products(
  text, integer, integer, text, numeric, numeric, text, text, text, text
) is 'DEBA Arabic/English FTS search with normalization, category matching, synonym expansion, typo-tolerant trigram fallback, relevance ranking, and marketplace safety filters.';
