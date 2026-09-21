-- DEBA Phase 2: Orders domain

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  offer_id uuid references public.offers(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','processing','ready','completed','cancelled','refunded','disputed')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','pending','paid','failed','refunded','partially_refunded')),
  fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending','preparing','ready','in_transit','delivered','confirmed','cancelled')),
  subtotal numeric not null default 0 check (subtotal >= 0),
  shipping_fee numeric not null default 0 check (shipping_fee >= 0),
  platform_fee numeric not null default 0 check (platform_fee >= 0),
  total numeric not null default 0 check (total >= 0),
  currency text not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  delivery_method text not null default 'pickup'
    check (delivery_method in ('pickup','seller_delivery','platform_delivery','both')),
  delivery_address_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  check (offer_id is null or product_id is not null)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  line_total numeric not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_idx on public.orders (seller_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_offer_idx on public.orders (offer_id) where offer_id is not null;
create index if not exists orders_product_idx on public.orders (product_id) where product_id is not null;
create index if not exists order_items_order_idx on public.order_items (order_id, created_at);
create index if not exists order_items_product_idx on public.order_items (product_id);
create index if not exists order_items_seller_idx on public.order_items (seller_id, created_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function private.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists orders_participant_select on public.orders;
create policy orders_participant_select
on public.orders
for select
to authenticated
using (
  buyer_id = (select auth.uid())
  or seller_id = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists order_items_participant_select on public.order_items;
create policy order_items_participant_select
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.buyer_id = (select auth.uid())
        or o.seller_id = (select auth.uid())
        or (select private.is_admin())
      )
  )
);

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
