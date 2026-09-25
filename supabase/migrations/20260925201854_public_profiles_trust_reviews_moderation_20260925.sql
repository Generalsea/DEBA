begin;

-- PHASE 2 / STEP 4
-- Public trust projections, verified seller ratings, and moderation report lifecycle.

create or replace function private.get_seller_rating_summary(
  p_seller_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with published_reviews as (
    select rating
    from public.reviews
    where seller_id = p_seller_id
      and target_type = 'seller'
      and status = 'published'
  ),
  aggregate as (
    select
      count(*)::bigint as review_count,
      coalesce(round(avg(rating)::numeric, 2), 0)::numeric as average_rating,
      count(*) filter (where rating = 5)::bigint as rating_5,
      count(*) filter (where rating = 4)::bigint as rating_4,
      count(*) filter (where rating = 3)::bigint as rating_3,
      count(*) filter (where rating = 2)::bigint as rating_2,
      count(*) filter (where rating = 1)::bigint as rating_1
    from published_reviews
  ),
  verification as (
    select exists (
      select 1
      from public.seller_verifications sv
      where sv.user_id = p_seller_id
        and sv.status = 'verified'
    ) as verified_seller
  )
  select jsonb_build_object(
    'average_rating', aggregate.average_rating,
    'review_count', aggregate.review_count,
    'rating_5', aggregate.rating_5,
    'rating_4', aggregate.rating_4,
    'rating_3', aggregate.rating_3,
    'rating_2', aggregate.rating_2,
    'rating_1', aggregate.rating_1,
    'verified_seller', verification.verified_seller,
    'top_rated',
      aggregate.review_count >= 5
      and aggregate.average_rating >= 4.5
  )
  from aggregate cross join verification;
$function$;

create or replace function public.get_seller_rating_summary(
  p_seller_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_seller_rating_summary(p_seller_id);
$function$;

revoke execute on function public.get_seller_rating_summary(uuid) from public;
grant execute on function public.get_seller_rating_summary(uuid) to anon, authenticated;
revoke execute on function private.get_seller_rating_summary(uuid) from public;
grant execute on function private.get_seller_rating_summary(uuid) to anon, authenticated;

revoke insert, update, delete on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;

create index if not exists reports_product_status_created_idx
  on public.reports(product_id, status, created_at desc);

create index if not exists reports_reported_user_status_created_idx
  on public.reports(reported_user_id, status, created_at desc);

create or replace function private.auto_pause_reported_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_distinct_reporters integer;
  v_product public.products%rowtype;
begin
  if new.product_id is null or new.reported_user_id is null then
    return new;
  end if;

  select count(distinct reporter_id)::integer
    into v_distinct_reporters
  from public.reports
  where product_id = new.product_id
    and status in ('open', 'under_review')
    and reporter_id is not null;

  if v_distinct_reporters < 3 then
    return new;
  end if;

  select *
    into v_product
  from public.products
  where id = new.product_id
  for update;

  if not found then
    return new;
  end if;

  if v_product.status = 'published'
     and v_product.moderation_status = 'approved' then
    update public.products
    set
      status = 'paused',
      moderation_status = 'needs_changes',
      updated_at = now()
    where id = v_product.id;

    insert into public.admin_logs(
      actor_user_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data,
      metadata
    )
    values (
      null,
      'report.threshold_auto_pause',
      'product',
      v_product.id,
      jsonb_build_object(
        'status', v_product.status,
        'moderation_status', v_product.moderation_status
      ),
      jsonb_build_object(
        'status', 'paused',
        'moderation_status', 'needs_changes'
      ),
      jsonb_build_object(
        'distinct_reporters', v_distinct_reporters,
        'threshold', 3
      )
    );

    if v_product.owner_id is not null then
      insert into public.notifications(
        user_id, type, title, body, href, metadata
      )
      values (
        v_product.owner_id,
        'listing.auto_paused',
        'تم إيقاف الإعلان مؤقتًا',
        'تم إيقاف إعلانك تلقائيًا لحين مراجعة البلاغات المرتبطة به.',
        '/profile?tab=listings',
        jsonb_build_object(
          'product_id', v_product.id,
          'reason', 'report_threshold',
          'distinct_reporters', v_distinct_reporters
        )
      );
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_auto_pause_reported_product on public.reports;
create trigger trg_auto_pause_reported_product
after insert or update of status on public.reports
for each row
execute function private.auto_pause_reported_product();

revoke execute on function private.auto_pause_reported_product() from public;

create or replace function private.admin_update_report_status(
  p_report_id uuid,
  p_next_status text,
  p_note text
)
returns public.reports
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_report public.reports%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not private.is_admin() then
    raise exception 'Moderator access required' using errcode = '42501';
  end if;

  if p_next_status not in ('under_review', 'resolved', 'dismissed') then
    raise exception 'Invalid report status' using errcode = '22023';
  end if;

  select *
    into v_report
  from public.reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if p_next_status = 'under_review' and v_report.status <> 'open' then
    raise exception 'Only open reports can enter review' using errcode = '42501';
  end if;

  if p_next_status in ('resolved', 'dismissed')
     and v_report.status <> 'under_review' then
    raise exception 'Review the report before resolving or dismissing it' using errcode = '42501';
  end if;

  update public.reports
  set
    status = p_next_status,
    resolution_note =
      case
        when p_note is null or btrim(p_note) = '' then resolution_note
        else left(btrim(p_note), 2000)
      end,
    updated_at = now()
  where id = v_report.id
  returning * into v_report;

  return v_report;
end;
$function$;

create or replace function public.admin_update_report_status(
  p_report_id uuid,
  p_next_status text,
  p_note text
)
returns public.reports
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_report public.reports;
begin
  v_report := private.admin_update_report_status(
    p_report_id,
    p_next_status,
    p_note
  );
  return v_report;
end;
$function$;

revoke execute on function public.admin_update_report_status(uuid,text,text) from public, anon;
grant execute on function public.admin_update_report_status(uuid,text,text) to authenticated;
revoke execute on function private.admin_update_report_status(uuid,text,text) from public;
grant execute on function private.admin_update_report_status(uuid,text,text) to authenticated;

commit;
