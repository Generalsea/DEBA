-- DEBA structured media integrity hardening
-- Enforces 3-8 images, exactly one primary image, and usable alt text.

create or replace function private.enforce_published_product_images()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_product uuid := coalesce(new.product_id, old.product_id);
  product_status text;
  version smallint;
  image_count integer;
  primary_count integer;
  bad_alt_count integer;
begin
  select status, details_schema_version
    into product_status, version
  from public.products
  where id = target_product;

  if product_status = 'published' and version = 1 then
    select count(*),
           count(*) filter (where is_primary = true),
           count(*) filter (where length(btrim(coalesce(alt_text,''))) < 5)
      into image_count, primary_count, bad_alt_count
    from public.product_images
    where product_id = target_product;

    if image_count < 3 then raise exception 'PRODUCT_DETAILS_INCOMPLETE: images_min_3'; end if;
    if image_count > 8 then raise exception 'PRODUCT_DETAILS_INCOMPLETE: images_max_8'; end if;
    if primary_count <> 1 then raise exception 'PRODUCT_DETAILS_INCOMPLETE: primary_image_exactly_one'; end if;
    if bad_alt_count > 0 then raise exception 'PRODUCT_DETAILS_INCOMPLETE: image_alt_text'; end if;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function private.validate_product_for_publish(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  p public.products%rowtype;
  missing text[] := '{}';
  missing_specs text;
  image_count integer;
  primary_image_count integer;
  bad_alt_count integer;
begin
  select * into p from public.products where id = p_product_id;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  if length(btrim(coalesce(p.title,''))) < 10 or length(btrim(p.title)) > 120 then missing := array_append(missing,'title'); end if;
  if length(btrim(coalesce(p.description,''))) < 200 then missing := array_append(missing,'description'); end if;
  if p.category_id is null then missing := array_append(missing,'category_id'); end if;
  if p.condition_grade is null then missing := array_append(missing,'condition_grade'); end if;
  if length(btrim(coalesce(p.condition_details,''))) < 30 then missing := array_append(missing,'condition_details'); end if;
  if p.price is null or p.price <= 0 then missing := array_append(missing,'price'); end if;
  if length(btrim(coalesce(p.governorate,''))) < 2 then missing := array_append(missing,'governorate'); end if;
  if length(btrim(coalesce(p.city,''))) < 2 then missing := array_append(missing,'city'); end if;
  if length(btrim(coalesce(p.district,''))) < 2 then missing := array_append(missing,'district'); end if;
  if p.delivery_method is null or length(btrim(p.delivery_method)) = 0 then missing := array_append(missing,'delivery_method'); end if;
  if length(btrim(coalesce(p.metadata->'identification'->>'origin',''))) < 2 then missing := array_append(missing,'identification.origin'); end if;
  if length(btrim(coalesce(p.metadata->'commerce'->>'seller_declaration',''))) < 30 then missing := array_append(missing,'commerce.seller_declaration'); end if;
  if p.metadata->'commerce'->'declaration'->>'accepted' <> 'true'
     or length(btrim(coalesce(p.metadata->'commerce'->'declaration'->>'version',''))) = 0 then missing := array_append(missing,'commerce.declaration'); end if;
  if (p.metadata->'commerce'->'returns'->>'eligible') is null
     or (p.metadata->'commerce'->'returns'->>'window_days') is null
     or length(btrim(coalesce(p.metadata->'commerce'->'returns'->>'conditions',''))) < 20 then missing := array_append(missing,'commerce.returns'); end if;
  if (p.metadata->'commerce'->'warranty'->>'type') is null
     or (p.metadata->'commerce'->'warranty'->>'duration_days') is null
     or length(btrim(coalesce(p.metadata->'commerce'->'warranty'->>'details',''))) < 20 then missing := array_append(missing,'commerce.warranty'); end if;
  if length(btrim(coalesce(p.metadata->'commerce'->'authenticity'->>'declaration',''))) < 30 then missing := array_append(missing,'commerce.authenticity'); end if;
  if (p.metadata->'commerce'->'shipping'->>'cost_type') is null
     or length(btrim(coalesce(p.metadata->'commerce'->'shipping'->>'details',''))) < 20 then missing := array_append(missing,'commerce.shipping'); end if;

  select count(*),
         count(*) filter (where is_primary=true),
         count(*) filter (where length(btrim(coalesce(alt_text,''))) < 5)
    into image_count, primary_image_count, bad_alt_count
  from public.product_images
  where product_id=p.id;

  if image_count < 3 then missing := array_append(missing,'images_min_3'); end if;
  if image_count > 8 then missing := array_append(missing,'images_max_8'); end if;
  if primary_image_count <> 1 then missing := array_append(missing,'primary_image_exactly_one'); end if;
  if bad_alt_count > 0 then missing := array_append(missing,'image_alt_text'); end if;

  if jsonb_typeof(coalesce(p.metadata->'specifications','{}'::jsonb)) <> 'object' then
    missing := array_append(missing,'specifications');
  else
    select string_agg(d.label_ar, '، ' order by d.sort_order)
      into missing_specs
    from public.category_attribute_definitions d
    where d.category_id=p.category_id
      and d.is_required
      and (p.metadata->'specifications'->>d.key is null
           or length(btrim(p.metadata->'specifications'->>d.key))=0);

    if missing_specs is not null then missing := array_append(missing,'category_specifications:'||missing_specs); end if;
  end if;

  if coalesce(array_length(missing,1),0)>0 then
    raise exception 'PRODUCT_DETAILS_INCOMPLETE: %', array_to_string(missing, ', ');
  end if;
end;
$$;