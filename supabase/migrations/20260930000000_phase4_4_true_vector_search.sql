-- DEBA Phase 4.4 — True Semantic Vector Search
-- Provider-agnostic vector storage + HNSW + hybrid RRF search.
-- This migration is intentionally isolated on the Phase 4.4 branch.

create extension if not exists vector with schema extensions;

create table if not exists private.product_embeddings (
  product_id uuid primary key references public.products(id) on delete cascade,
  embedding extensions.vector(1536) not null,
  embedding_model text not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  searchable_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.product_embeddings enable row level security;

revoke all on table private.product_embeddings from public, anon, authenticated;
grant all on table private.product_embeddings to service_role;

create index if not exists product_embeddings_active_hnsw_idx
  on private.product_embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where searchable_active = true and embedding is not null;

create index if not exists product_embeddings_model_hash_idx
  on private.product_embeddings (embedding_model, source_hash);

create or replace function private.product_embedding_source_text(p_product_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select
    concat_ws(
      E'\n',
      coalesce(p.title, ''),
      coalesce(p.description, ''),
      coalesce(p.condition_details, ''),
      concat_ws(' ', coalesce(p.city, ''), coalesce(p.governorate, ''), coalesce(p.district, '')),
      coalesce(c.name_ar, ''),
      coalesce(c.name_en, ''),
      coalesce((p.metadata->'specifications')::text, ''),
      coalesce((p.metadata->'commerce')::text, '')
    )
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.id = p_product_id;
$function$;

revoke execute on function private.product_embedding_source_text(uuid)
  from public, anon, authenticated;

create or replace function private.product_embedding_is_searchable(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
      and p.owner_id is not null
      and p.quantity > 0
      and p.price > 0
  );
$function$;

revoke execute on function private.product_embedding_is_searchable(uuid)
  from public, anon, authenticated;

create or replace function private.sync_product_embedding_searchability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current_source_hash text;
begin
  v_current_source_hash := encode(
    extensions.digest(
      convert_to(private.product_embedding_source_text(new.id), 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  update private.product_embeddings e
  set
    searchable_active = (
      new.status = 'published'
      and new.moderation_status = 'approved'
      and new.listing_type = 'sale'
      and new.owner_id is not null
      and new.quantity > 0
      and new.price > 0
      and e.source_hash = v_current_source_hash
    ),
    updated_at = now()
  where e.product_id = new.id;

  return new;
end;
$function$;

drop trigger if exists products_sync_embedding_searchability on public.products;
create trigger products_sync_embedding_searchability
after insert or update of
  status,
  moderation_status,
  listing_type,
  owner_id,
  quantity,
  price,
  title,
  description,
  condition_details,
  city,
  governorate,
  district,
  category_id,
  metadata
on public.products
for each row
execute function private.sync_product_embedding_searchability();

revoke execute on function private.sync_product_embedding_searchability()
  from public, anon, authenticated;

create or replace function public.upsert_product_embedding(
  p_product_id uuid,
  p_embedding text,
  p_model text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_embedding extensions.vector(1536);
  v_source_text text;
  v_source_hash text;
  v_searchable boolean;
  v_existing_model text;
begin
  if p_product_id is null then
    raise exception 'Product id is required';
  end if;

  if p_embedding is null or btrim(p_embedding) = '' then
    raise exception 'Embedding is required';
  end if;

  if p_model is null or length(btrim(p_model)) < 2 or length(btrim(p_model)) > 120 then
    raise exception 'Embedding model is invalid';
  end if;

  v_embedding := p_embedding::extensions.vector(1536);

  select private.product_embedding_source_text(p_product_id)
    into v_source_text;

  if v_source_text is null then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  v_source_hash := encode(
    extensions.digest(convert_to(v_source_text, 'UTF8'), 'sha256'),
    'hex'
  );

  v_searchable := private.product_embedding_is_searchable(p_product_id);

  select embedding_model into v_existing_model
  from private.product_embeddings
  where product_id = p_product_id;

  insert into private.product_embeddings(
    product_id,
    embedding,
    embedding_model,
    source_hash,
    searchable_active,
    created_at,
    updated_at
  )
  values(
    p_product_id,
    v_embedding,
    btrim(p_model),
    v_source_hash,
    v_searchable,
    now(),
    now()
  )
  on conflict(product_id) do update
  set
    embedding = excluded.embedding,
    embedding_model = excluded.embedding_model,
    source_hash = excluded.source_hash,
    searchable_active = excluded.searchable_active,
    updated_at = now();

  return jsonb_build_object(
    'productId', p_product_id,
    'embeddingDimensions', 1536,
    'embeddingModel', btrim(p_model),
    'searchableActive', v_searchable,
    'sourceHash', v_source_hash,
    'modelChanged', v_existing_model is not null and v_existing_model <> btrim(p_model)
  );
end;
$function$;

revoke execute on function public.upsert_product_embedding(uuid,text,text)
  from public, anon, authenticated;

grant execute on function public.upsert_product_embedding(uuid,text,text)
  to service_role;

create or replace function public.get_product_embedding_source(p_product_id uuid)
returns text
language sql
security definer
set search_path = ''
as $function$
  select private.product_embedding_source_text(p_product_id);
$function$;

revoke execute on function public.get_product_embedding_source(uuid)
  from public, anon, authenticated;

grant execute on function public.get_product_embedding_source(uuid)
  to service_role;


create or replace function private.semantic_search_product_ids(
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 200,
  p_category_slug text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_condition text default null,
  p_governorate text default null,
  p_city text default null
)
returns table(
  product_id uuid,
  semantic_rank integer,
  cosine_distance real,
  cosine_similarity real
)
language sql
stable
security definer
set search_path = ''
set hnsw.iterative_scan = strict_order
set hnsw.max_scan_tuples = 20000
as $function$
  with nearest as (
    select
      e.product_id,
      (e.embedding operator(extensions.<=>) p_query_embedding)::real as distance
    from private.product_embeddings e
    join public.products p on p.id = e.product_id
    left join public.categories c on c.id = p.category_id
    where e.searchable_active = true
      and e.embedding is not null
      and p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
      and p.owner_id is not null
      and p.quantity > 0
      and p.price > 0
      and (p_category_slug is null or c.slug = p_category_slug)
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (p_condition is null or p.condition_grade = any(string_to_array(p_condition, ',')))
      and (p_governorate is null or p.governorate ilike p_governorate)
      and (p_city is null or p.city ilike p_city)
    order by e.embedding operator(extensions.<=>) p_query_embedding
    limit greatest(1, least(coalesce(p_match_count, 200), 1000))
  )
  select
    nearest.product_id,
    row_number() over (order by nearest.distance, nearest.product_id)::integer as semantic_rank,
    nearest.distance,
    (1.0 - nearest.distance)::real as cosine_similarity
  from nearest;
$function$;

revoke execute on function private.semantic_search_product_ids(
  extensions.vector, integer, text, numeric, numeric, text, text, text
) from public, anon, authenticated;

create or replace function public.search_marketplace_hybrid(
  p_query text,
  p_query_embedding text default null,
  p_limit integer default 36,
  p_offset integer default 0,
  p_category_slug text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_condition text default null,
  p_governorate text default null,
  p_city text default null,
  p_rrf_k integer default 60
)
returns table(
  product_id uuid,
  product_owner_id uuid,
  product_title text,
  product_slug text,
  product_description text,
  product_price numeric,
  product_currency text,
  product_condition_grade text,
  product_city text,
  product_governorate text,
  product_published_at timestamptz,
  product_created_at timestamptz,
  product_category_id uuid,
  product_quantity integer,
  hybrid_relevance double precision,
  lexical_rank integer,
  trigram_rank integer,
  semantic_rank integer,
  semantic_similarity real,
  match_count bigint
)
language sql
stable
security invoker
set search_path = 'public', 'private', 'extensions', 'pg_catalog'
as $function$
  with params as (
    select
      nullif(private.deba_normalize_arabic(coalesce(p_query, '')), '') as normalized_query,
      private.deba_search_tsquery(
        nullif(private.deba_normalize_arabic(coalesce(p_query, '')), '')
      ) as tsquery,
      case
        when p_query_embedding is null or btrim(p_query_embedding) = '' then null
        else p_query_embedding::extensions.vector(1536)
      end as query_embedding,
      greatest(1, least(coalesce(p_limit, 36), 100))::integer as safe_limit,
      greatest(0, least(coalesce(p_offset, 0), 10000))::integer as safe_offset,
      greatest(1, least(coalesce(p_rrf_k, 60), 1000))::integer as safe_rrf_k
  ),
  filtered as (
    select
      p.id,
      p.owner_id,
      p.title,
      p.slug,
      p.description,
      p.price,
      p.currency,
      p.condition_grade,
      p.city,
      p.governorate,
      p.published_at,
      p.created_at,
      p.category_id,
      p.quantity,
      p.search_text,
      p.search_vector
    from public.products p
    left join public.categories c on c.id = p.category_id
    cross join params
    where p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
      and p.owner_id is not null
      and p.quantity > 0
      and p.price > 0
      and (p_category_slug is null or c.slug = p_category_slug)
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (
        p_condition is null
        or p.condition_grade = any(string_to_array(p_condition, ','))
      )
      and (p_governorate is null or p.governorate ilike p_governorate)
      and (p_city is null or p.city ilike p_city)
  ),
  lexical as (
    select
      f.id as product_id,
      row_number() over (
        order by ts_rank_cd(
          f.search_vector,
          params.tsquery,
          32
        ) desc,
        f.id
      )::integer as rank_ix
    from filtered f
    cross join params
    where params.tsquery is not null
      and f.search_vector operator(pg_catalog.@@) params.tsquery
    order by ts_rank_cd(f.search_vector, params.tsquery, 32) desc, f.id
    limit 200
  ),
  trigram as (
    select
      f.id as product_id,
      row_number() over (
        order by extensions.word_similarity(params.normalized_query, f.search_text) desc,
        f.id
      )::integer as rank_ix
    from filtered f
    cross join params
    where params.normalized_query is not null
      and extensions.word_similarity(params.normalized_query, f.search_text) > 0
    order by extensions.word_similarity(params.normalized_query, f.search_text) desc, f.id
    limit 200
  ),
  semantic as (
    select s.*
    from params
    cross join lateral private.semantic_search_product_ids(
      params.query_embedding,
      200,
      p_category_slug,
      p_min_price,
      p_max_price,
      p_condition,
      p_governorate,
      p_city
    ) s
    where params.query_embedding is not null
  ),
  fused as (
    select
      coalesce(lexical.product_id, trigram.product_id, semantic.product_id) as product_id,
      lexical.rank_ix as lexical_rank,
      trigram.rank_ix as trigram_rank,
      semantic.semantic_rank,
      semantic.cosine_similarity,
      (
        case
          when lexical.rank_ix is null then 0
          else 1.0 / (params.safe_rrf_k + lexical.rank_ix)
        end
        +
        case
          when trigram.rank_ix is null then 0
          else 1.0 / (params.safe_rrf_k + trigram.rank_ix)
        end
        +
        case
          when semantic.semantic_rank is null then 0
          else 1.0 / (params.safe_rrf_k + semantic.semantic_rank)
        end
      )::double precision as hybrid_relevance
    from lexical
    full join trigram on trigram.product_id = lexical.product_id
    full join semantic on semantic.product_id = coalesce(lexical.product_id, trigram.product_id)
    cross join params
  ),
  ranked as (
    select
      f.*,
      count(*) over() as match_count
    from fused f
  )
  select
    r.product_id,
    p.owner_id,
    p.title,
    p.slug,
    p.description,
    p.price,
    p.currency,
    p.condition_grade,
    p.city,
    p.governorate,
    p.published_at,
    p.created_at,
    p.category_id,
    p.quantity,
    r.hybrid_relevance,
    r.lexical_rank,
    r.trigram_rank,
    r.semantic_rank,
    r.cosine_similarity,
    r.match_count
  from ranked r
  join public.products p on p.id = r.product_id
  order by r.hybrid_relevance desc,
           r.semantic_rank asc nulls last,
           r.lexical_rank asc nulls last,
           r.trigram_rank asc nulls last,
           p.published_at desc nulls last,
           p.created_at desc,
           p.id desc
  limit (select safe_limit from params)
  offset (select safe_offset from params);
$function$;

revoke execute on function public.search_marketplace_hybrid(
  text, text, integer, integer, text, numeric, numeric, text, text, text, integer
) from public, anon;

grant execute on function public.search_marketplace_hybrid(
  text, text, integer, integer, text, numeric, numeric, text, text, text, integer
) to authenticated;

notify pgrst, 'reload schema';
