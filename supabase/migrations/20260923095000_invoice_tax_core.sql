-- DEBA invoice / tax core.
-- Tax is policy-driven: no VAT rate is hard-coded globally.

create table if not exists public.tax_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tax_status text not null default 'unknown'
    check (tax_status in ('unknown','registered','exempt','not_registered')),
  taxpayer_number text,
  legal_name text,
  activity_code text,
  branch_code text,
  address_snapshot jsonb not null default '{}'::jsonb,
  invoice_mode text not null default 'internal'
    check (invoice_mode in ('internal','eta_einvoice','eta_ereceipt')),
  eta_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists tax_profiles_taxpayer_number_uidx
  on public.tax_profiles(taxpayer_number)
  where taxpayer_number is not null;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  issuer_user_id uuid not null references auth.users(id) on delete restrict,
  invoice_number text not null unique,
  status text not null default 'draft'
    check (status in ('draft','ready','submitted','valid','invalid','cancelled')),
  tax_treatment text not null default 'not_configured'
    check (tax_treatment in ('not_configured','standard','exempt','zero_rated','out_of_scope','other')),
  tax_rate numeric check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 100)),
  subtotal numeric not null check (subtotal >= 0),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  total numeric not null check (total >= 0),
  currency text not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  issuer_snapshot jsonb not null default '{}'::jsonb,
  receiver_snapshot jsonb not null default '{}'::jsonb,
  provider text not null default 'internal',
  provider_submission_id text,
  provider_document_id text,
  provider_status text,
  document_payload jsonb not null default '{}'::jsonb,
  last_error text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists invoices_provider_document_uidx
  on public.invoices(provider,provider_document_id)
  where provider_document_id is not null;

create unique index if not exists invoices_provider_submission_uidx
  on public.invoices(provider,provider_submission_id)
  where provider_submission_id is not null;

create index if not exists invoices_issuer_status_created_idx
  on public.invoices(issuer_user_id,status,created_at desc);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  description text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  line_subtotal numeric not null check (line_subtotal >= 0),
  tax_rate numeric check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 100)),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  line_total numeric not null check (line_total >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists invoice_items_invoice_idx
  on public.invoice_items(invoice_id);

create index if not exists invoice_items_order_item_idx
  on public.invoice_items(order_item_id);

create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  event_type text not null,
  provider_event_id text,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists invoice_events_provider_uidx
  on public.invoice_events(invoice_id,provider_event_id)
  where provider_event_id is not null;

create index if not exists invoice_events_invoice_created_idx
  on public.invoice_events(invoice_id,created_at desc);

create or replace function private.touch_tax_updated_at()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists tax_profiles_touch_updated_at on public.tax_profiles;
create trigger tax_profiles_touch_updated_at
before update on public.tax_profiles
for each row execute function private.touch_tax_updated_at();

drop trigger if exists invoices_touch_updated_at on public.invoices;
create trigger invoices_touch_updated_at
before update on public.invoices
for each row execute function private.touch_tax_updated_at();

alter table public.tax_profiles enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_events enable row level security;

drop policy if exists tax_profiles_owner_select on public.tax_profiles;
create policy tax_profiles_owner_select on public.tax_profiles
for select to authenticated
using(user_id=(select auth.uid()) or (select private.is_admin()));

drop policy if exists tax_profiles_owner_insert on public.tax_profiles;
create policy tax_profiles_owner_insert on public.tax_profiles
for insert to authenticated
with check(user_id=(select auth.uid()));

drop policy if exists tax_profiles_owner_update on public.tax_profiles;
create policy tax_profiles_owner_update on public.tax_profiles
for update to authenticated
using(user_id=(select auth.uid()))
with check(user_id=(select auth.uid()));

drop policy if exists invoices_participant_select on public.invoices;
create policy invoices_participant_select on public.invoices
for select to authenticated
using(
  issuer_user_id=(select auth.uid())
  or exists(
    select 1 from public.orders o
    where o.id=invoices.order_id and o.buyer_id=(select auth.uid())
  )
  or (select private.is_admin())
);

drop policy if exists invoice_items_participant_select on public.invoice_items;
create policy invoice_items_participant_select on public.invoice_items
for select to authenticated
using(
  exists(
    select 1 from public.invoices i
    join public.orders o on o.id=i.order_id
    where i.id=invoice_items.invoice_id
      and (
        i.issuer_user_id=(select auth.uid())
        or o.buyer_id=(select auth.uid())
        or (select private.is_admin())
      )
  )
);

drop policy if exists invoice_events_participant_select on public.invoice_events;
create policy invoice_events_participant_select on public.invoice_events
for select to authenticated
using(
  exists(
    select 1 from public.invoices i
    join public.orders o on o.id=i.order_id
    where i.id=invoice_events.invoice_id
      and (
        i.issuer_user_id=(select auth.uid())
        or o.buyer_id=(select auth.uid())
        or (select private.is_admin())
      )
  )
);

revoke all on table public.tax_profiles,public.invoices,public.invoice_items,public.invoice_events
from anon,authenticated;

grant select,insert,update on public.tax_profiles to authenticated;
grant select on public.invoices,public.invoice_items,public.invoice_events to authenticated;
grant all on all tables in schema public to service_role;

create or replace function private.create_internal_invoice(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_order public.orders%rowtype;
  v_profile public.tax_profiles%rowtype;
  v_invoice public.invoices%rowtype;
  v_invoice_id uuid;
  v_invoice_number text;
  v_status text:='draft';
  v_treatment text:='not_configured';
  v_tax_rate numeric;
  v_tax_amount numeric:=0;
  v_issuer jsonb;
  v_receiver jsonb;
  v_item record;
begin
  select * into v_order
  from public.orders
  where id=p_order_id
    and status='completed'
    and payment_status in ('paid','partially_refunded','refunded')
  for update;

  if not found then
    raise exception 'Invoice requires a completed paid order' using errcode='42501';
  end if;

  select * into v_invoice from public.invoices where order_id=p_order_id limit 1;

  if found then
    return jsonb_build_object(
      'invoice_id',v_invoice.id,
      'invoice_number',v_invoice.invoice_number,
      'status',v_invoice.status,
      'existing',true
    );
  end if;

  select * into v_profile from public.tax_profiles where user_id=v_order.seller_id;

  if v_profile.tax_status='registered'
     and v_profile.taxpayer_number is not null
     and v_profile.legal_name is not null then
    v_status:='ready';
    v_treatment:='other';
    v_tax_rate:=null;
  end if;

  v_invoice_number:='INV-' || upper(substr(replace(v_order.reference_code,'DB-',''),1,12));

  v_issuer:=jsonb_build_object(
    'user_id',v_order.seller_id,
    'tax_status',coalesce(v_profile.tax_status,'unknown'),
    'taxpayer_number',v_profile.taxpayer_number,
    'legal_name',v_profile.legal_name,
    'activity_code',v_profile.activity_code,
    'branch_code',v_profile.branch_code,
    'address',v_profile.address_snapshot
  );

  v_receiver:=coalesce(v_order.delivery_address_snapshot,'{}'::jsonb)
    || jsonb_build_object('buyer_id',v_order.buyer_id);

  insert into public.invoices(
    order_id,issuer_user_id,invoice_number,status,tax_treatment,tax_rate,
    subtotal,tax_amount,total,currency,issuer_snapshot,receiver_snapshot,
    provider,document_payload,issued_at
  )
  values(
    v_order.id,v_order.seller_id,v_invoice_number,v_status,v_treatment,v_tax_rate,
    v_order.subtotal,v_tax_amount,v_order.total,v_order.currency,
    v_issuer,v_receiver,'internal',
    jsonb_build_object(
      'invoice_type','internal_marketplace_invoice',
      'tax_configuration_required',v_status='draft',
      'eta_submission_ready',false
    ),
    case when v_status='ready' then now() else null end
  )
  returning id into v_invoice_id;

  for v_item in
    select oi.id,p.title,oi.quantity,oi.unit_price,oi.line_total
    from public.order_items oi
    join public.products p on p.id=oi.product_id
    where oi.order_id=v_order.id
  loop
    insert into public.invoice_items(
      invoice_id,order_item_id,description,quantity,unit_price,
      line_subtotal,tax_rate,tax_amount,line_total
    )
    values(
      v_invoice_id,v_item.id,v_item.title,v_item.quantity,v_item.unit_price,
      v_item.line_total,v_tax_rate,0,v_item.line_total
    );
  end loop;

  insert into public.invoice_events(invoice_id,event_type,status,payload)
  values(
    v_invoice_id,'created',v_status,
    jsonb_build_object('source','order_completion','order_id',v_order.id)
  );

  return jsonb_build_object(
    'invoice_id',v_invoice_id,
    'invoice_number',v_invoice_number,
    'status',v_status,
    'taxConfigured',v_status<>'draft',
    'existing',false
  );
end;
$$;

create or replace function public.create_internal_invoice(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  v_order public.orders%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into v_order
  from public.orders
  where id=p_order_id
    and buyer_id=(select auth.uid());

  if not found then
    raise exception 'Order not found' using errcode='P0002';
  end if;

  return private.create_internal_invoice(p_order_id);
end;
$$;

revoke execute on function public.create_internal_invoice(uuid) from public,anon;
grant execute on function public.create_internal_invoice(uuid) to authenticated;
