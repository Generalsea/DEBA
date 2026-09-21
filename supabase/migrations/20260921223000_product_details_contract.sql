-- DEBA structured product detail contract
-- Database policy:
--   * category_attribute_definitions stores category-level required specifications.
--   * products.details_schema_version marks listings using the structured contract.
--   * published structured listings are validated by a database trigger.
--   * at least 3 product images with one primary image and non-empty alt text are required.

create table if not exists public.category_attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  key text not null,
  label_ar text not null,
  label_en text,
  data_type text not null check (data_type in ('text','number','boolean')),
  unit text,
  is_required boolean not null default false,
  is_filterable boolean not null default false,
  validation_rules jsonb not null default '{}'::jsonb,
  help_text_ar text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, key)
);

alter table public.category_attribute_definitions enable row level security;

grant select on public.category_attribute_definitions to anon, authenticated;
grant insert, update, delete on public.category_attribute_definitions to authenticated;

drop policy if exists category_attribute_definitions_public_select on public.category_attribute_definitions;
create policy category_attribute_definitions_public_select
on public.category_attribute_definitions
for select to anon, authenticated
using (
  exists (
    select 1
    from public.categories c
    where c.id = category_attribute_definitions.category_id
      and c.is_active = true
  )
);

drop policy if exists category_attribute_definitions_admin_write on public.category_attribute_definitions;
create policy category_attribute_definitions_admin_write
on public.category_attribute_definitions
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create index if not exists idx_category_attribute_definitions_category_required
  on public.category_attribute_definitions(category_id, is_required, sort_order);

alter table public.products
  add column if not exists details_schema_version smallint not null default 0
    check (details_schema_version in (0,1));

alter table public.products
  add column if not exists details_last_completed_at timestamptz;

comment on column public.products.details_schema_version is
  '0=legacy listing, 1=DEBA structured product-details contract';

comment on column public.products.details_last_completed_at is
  'Timestamp when the structured listing contract was last validated as complete';

insert into public.category_attribute_definitions
  (category_id,key,label_ar,label_en,data_type,unit,is_required,is_filterable,validation_rules,help_text_ar,sort_order)
select c.id, v.key, v.label_ar, v.label_en, v.data_type, v.unit, true, v.is_filterable,
       v.validation_rules, v.help_text_ar, v.sort_order
from public.categories c
join (
  values
    ('electronics','brand','العلامة التجارية','Brand','text',null,true,'{}'::jsonb,'اسم الشركة المصنّعة كما هو على المنتج.',10),
    ('electronics','model','الموديل','Model','text',null,true,'{}'::jsonb,'الموديل التجاري الكامل.',20),
    ('electronics','model_number','رقم الموديل','Model Number','text',null,true,'{}'::jsonb,'رقم الموديل كما هو على الجهاز أو العلبة.',30),
    ('electronics','release_year','سنة الإصدار','Release Year','number',null,true,'{"min":2000,"max":2100}'::jsonb,'سنة الإصدار أو الصنع عندما تكون معروفة بوضوح.',40),
    ('electronics','storage_capacity','سعة التخزين','Storage','text',null,true,'{}'::jsonb,'مثل 128GB أو 256GB.',50),
    ('electronics','ram','الذاكرة العشوائية RAM','RAM','text',null,true,'{}'::jsonb,'السعة الفعلية للذاكرة العشوائية.',60),
    ('electronics','color','اللون','Color','text',null,true,'{}'::jsonb,'اللون الفعلي للقطعة.',70),
    ('furniture-home','dimensions','الأبعاد','Dimensions','text',null,true,'{}'::jsonb,'الطول × العرض × الارتفاع مع وحدة القياس.',10),
    ('furniture-home','material','الخامة','Material','text',null,true,'{}'::jsonb,'الخامة الأساسية.',20),
    ('furniture-home','color','اللون','Color','text',null,true,'{}'::jsonb,'اللون الفعلي.',30),
    ('fashion','brand','العلامة التجارية','Brand','text',null,true,'{}'::jsonb,'العلامة التجارية كما تظهر في المنتج أو البطاقة.',10),
    ('fashion','size','المقاس','Size','text',null,true,'{}'::jsonb,'المقاس وفق المعيار الظاهر على المنتج.',20),
    ('fashion','material','الخامة','Material','text',null,true,'{}'::jsonb,'الخامة الأساسية.',30),
    ('fashion','color','اللون','Color','text',null,true,'{}'::jsonb,'اللون الفعلي للمنتج.',40),
    ('vehicles-parts','brand','العلامة التجارية','Brand','text',null,true,'{}'::jsonb,'الشركة المصنّعة.',10),
    ('vehicles-parts','model','الموديل','Model','text',null,true,'{}'::jsonb,'اسم الموديل الكامل.',20),
    ('vehicles-parts','manufacture_year','سنة الصنع','Manufacture Year','number',null,true,'{"min":1900,"max":2100}'::jsonb,'سنة الصنع الفعلية.',30),
    ('vehicles-parts','mileage_km','الكيلومترات','Mileage','number','km',true,'{"min":0}'::jsonb,'عداد الكيلومترات وقت الإدراج.',40),
    ('vehicles-parts','fuel_type','نوع الوقود','Fuel Type','text',null,true,'{}'::jsonb,'بنزين/ديزل/هجين/كهرباء وغيرها.',50),
    ('vehicles-parts','transmission','ناقل الحركة','Transmission','text',null,true,'{}'::jsonb,'أوتوماتيك/يدوي وغيرها.',60),
    ('toys-hobbies','brand','العلامة التجارية','Brand','text',null,true,'{}'::jsonb,'العلامة التجارية.',10),
    ('toys-hobbies','age_range','الفئة العمرية','Age Range','text',null,true,'{}'::jsonb,'الفئة العمرية الموصى بها.',20),
    ('toys-hobbies','material','الخامة','Material','text',null,true,'{}'::jsonb,'المادة الرئيسية.',30),
    ('books-education','author','المؤلف','Author','text',null,true,'{}'::jsonb,'اسم المؤلف أو المؤلفين.',10),
    ('books-education','isbn','ISBN','ISBN','text',null,true,'{}'::jsonb,'رقم ISBN عندما ينطبق.',20),
    ('books-education','language','لغة المحتوى','Language','text',null,true,'{}'::jsonb,'لغة المحتوى الأساسية.',30),
    ('baby-kids','brand','العلامة التجارية','Brand','text',null,true,'{}'::jsonb,'العلامة التجارية.',10),
    ('baby-kids','age_range','الفئة العمرية','Age Range','text',null,true,'{}'::jsonb,'العمر أو الوزن أو المقاس المناسب.',20),
    ('baby-kids','material','الخامة','Material','text',null,true,'{}'::jsonb,'الخامة الأساسية.',30),
    ('sports-fitness','brand','العلامة التجارية','Brand','text',null,true,'{}'::jsonb,'العلامة التجارية.',10),
    ('sports-fitness','model','الموديل','Model','text',null,true,'{}'::jsonb,'الموديل عند انطباقه.',20),
    ('sports-fitness','material','الخامة','Material','text',null,true,'{}'::jsonb,'الخامة الأساسية.',30),
    ('tools-equipment','brand','العلامة التجارية','Brand','text',null,true,'{}'::jsonb,'العلامة التجارية.',10),
    ('tools-equipment','model','الموديل','Model','text',null,true,'{}'::jsonb,'الموديل الكامل.',20),
    ('tools-equipment','power_source','مصدر الطاقة','Power Source','text',null,true,'{}'::jsonb,'كهرباء/بطارية/بنزين وغيرها.',30),
    ('collectibles-antiques','maker','الصانع/الجهة','Maker','text',null,true,'{}'::jsonb,'اسم الصانع أو الجهة إن كانت معروفة.',10),
    ('collectibles-antiques','era','الفترة/العصر','Era','text',null,true,'{}'::jsonb,'الفترة الزمنية أو السنة الموثقة.',20),
    ('collectibles-antiques','provenance','مصدر/سجل الملكية','Provenance','text',null,true,'{}'::jsonb,'المصدر أو تاريخ الملكية المتاح.',30),
    ('other','item_type','نوع السلعة','Item Type','text',null,true,'{}'::jsonb,'نوع السلعة بشكل محدد.',10),
    ('other','brand','العلامة التجارية','Brand','text',null,true,'{}'::jsonb,'العلامة التجارية إذا كانت موجودة.',20)
) as v(category_slug,key,label_ar,label_en,data_type,unit,is_filterable,validation_rules,help_text_ar,sort_order)
on v.category_slug = c.slug
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
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if length(btrim(coalesce(p.title,''))) < 10 or length(btrim(p.title)) > 120 then
    missing := array_append(missing,'title');
  end if;
  if length(btrim(coalesce(p.description,''))) < 200 then
    missing := array_append(missing,'description');
  end if;
  if p.category_id is null then missing := array_append(missing,'category_id'); end if;
  if p.condition_grade is null then missing := array_append(missing,'condition_grade'); end if;
  if length(btrim(coalesce(p.condition_details,''))) < 30 then
    missing := array_append(missing,'condition_details');
  end if;
  if p.price is null or p.price <= 0 then missing := array_append(missing,'price'); end if;
  if length(btrim(coalesce(p.governorate,''))) < 2 then missing := array_append(missing,'governorate'); end if;
  if length(btrim(coalesce(p.city,''))) < 2 then missing := array_append(missing,'city'); end if;
  if length(btrim(coalesce(p.district,''))) < 2 then missing := array_append(missing,'district'); end if;
  if p.delivery_method is null or length(btrim(p.delivery_method)) = 0 then
    missing := array_append(missing,'delivery_method');
  end if;

  if length(btrim(coalesce(p.metadata->'commerce'->>'seller_declaration',''))) < 30 then
    missing := array_append(missing,'commerce.seller_declaration');
  end if;
  if (p.metadata->'commerce'->'returns'->>'eligible') is null
     or (p.metadata->'commerce'->'returns'->>'window_days') is null
     or length(btrim(coalesce(p.metadata->'commerce'->'returns'->>'conditions',''))) < 20 then
    missing := array_append(missing,'commerce.returns');
  end if;
  if (p.metadata->'commerce'->'warranty'->>'type') is null
     or (p.metadata->'commerce'->'warranty'->>'duration_days') is null
     or length(btrim(coalesce(p.metadata->'commerce'->'warranty'->>'details',''))) < 20 then
    missing := array_append(missing,'commerce.warranty');
  end if;
  if length(btrim(coalesce(p.metadata->'commerce'->'authenticity'->>'declaration',''))) < 30 then
    missing := array_append(missing,'commerce.authenticity');
  end if;
  if (p.metadata->'commerce'->'shipping'->>'cost_type') is null
     or length(btrim(coalesce(p.metadata->'commerce'->'shipping'->>'details',''))) < 20 then
    missing := array_append(missing,'commerce.shipping');
  end if;

  select count(*) into image_count from public.product_images where product_id = p.id;
  select count(*) into primary_image_count from public.product_images where product_id = p.id and is_primary = true;
  select count(*) into bad_alt_count from public.product_images where product_id = p.id and length(btrim(coalesce(alt_text,''))) < 5;

  if image_count < 3 then missing := array_append(missing,'images_min_3'); end if;
  if primary_image_count < 1 then missing := array_append(missing,'primary_image'); end if;
  if bad_alt_count > 0 then missing := array_append(missing,'image_alt_text'); end if;

  if jsonb_typeof(coalesce(p.metadata->'specifications','{}'::jsonb)) <> 'object' then
    missing := array_append(missing,'specifications');
  else
    select string_agg(d.label_ar, '، ' order by d.sort_order)
      into missing_specs
    from public.category_attribute_definitions d
    where d.category_id = p.category_id
      and d.is_required
      and (
        p.metadata->'specifications'->>d.key is null
        or length(btrim(p.metadata->'specifications'->>d.key)) = 0
      );
    if missing_specs is not null then
      missing := array_append(missing,'category_specifications:' || missing_specs);
    end if;
  end if;

  if coalesce(array_length(missing,1),0) > 0 then
    raise exception 'PRODUCT_DETAILS_INCOMPLETE: %', array_to_string(missing, ', ');
  end if;
end;
$$;

create or replace function private.enforce_product_detail_contract()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status = 'published' and new.details_schema_version = 1 then
    perform private.validate_product_for_publish(new.id);
    new.details_last_completed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_product_detail_contract on public.products;
create trigger trg_enforce_product_detail_contract
before insert or update on public.products
for each row execute function private.enforce_product_detail_contract();

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
begin
  select status, details_schema_version into product_status, version
  from public.products
  where id = target_product;

  if product_status = 'published' and version = 1 then
    select count(*) into image_count
    from public.product_images
    where product_id = target_product;

    if image_count < 3 then
      raise exception 'PRODUCT_DETAILS_INCOMPLETE: images_min_3';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enforce_published_product_images on public.product_images;
create constraint trigger trg_enforce_published_product_images
after insert or update or delete on public.product_images
deferrable initially deferred
for each row execute function private.enforce_published_product_images();
