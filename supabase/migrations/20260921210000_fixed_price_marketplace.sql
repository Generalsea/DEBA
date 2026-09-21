-- DEBA fixed-price marketplace
-- Business rule: all newly published products are fixed-price sales.
-- Legacy offer/donation tables remain for historical compatibility, but no new
-- offer-based purchase or donation listing can be created.

alter table public.products
  drop constraint if exists products_listing_type_check;

alter table public.products
  drop constraint if exists products_sale_price_chk;

update public.products
set status = 'archived',
    listing_type = 'sale',
    is_negotiable = false,
    minimum_offer_amount = null,
    updated_at = now()
where coalesce(metadata ->> 'demo_catalog', 'false') = 'true'
  and listing_type in ('free', 'donation');

update public.products
set is_negotiable = false,
    minimum_offer_amount = null,
    updated_at = now()
where listing_type = 'sale';

alter table public.products
  add constraint products_listing_type_sale_check
  check (listing_type = 'sale');

alter table public.products
  add constraint products_published_sale_price_check
  check (
    status <> 'published'
    or (listing_type = 'sale' and price is not null and price > 0)
  );

alter table public.products
  drop constraint if exists products_fixed_price_check;

alter table public.products
  add constraint products_fixed_price_check
  check (is_negotiable = false and minimum_offer_amount is null);

alter table public.orders
  drop constraint if exists orders_direct_purchase_check;

alter table public.orders
  add constraint orders_direct_purchase_check
  check (offer_id is null);

drop policy if exists offers_insert_own on public.offers;
