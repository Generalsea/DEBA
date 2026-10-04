import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function read(path) {
  return readFile(new URL('../' + path, import.meta.url), 'utf8')
}

test('deal intelligence uses published approved sale comparables and returns a safe label contract', async () => {
  const migration = await read(
    'supabase/migrations/20260929224300_phase4_2_deal_matching_price_intelligence.sql',
  )
  const page = await read('src/app/products/[slug]/page.tsx')
  const component = await read('src/components/ProductDealScore.tsx')

  assert.match(migration, /status = 'published'/)
  assert.match(migration, /moderation_status = 'approved'/)
  assert.match(migration, /listing_type = 'sale'/)
  assert.match(migration, /average_price numeric/)
  assert.match(migration, /median_price numeric/)
  assert.match(migration, /p25_price numeric/)
  assert.match(migration, /p75_price numeric/)
  assert.match(migration, /peer_count integer/)
  assert.match(migration, /great_deal/)
  assert.match(migration, /overpriced/)
  assert.match(migration, /insufficient_data/)
  assert.match(migration, /confidence numeric/)
  assert.match(migration, /word_similarity/)
  assert.match(migration, /deba_detect_search_brands/)

  assert.match(page, /get_product_deal_score/)
  assert.match(page, /ProductDealScore/)
  assert.match(component, /مؤشر السعر الذكي/)
  assert.match(component, /متوسط المقارنة/)
  assert.match(component, /الربع الأدنى/)
  assert.match(component, /إعلان مقارنة/)
  assert.match(component, /insufficient_data/)
})

test('buyer intent matcher is persisted behind RLS and has asynchronous publication wiring', async () => {
  const migration = await read(
    'supabase/migrations/20260929224300_phase4_2_deal_matching_price_intelligence.sql',
  )
  const matches = await read('src/app/api/buyer-intent/matches/route.ts')
  const save = await read('src/app/api/buyer-intent/saved-searches/route.ts')
  const internal = await read('src/app/api/internal/buyer-intent/match/route.ts')
  const emptyState = await read('src/components/SaveBuyerIntentButton.tsx')

  assert.match(migration, /create table if not exists public\.buyer_intent_matches/)
  assert.match(migration, /alter table public\.buyer_intent_matches enable row level security/)
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/)
  assert.match(migration, /create trigger products_enqueue_buyer_intent_match/)
  assert.match(migration, /net\.http_post/)
  assert.match(migration, /deba_buyer_intent_webhook_url/)
  assert.match(migration, /deba_buyer_intent_webhook_secret/)

  assert.match(matches, /get_buyer_intent_matches/)
  assert.match(matches, /auth\.getUser/)

  assert.match(save, /search_hash/)
  assert.match(save, /sha256/)
  assert.match(save, /onConflict: 'user_id,search_hash'/)
  assert.match(save, /alertFrequency/)

  assert.match(internal, /timingSafeEqual/)
  assert.match(internal, /DEBA_BUYER_INTENT_WEBHOOK_SECRET/)
  assert.match(internal, /process_buyer_intent_matches/)
  assert.match(internal, /status: 503/)

  assert.match(emptyState, /api\/buyer-intent\/saved-searches/)
  assert.match(emptyState, /alertFrequency: 'instant'/)
  assert.match(emptyState, /response\.status === 401/)
})

test('buyer intent feature contains no client-side service credentials', async () => {
  const source = await read('src/app/api/internal/buyer-intent/match/route.ts')
  const hook = await read('src/components/SaveBuyerIntentButton.tsx')
  assert.doesNotMatch(source, /NEXT_PUBLIC_/)
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(hook, /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|DEBA_BUYER_INTENT_WEBHOOK_SECRET/)
})
