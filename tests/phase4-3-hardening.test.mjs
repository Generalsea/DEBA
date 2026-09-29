import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const BASE=new URL('../supabase/migrations/20260929230000_phase4_3_future_engine.sql',import.meta.url)
const SEARCH=new URL('../supabase/migrations/20260929230100_phase4_3_boost_aware_search.sql',import.meta.url)
const SECURITY=new URL('../supabase/migrations/20260929230200_phase4_3_rpc_security_hardening.sql',import.meta.url)
const PERF=new URL('../supabase/migrations/20260929230300_phase4_3_placement_storage_correction.sql',import.meta.url)
const HANDSHAKE=new URL('../supabase/migrations/20260929230400_phase4_3_handshake_cryptographic_hardening.sql',import.meta.url)
const NEGOTIATION=new URL('../supabase/migrations/20260929230500_phase4_3_negotiation_constraint_fix.sql',import.meta.url)
async function read(p){return readFile(p,'utf8')}

test('placement state never requires a write to public.products',async()=>{
 const s=await read(BASE)
 assert.match(s,/last_placement_at/i)
 assert.doesNotMatch(s,/update public\.products\s+set bumped_at/i)
 assert.doesNotMatch(s,/products_bumped_at_idx/i)
 const search=await read(SEARCH)
 assert.match(search,/private\.get_product_placement_at/i)
 assert.match(search,/product_placement_at/i)
 assert.match(search,/safe_sort = 'newest'/i)
})

test('private-schema RPC wrappers use SECURITY DEFINER with an explicit empty search_path',async()=>{
 const s=await read(SECURITY)
 for(const name of [
  'spend_coins_for_boost','set_smart_offer_floor','set_live_auction','submit_smart_offer',
  'get_live_auction_state','generate_trade_handshake_code','verify_trade_handshake_code',
  'run_deba_auto_refresh_engine'
 ]){
  assert.match(s,new RegExp('alter function public\\.'+name+'\\(', 'i'))
 }
 assert.match(s,/security definer/i)
 assert.match(s,/set search_path = ''/i)
})

test('placement performance index is partial and scoped to active auto-refresh controls',async()=>{
 const s=await read(PERF)
 assert.match(s,/product_ad_controls_auto_refresh_idx/i)
 assert.match(s,/where auto_refresh_enabled/i)
})

test('trade handshake uses cryptographic randomness and never implies funding',async()=>{
 const s=await read(HANDSHAKE)
 assert.match(s,/extensions\.gen_random_bytes\(3\)/i)
 assert.match(s,/extensions\.digest\(convert_to\(v_code/i)
 assert.doesNotMatch(s,/escrow_status\s*=\s*case/i)
})

test('negotiable listings are actually representable without invalidating existing fixed-price rows',async()=>{
 const s=await read(NEGOTIATION)
 assert.match(s,/drop constraint if exists products_fixed_price_check/i)
 assert.match(s,/is_negotiable = true/i)
 assert.match(s,/minimum_offer_amount is null/i)
})
