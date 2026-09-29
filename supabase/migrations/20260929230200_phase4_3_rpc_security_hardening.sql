-- DEBA Phase 4.3 — harden RPC wrappers that cross into the private schema.
-- Authorization remains inside each function; this only gives the wrapper controlled access
-- to private tables/functions without granting private-schema DML to application roles.

alter function public.spend_coins_for_boost(uuid,text,integer) security definer;
alter function public.spend_coins_for_boost(uuid,text,integer) set search_path = '';

alter function public.set_smart_offer_floor(uuid,numeric,boolean) security definer;
alter function public.set_smart_offer_floor(uuid,numeric,boolean) set search_path = '';

alter function public.set_live_auction(uuid,integer) security definer;
alter function public.set_live_auction(uuid,integer) set search_path = '';

alter function public.submit_smart_offer(uuid,numeric,text) security definer;
alter function public.submit_smart_offer(uuid,numeric,text) set search_path = '';

alter function public.get_live_auction_state(uuid) security definer;
alter function public.get_live_auction_state(uuid) set search_path = '';

alter function public.generate_trade_handshake_code(uuid) security definer;
alter function public.generate_trade_handshake_code(uuid) set search_path = '';

alter function public.verify_trade_handshake_code(uuid,text) security definer;
alter function public.verify_trade_handshake_code(uuid,text) set search_path = '';

alter function public.run_deba_auto_refresh_engine() security definer;
alter function public.run_deba_auto_refresh_engine() set search_path = '';
