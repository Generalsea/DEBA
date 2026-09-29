-- DEBA Phase 4.2: Dynamic Deal Matching & Smart Price Intelligence.
-- This migration is self-contained and safe to apply repeatedly.

create table if not exists public.buyer_intent_matches (
  id uuid primary key default gen_random_uuid(),
  saved_search_id uuid not null references public.saved_searches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  match_score numeric(6,2) not null check (match_score >= 0 and match_score <= 100),
  match_reason jsonb not null default '{}'::jsonb,
  matched_at timestamptz not null default now(),
  seen_at timestamptz null,
  notified_at timestamptz null,
  unique (saved_search_id, product_id)
);

alter table public.buyer_intent_matches enable row level security;

revoke all on public.buyer_intent_matches from anon, authenticated;
grant select on public.buyer_intent_matches to authenticated;

drop policy if exists buyer_intent_matches_owner_select on public.buyer_intent_matches;

create policy buyer_intent_matches_owner_select
on public.buyer_intent_matches
for select
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists buyer_intent_matches_user_matched_idx
  on public.buyer_intent_matches (user_id, matched_at desc);

create index if not exists buyer_intent_matches_saved_search_score_idx
  on public.buyer_intent_matches (saved_search_id, match_score desc, matched_at desc);

create index if not exists buyer_intent_matches_product_idx
  on public.buyer_intent_matches (product_id, matched_at desc);

create or replace function private.get_product_deal_score(p_product_id uuid)
returns table (
  product_id uuid,
  current_price numeric,
  currency text,
  condition_grade text,
  category_id uuid,
  average_price numeric,
  median_price numeric,
  p25_price numeric,
  p75_price numeric,
  peer_count integer,
  price_delta_pct numeric,
  deal_score numeric,
  deal_label text,
  confidence numeric,
  graph jsonb
)
language plpgsql
stable
security definer
set search_path = public, private, extensions, pg_catalog, pg_temp
as $$
declare
  v_target record;
  v_stats record;
  v_norm_title text;
  v_brands text[];
  v_bucket text;
  v_current numeric;
  v_delta numeric;
  v_label text;
  v_score numeric;
  v_confidence numeric;
begin
  select
    p.id,
    p.price,
    p.currency,
    p.condition_grade,
    p.category_id,
    private.deba_normalize_arabic(coalesce(p.title, '')) as normalized_title,
    coalesce(p.search_text, '') as search_text
  into v_target
  from public.products p
  where p.id = p_product_id
    and p.status = 'published'
    and p.moderation_status = 'approved'
    and p.listing_type = 'sale'
    and p.owner_id is not null
    and p.quantity > 0
    and p.price > 0;

  if not found then
    return;
  end if;

  v_norm_title := v_target.normalized_title;
  v_brands := private.deba_detect_search_brands(v_target.search_text);
  v_current := v_target.price;
  v_bucket := case
    when v_target.condition_grade = 'new' then 'new'
    when v_target.condition_grade is null then 'unknown'
    else 'used'
  end;

  with strict_peers as (
    select p.price
    from public.products p
    where p.id <> v_target.id
      and p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
      and p.owner_id is not null
      and p.quantity > 0
      and p.price > 0
      and p.currency = v_target.currency
      and (v_target.category_id is null or p.category_id = v_target.category_id)
      and (
        v_target.condition_grade is null
        or p.condition_grade = v_target.condition_grade
      )
      and (
        private.deba_normalize_arabic(coalesce(p.title, '')) = v_norm_title
        or word_similarity(
          v_norm_title,
          private.deba_normalize_arabic(coalesce(p.title, ''))
        ) >= 0.58
      )
  )
  select
    count(*)::integer as peer_count,
    avg(price)::numeric as average_price,
    percentile_cont(0.50) within group (order by price)::numeric as median_price,
    percentile_cont(0.25) within group (order by price)::numeric as p25_price,
    percentile_cont(0.75) within group (order by price)::numeric as p75_price
  into v_stats
  from strict_peers;

  if coalesce(v_stats.peer_count, 0) < 3
     and v_bucket <> 'unknown' then
    with broad_peers as (
      select p.price
      from public.products p
      where p.id <> v_target.id
        and p.status = 'published'
        and p.moderation_status = 'approved'
        and p.listing_type = 'sale'
        and p.owner_id is not null
        and p.quantity > 0
        and p.price > 0
        and p.currency = v_target.currency
        and (
          case
            when v_bucket = 'new' then p.condition_grade = 'new'
            else p.condition_grade in (
              'like_new','excellent','good','fair','poor','for_parts'
            )
          end
        )
        and (
          private.deba_normalize_arabic(coalesce(p.title, '')) = v_norm_title
          or word_similarity(
            v_norm_title,
            private.deba_normalize_arabic(coalesce(p.title, ''))
          ) >= 0.45
          or (
            cardinality(v_brands) > 0
            and private.deba_product_has_all_brands(
              coalesce(p.search_text, ''),
              v_brands
            )
          )
        )
    )
    select
      count(*)::integer as peer_count,
      avg(price)::numeric as average_price,
      percentile_cont(0.50) within group (order by price)::numeric as median_price,
      percentile_cont(0.25) within group (order by price)::numeric as p25_price,
      percentile_cont(0.75) within group (order by price)::numeric as p75_price
    into v_stats
    from broad_peers;
  end if;

  if coalesce(v_stats.peer_count, 0) > 0
     and v_stats.average_price is not null
     and v_stats.average_price > 0 then
    v_delta := ((v_current - v_stats.average_price) / v_stats.average_price) * 100;
  else
    v_delta := null;
  end if;

  if coalesce(v_stats.peer_count, 0) < 3 or v_delta is null then
    v_label := 'insufficient_data';
    v_score := null;
    v_confidence := 0;
  else
    v_label := case
      when v_delta <= -15 then 'great_deal'
      when v_delta <= 10 then 'fair'
      else 'overpriced'
    end;

    v_score := round(
      greatest(
        0::numeric,
        least(100::numeric, 50::numeric - (v_delta * 2))
      ),
      1
    );

    v_confidence := round(
      greatest(
        0::numeric,
        least(
          1::numeric,
          (v_stats.peer_count::numeric / 20)
          * greatest(
              0.25::numeric,
              1::numeric - least(
                0.75::numeric,
                greatest(
                  0::numeric,
                  (v_stats.p75_price - v_stats.p25_price)
                    / nullif(v_stats.average_price, 0)
                )
              )
            )
        )
      ),
      3
    );
  end if;

  return query
  select
    v_target.id,
    v_current,
    v_target.currency,
    v_target.condition_grade,
    v_target.category_id,
    v_stats.average_price,
    v_stats.median_price,
    v_stats.p25_price,
    v_stats.p75_price,
    coalesce(v_stats.peer_count, 0),
    v_delta,
    v_score,
    v_label,
    v_confidence,
    jsonb_build_object(
      'current', v_current,
      'p25', v_stats.p25_price,
      'median', v_stats.median_price,
      'average', v_stats.average_price,
      'p75', v_stats.p75_price,
      'peerCount', coalesce(v_stats.peer_count, 0)
    );
end;
$$;

revoke execute on function private.get_product_deal_score(uuid)
  from public, anon, authenticated;

create or replace function public.get_product_deal_score(p_product_id uuid)
returns table (
  product_id uuid,
  current_price numeric,
  currency text,
  condition_grade text,
  category_id uuid,
  average_price numeric,
  median_price numeric,
  p25_price numeric,
  p75_price numeric,
  peer_count integer,
  price_delta_pct numeric,
  deal_score numeric,
  deal_label text,
  confidence numeric,
  graph jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_product_deal_score(p_product_id);
$$;

revoke execute on function public.get_product_deal_score(uuid)
  from public, anon, authenticated;

grant execute on function public.get_product_deal_score(uuid)
  to anon, authenticated;

create or replace function private.persist_buyer_intent_matches(
  p_product_id uuid,
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog, pg_temp
as $$
declare
  v_inserted integer := 0;
begin
  with target as (
    select
      p.id,
      p.title,
      coalesce(p.search_text, '') as search_text,
      p.search_vector,
      p.category_id,
      p.price,
      p.currency,
      p.condition_grade,
      p.city,
      p.governorate,
      private.deba_normalize_arabic(coalesce(p.title, '')) as normalized_title
    from public.products p
    where p.id = p_product_id
      and p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
      and p.owner_id is not null
      and p.quantity > 0
      and p.price > 0
  ),
  candidates as (
    select
      s.id as saved_search_id,
      s.user_id,
      s.query,
      s.filters,
      t.*,
      private.deba_normalize_arabic(coalesce(s.query, '')) as normalized_query,
      private.deba_search_tsquery(coalesce(s.query, '')) as query_vector,
      private.deba_detect_search_brands(coalesce(s.query, '')) as brand_groups
    from public.saved_searches s
    cross join target t
    where s.alert_frequency <> 'off'
      and (
        nullif(trim(coalesce(s.query, '')), '') is null
        or (
          (
            t.normalized_title = private.deba_normalize_arabic(coalesce(s.query, ''))
            or position(
              ' ' || private.deba_normalize_arabic(coalesce(s.query, '')) || ' '
              in ' ' || t.normalized_title || ' '
            ) > 0
            or (
              t.search_text % private.deba_normalize_arabic(coalesce(s.query, ''))
            )
            or (
              t.search_vector is not null
              and t.search_vector @@ private.deba_search_tsquery(coalesce(s.query, ''))
            )
          )
          and private.deba_product_has_all_brands(
            t.search_text,
            private.deba_detect_search_brands(coalesce(s.query, ''))
          )
        )
      )
      and (
        nullif(
          coalesce(
            s.filters ->> 'category_slug',
            s.filters ->> 'categorySlug',
            s.filters ->> 'category'
          ),
          ''
        ) is null
        or exists (
          select 1
          from public.categories c
          where c.id = t.category_id
            and c.is_active = true
            and c.slug = coalesce(
              s.filters ->> 'category_slug',
              s.filters ->> 'categorySlug',
              s.filters ->> 'category'
            )
        )
      )
      and (
        nullif(
          coalesce(s.filters ->> 'min_price', s.filters ->> 'minPrice'),
          ''
        ) is null
        or case
          when coalesce(s.filters ->> 'min_price', s.filters ->> 'minPrice')
            ~ '^[0-9]+(\\.[0-9]+)?$'
          then t.price >= coalesce(
            s.filters ->> 'min_price',
            s.filters ->> 'minPrice'
          )::numeric
          else true
        end
      )
      and (
        nullif(
          coalesce(s.filters ->> 'max_price', s.filters ->> 'maxPrice'),
          ''
        ) is null
        or case
          when coalesce(s.filters ->> 'max_price', s.filters ->> 'maxPrice')
            ~ '^[0-9]+(\\.[0-9]+)?$'
          then t.price <= coalesce(
            s.filters ->> 'max_price',
            s.filters ->> 'maxPrice'
          )::numeric
          else true
        end
      )
      and (
        nullif(s.filters ->> 'condition', '') is null
        or s.filters ->> 'condition' = t.condition_grade
        or (
          s.filters ->> 'condition' = 'new'
          and t.condition_grade = 'new'
        )
        or (
          s.filters ->> 'condition' = 'used'
          and t.condition_grade in (
            'like_new','excellent','good','fair','poor','for_parts'
          )
        )
      )
      and (
        nullif(s.filters ->> 'governorate', '') is null
        or t.governorate ilike s.filters ->> 'governorate'
      )
      and (
        nullif(s.filters ->> 'city', '') is null
        or t.city ilike s.filters ->> 'city'
      )
  ),
  scored as (
    select
      c.saved_search_id,
      c.user_id,
      c.id as product_id,
      least(
        100::numeric,
        round(
          greatest(
            0::numeric,
            (
              case
                when nullif(trim(coalesce(c.query, '')), '') is null then 8
                when c.normalized_title = c.normalized_query then 18
                when position(
                  ' ' || c.normalized_query || ' '
                  in ' ' || c.normalized_title || ' '
                ) > 0 then 14
                when c.search_text % c.normalized_query then 9
                when c.search_vector is not null
                  and c.search_vector @@ c.query_vector then 8
                else 5
              end
              + case
                  when cardinality(c.brand_groups) > 0
                    and private.deba_product_has_all_brands(
                      c.search_text,
                      c.brand_groups
                    ) then 4
                  else 0
                end
              + case
                  when nullif(
                    coalesce(
                      c.filters ->> 'category_slug',
                      c.filters ->> 'categorySlug',
                      c.filters ->> 'category'
                    ),
                    ''
                  ) is not null then 2
                  else 0
                end
              + case
                  when nullif(c.filters ->> 'city', '') is not null then 2
                  when nullif(c.filters ->> 'governorate', '') is not null then 1
                  else 0
                end
            ) * 5
          ),
          2
        )
      ) as match_score,
      jsonb_build_object(
        'engine', 'deba-phase-4.2-v1',
        'query', c.query,
        'filters', c.filters,
        'categoryMatched', nullif(
          coalesce(
            c.filters ->> 'category_slug',
            c.filters ->> 'categorySlug',
            c.filters ->> 'category'
          ),
          ''
        ) is not null,
        'locationMatched', (
          nullif(c.filters ->> 'city', '') is not null
          or nullif(c.filters ->> 'governorate', '') is not null
        )
      ) as match_reason
    from candidates c
  )
  insert into public.buyer_intent_matches (
    saved_search_id,
    user_id,
    product_id,
    match_score,
    match_reason,
    matched_at
  )
  select
    s.saved_search_id,
    s.user_id,
    s.product_id,
    s.match_score,
    s.match_reason,
    now()
  from scored s
  where s.match_score >= 50
  order by s.match_score desc
  limit greatest(1, least(coalesce(p_limit, 500), 500))
  on conflict (saved_search_id, product_id) do update
  set
    match_score = excluded.match_score,
    match_reason = excluded.match_reason,
    matched_at = excluded.matched_at;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke execute on function private.persist_buyer_intent_matches(uuid, integer)
  from public, anon, authenticated;

create or replace function public.process_buyer_intent_matches(
  p_product_id uuid,
  p_limit integer default 500
)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.persist_buyer_intent_matches(p_product_id, p_limit);
$$;

revoke execute on function public.process_buyer_intent_matches(uuid, integer)
  from public, anon, authenticated;

grant execute on function public.process_buyer_intent_matches(uuid, integer)
  to service_role;

create or replace function private.enqueue_buyer_intent_match()
returns trigger
language plpgsql
security definer
set search_path = public, private, vault, net, pg_catalog, pg_temp
as $$
declare
  v_endpoint text;
  v_secret text;
begin
  if not (
    new.status = 'published'
    and new.moderation_status = 'approved'
    and new.listing_type = 'sale'
    and new.owner_id is not null
    and new.quantity > 0
    and new.price > 0
  ) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status = new.status
     and old.moderation_status = new.moderation_status then
    return new;
  end if;

  select
    max(ds.decrypted_secret) filter (
      where ds.name = 'deba_buyer_intent_webhook_url'
    ),
    max(ds.decrypted_secret) filter (
      where ds.name = 'deba_buyer_intent_webhook_secret'
    )
  into v_endpoint, v_secret
  from vault.decrypted_secrets ds
  where ds.name in (
    'deba_buyer_intent_webhook_url',
    'deba_buyer_intent_webhook_secret'
  );

  if nullif(trim(v_endpoint), '') is null
     or nullif(v_secret, '') is null then
    return new;
  end if;

  begin
    perform net.http_post(
      url := v_endpoint,
      body := jsonb_build_object(
        'product_id', new.id,
        'requested_at', now()
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-deba-buyer-intent-secret', v_secret
      ),
      timeout_milliseconds := 2000
    );
  exception
    when others then
      raise warning 'DEBA buyer intent enqueue failed: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke execute on function private.enqueue_buyer_intent_match()
  from public, anon, authenticated;

drop trigger if exists products_enqueue_buyer_intent_match on public.products;

create trigger products_enqueue_buyer_intent_match
after insert or update of status, moderation_status, listing_type, owner_id, quantity, price
on public.products
for each row
execute function private.enqueue_buyer_intent_match();

create or replace function public.get_buyer_intent_matches(
  p_limit integer default 50
)
returns table (
  id uuid,
  saved_search_id uuid,
  product_id uuid,
  match_score numeric,
  match_reason jsonb,
  matched_at timestamptz,
  seen_at timestamptz,
  title text,
  slug text,
  price numeric,
  currency text,
  condition_grade text,
  city text,
  governorate text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.saved_search_id,
    m.product_id,
    m.match_score,
    m.match_reason,
    m.matched_at,
    m.seen_at,
    p.title,
    p.slug,
    p.price,
    p.currency,
    p.condition_grade,
    p.city,
    p.governorate
  from public.buyer_intent_matches m
  join public.products p on p.id = m.product_id
  where m.user_id = (select auth.uid())
    and p.status = 'published'
    and p.moderation_status = 'approved'
    and p.listing_type = 'sale'
  order by m.matched_at desc, m.match_score desc
  limit greatest(1, least(coalesce(p_limit, 50), 50));
$$;

revoke execute on function public.get_buyer_intent_matches(integer)
  from public, anon;

grant execute on function public.get_buyer_intent_matches(integer)
  to authenticated;
