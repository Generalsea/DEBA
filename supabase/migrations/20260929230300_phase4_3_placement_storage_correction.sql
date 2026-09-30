-- DEBA Phase 4.3 — placement-engine performance indexes
create index if not exists product_ad_controls_auto_refresh_idx
  on private.product_ad_controls(auto_refresh_enabled,last_auto_refresh_at,updated_at)
  where auto_refresh_enabled;
