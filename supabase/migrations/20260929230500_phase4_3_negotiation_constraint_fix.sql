-- DEBA Phase 4.3 — negotiation constraint correction
-- Existing fixed-price rows remain valid: non-negotiable listings must keep
-- minimum_offer_amount NULL, while negotiable listings may opt into a floor.

alter table public.products
  drop constraint if exists products_fixed_price_check;

alter table public.products
  add constraint products_fixed_price_check
  check (
    is_negotiable = true
    or minimum_offer_amount is null
  );
