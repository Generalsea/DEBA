import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const PLACEMENT=new URL('../supabase/migrations/20260929230300_phase4_3_placement_storage_correction.sql',import.meta.url)
const HARDENING=new URL('../supabase/migrations/20260929230200_phase4_3_rpc_security_hardening.sql',import.meta.url)
const HANDSHAKE=new URL('../supabase/migrations/20260929230400_phase4_3_handshake_cryptographic_hardening.sql',import.meta.url)
async function read(p){return readFile(p,'utf8')}

test('advertiser placement stays outside public product writes',async()=>{
  const s=await read(PLACEMENT)
  assert.match(s,/last_placement_at/i)
  assert.match(s,/private\.get_product_placement_at/i)
  assert.match(s,/alter table public\.products drop column if exists bumped_at/i)
  const spend=s.slice(s.indexOf('create or replace function public.spend_coins_for_boost'),s.indexOf('revoke execute on function public.spend_coins_for_boost'))
  const refresh=s.slice(s.indexOf('create or replace function private.run_auto_refresh_engine'))
  assert.doesNotMatch(spend,/update public\.products\s+set bumped_at/i)
  assert.doesNotMatch(refresh,/update public\.products\s+set bumped_at/i)
  assert.match(spend,/last_placement_at/)
  assert.match(refresh,/last_placement_at/)
})

test('private-schema RPC wrappers use controlled SECURITY DEFINER boundaries',async()=>{
  const s=await read(HARDENING)
  for(const name of [
    'spend_coins_for_boost','set_smart_offer_floor','set_live_auction',
    'submit_smart_offer','get_live_auction_state','generate_trade_handshake_code',
    'verify_trade_handshake_code','run_deba_auto_refresh_engine'
  ]){
    assert.match(s,new RegExp('alter function public\\\\.'+name+'\\\\([^) ]*.*?security definer','is'))
  }
  assert.match(s,/set search_path = ''/i)
})

test('trade handshake uses cryptographic randomness and never marks unpaid orders funded',async()=>{
  const s=await read(HANDSHAKE)
  assert.match(s,/extensions\.gen_random_bytes\(3\)/i)
  assert.match(s,/extensions\.digest\(convert_to\(v_code/i)
  assert.doesNotMatch(s,/escrow_status\s*=\s*case/i)
})
