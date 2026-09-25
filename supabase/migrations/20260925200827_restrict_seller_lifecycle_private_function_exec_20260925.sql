-- DEBA PHASE 2 / STEP 3 security follow-up
-- Restrict direct EXECUTE on private lifecycle functions to the roles used by
-- the public wrappers. The private schema has limited USAGE for search helpers,
-- so function ACLs must be explicit as well.

begin;

revoke execute on function private.record_product_view(uuid, text) from public;
grant execute on function private.record_product_view(uuid, text) to anon, authenticated;

revoke execute on function private.get_seller_dashboard(uuid) from public;
grant execute on function private.get_seller_dashboard(uuid) to authenticated;

revoke execute on function private.update_seller_listing_status(uuid, text) from public;
grant execute on function private.update_seller_listing_status(uuid, text) to authenticated;

revoke execute on function private.update_seller_listing(uuid, text, text, numeric, integer, text, text, text) from public;
grant execute on function private.update_seller_listing(uuid, text, text, numeric, integer, text, text, text) to authenticated;

revoke execute on function private.delete_seller_listing(uuid) from public;
grant execute on function private.delete_seller_listing(uuid) to authenticated;

revoke execute on function private.guard_seller_product_lifecycle() from public;

commit;
