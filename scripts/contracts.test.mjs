import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function read(path) {
  return readFile(new URL('../' + path, import.meta.url), 'utf8')
}

test('Arabic product routes stay dynamic and normalize slug params', async () => {
  const detail = await read('src/app/products/[slug]/page.tsx')
  const checkout = await read('src/app/products/[slug]/checkout/page.tsx')

  for (const source of [detail, checkout]) {
    assert.match(source, /export const dynamic = ['"]force-dynamic['"]/)
    assert.match(source, /function normalizeRouteSlug\(value: string\)/)
    assert.match(source, /return decodeURIComponent\(value\)/)
    assert.match(source, /\.eq\(['"]slug['"], normalizedSlug\)/)
  }
})

test('seller listing starts as a draft and uses structured contract v1', async () => {
  const source = await read('src/app/sell/ProductListingForm.tsx')

  assert.match(source, /status:\s*['"]draft['"]/)
  assert.match(source, /moderation_status:\s*['"]pending['"]/)
  assert.match(source, /details_schema_version:\s*1/)
  assert.match(source, /files\.length < 3/)
})

test('database hardening migration protects seller verification review fields', async () => {
  const source = await read('supabase/migrations/20260923130427_harden_seller_verification_writes.sql')

  for (const field of ['status', 'reviewed_at', 'reviewed_by', 'review_note', 'expires_at']) {
    assert.match(source, new RegExp('new\\.' + field + '\\s+is distinct from old\\.' + field))
  }

  assert.match(source, /create trigger trg_secure_seller_verification_write/)
  assert.match(source, /private\.secure_seller_verification_write\(\)/)
})

test('paid payment is required before an order can be completed', async () => {
  const migration = await read(
    'supabase/migrations/20260923132140_require_paid_order_completion.sql',
  )
  const actions = await read('src/components/OrderActions.tsx')
  const route = await read('src/app/api/orders/[id]/status/route.ts')

  assert.match(migration, /new\.status = 'completed'/)
  assert.match(migration, /new\.payment_status <> 'paid'/)
  assert.match(migration, /Paid payment is required before order completion/)
  assert.match(actions, /orderStatus === 'ready'/)
  assert.match(actions, /paymentStatus === 'paid'/)
  assert.match(route, /paid payment is required/)
})

test('CI uses npm ci when the repository lockfile is present', async () => {
  const source = await read('.github/workflows/ci.yml')
  assert.match(source, /npm ci --no-audit --no-fund/)
  assert.match(source, /package-lock\.json/)
})
test('header advertising rail is data-driven, 9:16, and isolated from persistence', async () => {
  const migration = await read(
    'supabase/migrations/20260923141939_create_header_ad_promotions.sql',
  )
  const rail = await read('src/components/HeaderReelsRail.tsx')
  const railCss = await read('src/components/HeaderReelsRail.module.css')
  const page = await read('src/app/page.tsx')

  assert.match(migration, /media_type text not null check \(media_type in \('image', 'video'\)\)/)
  assert.match(migration, /create policy "Public can read active header ads"/)
  assert.match(migration, /starts_at is null or starts_at <= now\(\)/)
  assert.match(railCss, /aspect-ratio: 9 \/ 16/)
  assert.match(rail, /muted/)
  assert.match(rail, /playsInline/)
  assert.match(page, /from\('header_ad_promotions'\)/)
  assert.match(page, /isSafeMediaUrl/)
})
