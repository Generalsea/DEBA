begin;

-- Public review feeds expose only safe presentation fields. Transaction
-- identifiers and internal reviewer IDs stay behind SECURITY DEFINER functions.

create or replace function private.get_product_review_feed(
  p_product_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_reviews jsonb;
  v_breakdown jsonb;
  v_count bigint;
  v_average numeric;
  v_review_order_id uuid;
  v_can_review boolean := false;
  v_pending_mine boolean := false;
begin
  if p_product_id is null then
    return jsonb_build_object(
      'reviews', '[]'::jsonb,
      'average_rating', 0,
      'review_count', 0,
      'breakdown', '[]'::jsonb,
      'can_review', false,
      'review_order_id', null,
      'pending_mine', false
    );
  end if;

  select count(*)::bigint, coalesce(round(avg(r.rating)::numeric,2),0)
  into v_count, v_average
  from public.reviews r
  where r.product_id = p_product_id
    and r.target_type = 'product'
    and r.status = 'published';

  select jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'rating', r.rating,
      'title', r.title,
      'body', r.body,
      'verifiedPurchase', r.verified_purchase,
      'createdAt', r.created_at,
      'reviewer',
        jsonb_build_object(
          'display_name',
            case when coalesce(p.is_public,false) then p.display_name else null end,
          'username',
            case when coalesce(p.is_public,false) then p.username else null end,
          'avatar_url',
            case when coalesce(p.is_public,false) then p.avatar_url else null end
        )
    )
    order by r.created_at desc
  )
  into v_reviews
  from public.reviews r
  left join public.profiles p on p.id = r.reviewer_id
  where r.product_id = p_product_id
    and r.target_type = 'product'
    and r.status = 'published';

  select jsonb_agg(
    jsonb_build_object(
      'rating', s.rating,
      'count', s.count
    )
    order by s.rating
  )
  into v_breakdown
  from (
    select gs.rating, count(r.id)::bigint as count
    from generate_series(1,5) as gs(rating)
    left join public.reviews r
      on r.product_id = p_product_id
     and r.target_type = 'product'
     and r.status = 'published'
     and r.rating = gs.rating
    group by gs.rating
  ) s;

  if v_uid is not null then
    v_pending_mine := exists (
      select 1
      from public.reviews r
      where r.reviewer_id = v_uid
        and r.product_id = p_product_id
        and r.target_type = 'product'
        and r.status = 'pending'
    );

    select oi.order_id
    into v_review_order_id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = p_product_id
      and o.buyer_id = v_uid
      and o.status = 'completed'
      and not exists (
        select 1
        from public.reviews r
        where r.reviewer_id = v_uid
          and r.order_id = oi.order_id
          and r.target_type = 'product'
          and r.target_id = p_product_id
      )
    order by o.completed_at desc nulls last, o.created_at desc
    limit 1;

    v_can_review := v_review_order_id is not null;
  end if;

  return jsonb_build_object(
    'reviews', coalesce(v_reviews, '[]'::jsonb),
    'average_rating', v_average,
    'review_count', v_count,
    'breakdown', coalesce(v_breakdown, '[]'::jsonb),
    'can_review', v_can_review,
    'review_order_id', v_review_order_id,
    'pending_mine', v_pending_mine
  );
end;
$function$;

create or replace function public.get_product_review_feed(
  p_product_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_product_review_feed(p_product_id);
$function$;

create or replace function private.get_seller_review_feed(
  p_seller_id uuid,
  p_limit integer default 6
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'rating', r.rating,
          'title', r.title,
          'body', r.body,
          'verifiedPurchase', r.verified_purchase,
          'createdAt', r.created_at,
          'reviewer',
            jsonb_build_object(
              'display_name',
                case when coalesce(p.is_public,false) then p.display_name else null end,
              'username',
                case when coalesce(p.is_public,false) then p.username else null end,
              'avatar_url',
                case when coalesce(p.is_public,false) then p.avatar_url else null end
            )
        )
        order by r.created_at desc
      )
      from (
        select id,rating,title,body,verified_purchase,created_at,reviewer_id
        from public.reviews
        where seller_id = p_seller_id
          and target_type = 'seller'
          and status = 'published'
        order by created_at desc
        limit greatest(1, least(coalesce(p_limit,6), 12))
      ) r
      left join public.profiles p on p.id = r.reviewer_id
    ),
    '[]'::jsonb
  );
$function$;

create or replace function public.get_seller_review_feed(
  p_seller_id uuid,
  p_limit integer default 6
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_seller_review_feed(p_seller_id, p_limit);
$function$;

revoke select on public.reviews from anon, authenticated;
grant select on public.reviews to service_role;

revoke execute on function private.get_product_review_feed(uuid) from public;
grant execute on function private.get_product_review_feed(uuid) to anon, authenticated;

revoke execute on function private.get_seller_review_feed(uuid, integer) from public;
grant execute on function private.get_seller_review_feed(uuid, integer) to anon, authenticated;

revoke execute on function public.get_product_review_feed(uuid) from public;
grant execute on function public.get_product_review_feed(uuid) to anon, authenticated;

revoke execute on function public.get_seller_review_feed(uuid, integer) from public;
grant execute on function public.get_seller_review_feed(uuid, integer) to anon, authenticated;

commit;
