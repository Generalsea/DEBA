-- DEBA product contract hardening
-- Adds a minimum category specification set for home appliances and requires:
--   * explicit origin/source disclosure
--   * seller declaration acceptance tied to a contract version

insert into public.category_attribute_definitions
  (category_id,key,label_ar,label_en,data_type,unit,is_required,is_filterable,validation_rules,help_text_ar,sort_order)
select c.id, v.key, v.label_ar, v.label_en, v.data_type, v.unit, true, v.is_filterable,
       v.validation_rules, v.help_text_ar, v.sort_order
from public.categories c
join (
  values
    ('home-appliances','brand','العلامة التجارية','Brand','text',null,true,'{}'::jsonb,'اسم الشركة المصنّعة كما يظهر على الجهاز أو البطاقة.',10),
    ('home-appliances','model','الموديل','Model','text',null,true,'{}'::jsonb,'الموديل الكامل للجهاز.',20),
    ('home-appliances','capacity','السعة','Capacity','text',null,true,'{}'::jsonb,'مثل 9 كجم أو 12 قدم أو 450 لتر بحسب نوع الجهاز.',30),
    ('home-appliances','dimensions','الأبعاد','Dimensions','text',null,true,'{}'::jsonb,'الطول × العرض × الارتفاع مع وحدة القياس.',40),
    ('home-appliances','energy_rating','تصنيف كفاءة الطاقة','Energy Rating','text',null,true,'{}'::jsonb,'تصنيف كفاءة الطاقة إن كان ظاهرًا على الملصق.',50),
    ('home-appliances','power_supply','مصدر/جهد الطاقة','Power Supply','text',null,true,'{}'::jsonb,'مثل 220V/50Hz أو المواصفة الموجودة على الجهاز.',60),
    ('home-appliances','color','اللون','Color','text',null,true,'{}'::jsonb,'اللون الفعلي للجهاز.',70)
) as v(category_slug,key,label_ar,label_en,data_type,unit,is_filterable,validation_rules,help_text_ar,sort_order)
on v.category_slug=c.slug
on conflict (category_id,key) do update
set label_ar=excluded.label_ar,
    label_en=excluded.label_en,
    data_type=excluded.data_type,
    unit=excluded.unit,
    is_required=true,
    is_filterable=excluded.is_filterable,
    validation_rules=excluded.validation_rules,
    help_text_ar=excluded.help_text_ar,
    sort_order=excluded.sort_order,
    updated_at=now();

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
     or length(btrim(coalesce(p.metadata->'commerce'->'declaration'->>'version',''))) = 0 then
    missing := array_append(missing,'commerce.declaration');
  end if;
  if (p.metadata->'commerce'->'returns'->>'eligible') is null
     or (p.metadata->'commerce'->'returns'->>'window_days') is null
     or length(btrim(coalesce(p.metadata->'commerce'->'returns'->>'conditions',''))) < 20 then missing := array_append(missing,'commerce.returns'); end if;
  if (p.metadata->'commerce'->'warranty'->>'type') is null
     or (p.metadata->'commerce'->'warranty'->>'duration_days') is null
     or length(btrim(coalesce(p.metadata->'commerce'->'warranty'->>'details',''))) < 20 then missing := array_append(missing,'commerce.warranty'); end if;
  if length(btrim(coalesce(p.metadata->'commerce'->'authenticity'->>'declaration',''))) < 30 then missing := array_append(missing,'commerce.authenticity'); end if;
  if (p.metadata->'commerce'->'shipping'->>'cost_type') is null
     or length(btrim(coalesce(p.metadata->'commerce'->'shipping'->>'details',''))) < 20 then missing := array_append(missing,'commerce.shipping'); end if;

  select count(*) into image_count from public.product_images where product_id=p.id;
  select count(*) into primary_image_count from public.product_images where product_id=p.id and is_primary=true;
  select count(*) into bad_alt_count from public.product_images where product_id=p.id and length(btrim(coalesce(alt_text,'')))<5;

  if image_count < 3 then missing := array_append(missing,'images_min_3'); end if;
  if primary_image_count < 1 then missing := array_append(missing,'primary_image'); end if;
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