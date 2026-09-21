-- Inventory may reach zero when the final unit is reserved or sold.
-- Negative inventory remains prohibited.
alter table public.products
  drop constraint if exists products_quantity_check;

alter table public.products
  add constraint products_quantity_check
  check (quantity >= 0);
