begin;

create or replace function private.record_product_view(
  p_product_id uuid,
  p_visitor_key text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_viewer_id uuid := auth.uid();
begin
  if p_product_id is null then
    return false;
  end if;

  if p_visitor_key is null
     or length(p_visitor_key) < 16
     or length(p_visitor_key) > 128
  then
    raise exception 'Invalid product visitor key';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.product_views pv
    where pv.product_id = p_product_id
      and pv.visitor_key = p_visitor_key
      and pv.viewed_at > now() - interval '30 minutes'
  ) then
    return false;
  end if;

  insert into public.product_views (
    product_id, viewer_id, visitor_key, viewed_at
  )
  values (
    p_product_id, v_viewer_id, p_visitor_key, now()
  );

  return true;
end;
$function$;

create or replace function public.record_product_view(
  p_product_id uuid,
  p_visitor_key text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.record_product_view(p_product_id, p_visitor_key);
$function$;

commit;