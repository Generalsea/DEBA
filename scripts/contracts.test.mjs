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
  assert.match(page, /isSafeUrl\(row\.media_url\)/)
  assert.match(page, /isSafeUrl\(row\.target_url\)/)
})
test('admin campaign management keeps write access server-side and supports scheduled media', async () => {
  const route = await read('src/app/api/admin/campaigns/route.ts')
  const page = await read('src/app/admin/page.tsx')
  const migration = await read(
    'supabase/migrations/20260923142600_enable_header_ad_storage.sql',
  )

  assert.match(route, /\.eq\(['"]role['"], ['"]admin['"]\)/)
  assert.match(route, /createAdminClient\(\)/)
  assert.match(route, /request\.formData\(\)/)
  assert.match(route, /MAX_VIDEO_BYTES = 50 \* 1024 \* 1024/)
  assert.match(migration, /allowed_mime_types/)
  assert.match(route, /validateTargetUrl/)
  assert.match(route, /\.eq\(['"]role['"], ['"]admin['"]\)/)
  assert.match(route, /writeAdminAudit/)
  assert.match(route, /صورة الغلاف مخصصة لحملات الفيديو فقط/)
  assert.match(page, /<AdminCampaigns \/>/)
  assert.match(migration, /deba-header-ads/)
  assert.match(migration, /media_storage_path/)
  assert.match(migration, /poster_storage_path/)
})

test('future marketplace theme is persistent and does not invent commerce metrics', async () => {
  const toggle = await read('src/components/ThemeToggle.tsx')
  const bootstrap = await read('public/deba-theme-bootstrap.js')
  const layout = await read('src/app/layout.tsx')
  const page = await read('src/app/page.tsx')
  const card = await read('src/components/ProductCard.tsx')

  assert.match(toggle, /localStorage\.setItem\(['"]deba-theme['"]/)
  assert.match(bootstrap, /localStorage\.getItem\(['"]deba-theme['"]/)
  assert.match(bootstrap, /prefers-color-scheme: light/)
  assert.match(layout, /src=["']\/deba-theme-bootstrap\.js["']/)
  assert.match(page, /from\('reviews'\)/)
  assert.match(page, /status', 'published'/)
  assert.match(card, /ratingValue/)
  assert.match(card, /ratingCount/)
  assert.doesNotMatch(page, /50,000|15,000|100,000/)
})

test('total frontend replacement has no legacy marketplace style layer', async () => {
  const layout = await read('src/app/layout.tsx')
  const globals = await read('src/app/globals.css')

  assert.doesNotMatch(layout, /future-marketplace(?:-overrides)?\\.css/)
  for (const legacyFile of ['src/app/future-marketplace.css', 'src/app/future-marketplace-overrides.css']) {
    await assert.rejects(readFile(new URL('../' + legacyFile, import.meta.url)))
  }

  for (const legacySelector of ['.header {', '.product-card {', '.hero {', '.category-card {', '.products-grid {', '.section-header {', '.mobile-nav {']) {
    assert.equal(globals.includes(legacySelector), false, 'legacy selector remains: ' + legacySelector)
  }
  assert.match(globals, /\.deba-market-card\s*\{/)
  assert.match(globals, /\.deba-site-header\s*\{/)
})

test('marketplace hardening exposes location, seller stores, chat, and optimistic favorites', async () => {
  const location = await read('src/app/api/location/route.ts')
  const store = await read('src/app/[sellerStoreKey]/page.tsx')
  const chatPage = await read('src/app/chat/page.tsx')
  const chatUi = await read('src/components/ChatCommsExact.tsx')
  const chatSurface = await read('public/deba-comms.html')
  const chatApi = await read('src/app/api/chat/rooms/[id]/messages/route.ts')
  const favorite = await read('src/components/FavoriteButton.tsx')
  const migration = await read('supabase/migrations/20260923220000_marketplace_hardening.sql')
  const chatMediaMigration = await read('supabase/migrations/20260925000100_private_chat_media_and_security_indexes.sql')
  const chatMembershipMigration = await read('supabase/migrations/20260925000200_lock_chat_participant_membership.sql')

  assert.match(location, /navigator|x-vercel-ip-city/i)
  assert.match(store, /seller_store_key/)
  assert.match(store, /status['"], ['"]published['"]/)
  assert.match(chatPage, /ChatCommsExact/)
  assert.match(chatPage, /initialProduct=/)
  assert.match(chatUi, /\/api\/chat\/rooms/)
  assert.match(chatUi, /setAccount/)
  assert.match(chatUi, /renderMessages/)
  assert.match(chatSurface, /DEBA COMMS/)
  assert.match(chatSurface, /accountUsername/)
  assert.match(chatSurface, /نشط الآن/)
  assert.match(chatSurface, /href=["']\//)
  assert.match(chatApi, /chat_security_events/)
  assert.match(chatApi, /x-forwarded-for/)
  assert.match(chatApi, /createSignedUrls/)
  assert.match(chatApi, /deba-chat-media/)
  assert.match(chatSurface, /عنوان MAC/)
  assert.match(chatMediaMigration, /deba-chat-media/)
  assert.match(chatMediaMigration, /insert into storage\.buckets[\s\S]+?public,[\s\S]+?false,/)
  assert.match(chatMediaMigration, /chat media private read/)
  assert.match(chatMembershipMigration, /drop policy if exists "chat_participants_insert_self"/)
  assert.match(chatMembershipMigration, /revoke insert on public\.chat_participants from anon, authenticated/)
  assert.match(favorite, /deba:favorite-changed/)
  assert.match(favorite, /setIsFavorite(!previous)/)
  assert.match(migration, /profiles_seller_store_key_uidx/)
  assert.match(migration, /chat_security_events/)
})
