begin;

create or replace function private.update_seller_listing(
  p_product_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_quantity integer,
  p_city text,
  p_governorate text,
  p_district text
)
returns public.products
language plpgsql
volatile
security definer
set search_path = public, private, pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_product public.products%rowtype;
begin
  if v_uid is null then
    raise exception 'Authenticated seller is required' using errcode = '42501';
  end if;

  select p.* into v_product
  from public.products p
  where p.id = p_product_id and p.owner_id = v_uid
  for update;

  if not found then
    raise exception 'Listing not found or not owned by seller' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.account_type = 'seller'
  ) then
    raise exception 'Seller account is required' using errcode = '42501';
  end if;

  if v_product.status in ('sold', 'archived') then
    raise exception 'Sold or archived listings must be restored before editing';
  end if;

  if p_title is null or length(btrim(p_title)) < 10 or length(btrim(p_title)) > 120 then
    raise exception 'Listing title must contain between 10 and 120 characters';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'Listing price must be greater than zero';
  end if;

  if p_quantity is null or p_quantity < 0 then
    raise exception 'Listing quantity cannot be negative';
  end if;

  set local deba.lifecycle_override = '1';

  update public.products
  set
    title = btrim(p_title),
    description = case
      when p_description is null then v_product.description
      else nullif(btrim(p_description), '')
    end,
    price = p_price,
    quantity = p_quantity,
    city = nullif(btrim(coalesce(p_city, '')), ''),
    governorate = nullif(btrim(coalesce(p_governorate, '')), ''),
    district = nullif(btrim(coalesce(p_district, '')), ''),
    updated_at = now(),
    status = 'draft',
    moderation_status = 'pending'
  where id = v_product.id;

  select p.* into v_product
  from public.products p
  where p.id = v_product.id;

  return v_product;
end;
$function$;

commit;