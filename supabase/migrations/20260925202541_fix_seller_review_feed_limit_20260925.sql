begin;

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

commit;
