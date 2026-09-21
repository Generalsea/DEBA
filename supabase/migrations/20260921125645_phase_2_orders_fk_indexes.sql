-- DEBA Phase 2: covering indexes for Orders foreign keys

create index if not exists orders_product_idx
  on public.orders (product_id)
  where product_id is not null;

create index if not exists order_items_seller_idx
  on public.order_items (seller_id, created_at desc);
