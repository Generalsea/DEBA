-- DEBA analytics core: seller and admin metrics over real transactional data.

create or replace function private.get_seller_analytics(p_seller_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_seller_id is null or p_seller_id <> (select auth.uid()) then
    raise exception 'Authenticated seller is required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'ordersTotal',(select count(*) from public.orders o where o.seller_id=p_seller_id),
    'ordersCompleted',(select count(*) from public.orders o where o.seller_id=p_seller_id and o.status='completed'),
    'ordersOpen',(select count(*) from public.orders o where o.seller_id=p_seller_id and o.status in ('pending','confirmed','processing','ready','disputed')),
    'grossRevenue',coalesce((select sum(o.total) from public.orders o where o.seller_id=p_seller_id and o.status='completed' and o.payment_status in ('paid','partially_refunded','refunded')),0),
    'successfulRefunds',coalesce((select sum(r.amount) from public.refunds r join public.orders o on o.id=r.order_id where o.seller_id=p_seller_id and r.status='succeeded'),0),
    'publishedProducts',(select count(*) from public.products p where p.owner_id=p_seller_id and p.status='published' and p.moderation_status='approved' and p.listing_type='sale'),
    'productsSold',(select count(*) from public.products p where p.owner_id=p_seller_id and p.status='sold' and p.listing_type='sale'),
    'reviewsCount',(select count(*) from public.reviews r where r.seller_id=p_seller_id and r.status='published'),
    'averageRating',coalesce((select round(avg(r.rating)::numeric,2) from public.reviews r where r.seller_id=p_seller_id and r.status='published'),0),
    'disputesOpen',(select count(*) from public.disputes d join public.orders o on o.id=d.order_id where o.seller_id=p_seller_id and d.status in ('open','under_review')),
    'last30DaysGross',coalesce((select sum(o.total) from public.orders o where o.seller_id=p_seller_id and o.status='completed' and o.payment_status in ('paid','partially_refunded','refunded') and o.completed_at>=now()-interval '30 days'),0),
    'last30DaysOrders',(select count(*) from public.orders o where o.seller_id=p_seller_id and o.created_at>=now()-interval '30 days'),
    'topProducts',coalesce((
      select jsonb_agg(row_to_json(t) order by t.revenue desc) from (
        select p.id,p.title,p.slug,count(o.id)::integer as orders,coalesce(sum(o.total),0) as revenue,coalesce(sum(oi.quantity),0)::integer as units
        from public.orders o
        join public.order_items oi on oi.order_id=o.id
        join public.products p on p.id=oi.product_id
        where o.seller_id=p_seller_id and o.status='completed'
        group by p.id,p.title,p.slug
        order by revenue desc
        limit 8
      ) t
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_seller_analytics()
returns jsonb
language plpgsql
security invoker
set search_path='public','private','pg_temp'
as $$
begin
  return private.get_seller_analytics((select auth.uid()));
end;
$$;

revoke execute on function public.get_seller_analytics() from public, anon;
grant execute on function public.get_seller_analytics() to authenticated;

create or replace function private.get_admin_analytics()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_result jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'members',(select count(*) from public.profiles where is_public=true),
    'sellers',(select count(*) from public.profiles where is_public=true and account_type='seller'),
    'publishedProducts',(select count(*) from public.products where status='published' and moderation_status='approved' and listing_type='sale'),
    'pendingProducts',(select count(*) from public.products where moderation_status='pending' and listing_type='sale'),
    'orders',(select count(*) from public.orders),
    'completedOrders',(select count(*) from public.orders where status='completed'),
    'openDisputes',(select count(*) from public.disputes where status in ('open','under_review')),
    'openTickets',(select count(*) from public.support_tickets where status in ('open','in_progress','waiting_user')),
    'reviewsPending',(select count(*) from public.reviews where status='pending'),
    'reportsOpen',(select count(*) from public.reports where status='open'),
    'paidGross',coalesce((select sum(o.total) from public.orders o where o.payment_status in ('paid','partially_refunded','refunded')),0),
    'successfulRefunds',coalesce((select sum(amount) from public.refunds where status='succeeded'),0),
    'last30DaysOrders',(select count(*) from public.orders where created_at>=now()-interval '30 days'),
    'last30DaysGross',coalesce((select sum(o.total) from public.orders o where o.payment_status in ('paid','partially_refunded','refunded') and o.created_at>=now()-interval '30 days'),0),
    'daily30',coalesce((
      select jsonb_agg(row_to_json(t) order by t.day) from (
        select date_trunc('day',created_at)::date as day,count(*)::integer as orders,
               coalesce(sum(case when payment_status in ('paid','partially_refunded','refunded') then total else 0 end),0) as gross
        from public.orders
        where created_at>=now()-interval '30 days'
        group by 1
      ) t
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_admin_analytics()
returns jsonb
language plpgsql
security invoker
set search_path='public','private','pg_temp'
as $$
begin
  if current_user <> 'service_role' and not (select private.is_admin()) then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  return private.get_admin_analytics();
end;
$$;

revoke execute on function public.get_admin_analytics() from public, anon, authenticated;
grant execute on function public.get_admin_analytics() to authenticated, service_role;
