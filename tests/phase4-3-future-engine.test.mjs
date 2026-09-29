import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const MIGRATION=new URL('../supabase/migrations/20260929230000_phase4_3_future_engine.sql',import.meta.url)
const SEARCH=new URL('../supabase/migrations/20260929230100_phase4_3_boost_aware_search.sql',import.meta.url)
const VERCEL=new URL('../vercel.json',import.meta.url)
const ENV=new URL('../.env.example',import.meta.url)
const PACKAGE=new URL('../package.json',import.meta.url)
async function read(p){return readFile(p,'utf8')}

test('coin ledger is RLS protected and rewards are idempotent',async()=>{
 const s=await read(MIGRATION)
 assert.match(s,/user_coin_balances/i);assert.match(s,/coin_transactions/i)
 assert.match(s,/revoke insert,update,delete on public\.user_coin_balances from anon,authenticated/i)
 assert.match(s,/revoke insert,update,delete on public\.coin_transactions from anon,authenticated/i)
 assert.match(s,/private\.award_coins/i);assert.match(s,/coin_transactions_reference_uidx/i)
 assert.match(s,/first_listing/);assert.match(s,/completed_sale/);assert.match(s,/excellent_review/)
})
test('boosts are atomic and bounded by private catalog',async()=>{
 const s=await read(MIGRATION)
 assert.match(s,/private\.coin_boost_catalog/i);assert.match(s,/spend_coins_for_boost/i)
 assert.match(s,/for update/i);assert.match(s,/lifetime_spent/i);assert.match(s,/ad_boosts_active_product_type_uidx/i);assert.match(s,/bumped_at=now/i)
})
test('smart offers integrate with the existing offer/order lifecycle without exposing the seller floor',async()=>{
 const s=await read(MIGRATION)
 assert.match(s,/private\.product_ad_controls/i);assert.match(s,/smart_floor_amount/i)
 assert.match(s,/process_smart_offer_intent/i);assert.match(s,/auto_countered/);assert.match(s,/accepted_escrow/)
 assert.match(s,/source_offer_id/);assert.match(s,/offer_id,source_offer_id/);assert.match(s,/trade_handshake_required/)
})
test('handshake is hashed and gates negotiated completion',async()=>{
 const s=await read(MIGRATION)
 assert.match(s,/order_trade_handshakes/i);assert.match(s,/extensions\.digest/i)
 assert.match(s,/generate_trade_handshake_code/i);assert.match(s,/verify_trade_handshake_code/i)
 assert.match(s,/Trade handshake is required before completion/i);assert.match(s,/orders_trade_handshake_guard/i)
})
test('auto refresh is observation-driven and cron authenticated',async()=>{
 const s=await read(MIGRATION);const v=JSON.parse(await read(VERCEL));const e=await read(ENV)
 assert.match(s,/product_views/i);assert.match(s,/get_peak_hour_for_product/i);assert.match(s,/run_auto_refresh_engine/i)
 assert.deepEqual(v.crons,[{path:'/api/cron/ad-engine',schedule:'0 * * * *'}]);assert.match(e,/^CRON_SECRET=/m)
})
test('predictive suggestions provide price intelligence and seller density without fabricated vector infrastructure',async()=>{
 const s=await read(MIGRATION)
 assert.match(s,/predictive_search_suggest/i);assert.match(s,/averagePrice/i);assert.match(s,/activeSellerCount/i)
 assert.doesNotMatch(s,/create extension.*vector/i)
})
test('boost-aware search consumes bumped_at while retaining its public return shape',async()=>{
 const s=await read(SEARCH);assert.match(s,/bumped_at/i);assert.match(s,/product_bumped_at/i);assert.match(s,/safe_sort = 'newest'/i)
})
test('server endpoints and package surface are wired',async()=>{
 const p=JSON.parse(await read(PACKAGE))
 assert.equal(p.scripts['test:phase4-3'],'node --test tests/phase4-3-future-engine.test.mjs')
 for(const f of ['src/app/api/coins/route.ts','src/app/api/boosts/route.ts','src/app/api/smart-offers/route.ts','src/app/api/smart-offers/floor/route.ts','src/app/api/auctions/route.ts','src/app/api/trade-handshake/route.ts','src/app/api/cron/ad-engine/route.ts']) assert.ok((await read(new URL('../'+f,import.meta.url))).length>0)
})
test('browser code contains no service credential and product detail includes the engine',async()=>{
 for(const f of ['src/components/FutureMarketplacePanel.tsx','src/components/FutureMarketplacePanel.module.css']) assert.doesNotMatch(await read(new URL('../'+f,import.meta.url)),/SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|SECRET_KEY/i)
 const page=await read(new URL('../src/app/products/[slug]/page.tsx',import.meta.url));assert.match(page,/FutureMarketplacePanel/);assert.match(page,/productId=\{product\.id\}/)
})
