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
  const reportsApi = await read('src/app/api/reports/route.ts')
  const productTabs = await read('src/components/ProductDetailTabs.tsx')
  const migration = await read('supabase/migrations/20260923220000_marketplace_hardening.sql')
  const chatMediaMigration = await read('supabase/migrations/20260925000100_private_chat_media_and_security_indexes.sql')
  const chatMembershipMigration = await read('supabase/migrations/20260925000200_lock_chat_participant_membership.sql')
  const chatMessageRpcMigration = await read('supabase/migrations/20260925162444_lock_direct_chat_message_insert.sql')
  const rateLimitMigration = await read('supabase/migrations/20260925164000_api_rate_limits.sql')
  const rateLimitHelper = await read('src/utils/rateLimit.ts')

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
  assert.match(chatApi, /send_chat_message/)
  assert.equal(/\.from\('messages'\)\s*\.insert/.test(chatApi), false)
  assert.match(chatSurface, /عنوان MAC/)
  assert.match(chatMediaMigration, /deba-chat-media/)
  assert.match(chatMediaMigration, /insert into storage\.buckets[\s\S]+?public,[\s\S]+?false,/)
  assert.match(chatMediaMigration, /chat media private read/)
  assert.match(chatMembershipMigration, /drop policy if exists "chat_participants_insert_self"/)
  assert.match(chatMembershipMigration, /revoke insert on public\.chat_participants from anon, authenticated/)
  assert.match(chatMessageRpcMigration, /create or replace function private\.send_chat_message/)
  assert.match(chatMessageRpcMigration, /revoke insert on public\.messages from anon, authenticated/)
  assert.match(chatMessageRpcMigration, /grant execute on function public\.send_chat_message/)
  assert.match(rateLimitMigration, /create table if not exists public\.api_rate_limits/)
  assert.match(rateLimitMigration, /consume_api_rate_limit/)
  assert.match(rateLimitMigration, /security definer/)
  assert.match(rateLimitHelper, /consume_api_rate_limit/)
  assert.match(rateLimitHelper, /allowed/)\n  assert.match(rateLimitHelper, /return \{ allowed: false, limit, windowSeconds \}/)
  assert.match(favorite, /deba:favorite-changed/)
  assert.match(favorite, /setIsFavorite\(!previous\)/)
  assert.match(reportsApi, /ALLOWED_REASONS/)
  assert.match(reportsApi, /from\('reports'\)/)
  assert.match(productTabs, /\/api\/reports/)
  assert.match(productTabs, /إبلاغ عن الإعلان/)
  assert.match(migration, /profiles_seller_store_key_uidx/)
  assert.match(migration, /chat_security_events/)
})

test('authenticated Playwright path is wired and offer lifecycle is database-enforced', async () => {
  const e2e = await read('e2e/authenticated-marketplace.spec.ts')
  const config = await read('playwright.config.ts')
  const packageJson = JSON.parse(await read('package.json'))
  const migration = await read('supabase/migrations/20260925190000_offer_lifecycle.sql')
  const chatUi = await read('src/components/ChatCommsExact.tsx')
  const chatApi = await read('src/app/api/chat/rooms/[id]/messages/route.ts')
  const login = await read('src/app/(auth)/login/page.tsx')
  const productCard = await read('src/components/ProductCard.tsx')
  const productTabs = await read('src/components/ProductDetailTabs.tsx')
  const workflow = await read('.github/workflows/authenticated-e2e.yml')

  assert.equal(packageJson.devDependencies['@playwright/test'], '1.63.0')
  assert.equal(packageJson.scripts.e2e, 'playwright test')
  assert.match(config, /defineConfig/)
  assert.match(e2e, /DEBA_E2E_EMAIL/)
  assert.match(e2e, /DEBA_E2E_PASSWORD/)
  assert.match(e2e, /DEBA_E2E_ALLOW_MUTATIONS/)
  assert.match(e2e, /login-email/)
  assert.match(e2e, /marketplace-search/)
  assert.match(e2e, /chat-create-offer/)
  assert.match(e2e, /report-submit/)
  assert.match(workflow, /playwright install --with-deps chromium/)
  assert.match(workflow, /secrets\.DEBA_E2E_EMAIL/)
  assert.match(migration, /offers_message_id_uidx/)
  assert.match(migration, /private\.apply_chat_offer_action/)
  assert.match(migration, /revoke insert, update, delete on public\.offers/)
  assert.match(migration, /status = 'countered'/)
  assert.match(migration, /status = case when p_action = 'accept' then 'accepted' else 'rejected' end/)
  assert.doesNotMatch(chatUi, /metadata\.kind === 'offer_action'.*insertMessage/s)
  assert.match(chatUi, /أدخل قيمة العرض المقابل بالجنيه/)
  assert.match(chatApi, /parentOfferMessageId/)
  assert.match(chatApi, /apply_chat_offer_action/)
  assert.match(login, /data-testid="login-email"/)
  assert.match(login, /data-testid="login-password"/)
  assert.match(productCard, /data-testid="product-card"/)
  assert.match(productTabs, /data-testid="report-submit"/)
})


test('Arabic search intelligence uses normalized PostgreSQL FTS with safe fallback', async () => {
  const migration = await read(
    'supabase/migrations/20260925172342_arabic_search_intelligence.sql',
  )
  const page = await read('src/app/page.tsx')

  assert.match(migration, /private\.deba_normalize_arabic/)
  assert.match(migration, /to_tsvector\(['"]arabic['"]/)
  assert.match(migration, /gin_trgm_ops/)
  assert.match(migration, /pg_trgm/)
  assert.match(migration, /search_marketplace_products/)
  assert.match(migration, /search_synonyms/)
  assert.match(migration, /similarity\(/)
  assert.match(migration, /word_similarity\(/)
  assert.match(page, /search_marketplace_products/)
  assert.match(page, /falling back to ILIKE search/)
  assert.doesNotMatch(page, /productQuery = productQuery\.or\('title\.ilike\./)
})

test('search quality hardening preserves exact and phrase priority, brand intent, pagination, telemetry, and rate-limit isolation', async () => {
  const migration = await read('supabase/migrations/20260925210000_search_quality_relevance_telemetry.sql')
  const page = await read('src/app/page.tsx')
  const types = await read('src/types/database.generated.ts')

  assert.match(migration, /search_brand_groups/)
  assert.match(migration, /deba_detect_search_brands/)
  assert.match(migration, /filtered\.normalized_title = normalized_query/)
  assert.match(migration, /position\([\s\S]+normalized_query[\s\S]+normalized_title/)
  assert.match(migration, /brand-intent isolation/i)
  assert.match(migration, /total_count bigint/)
  assert.match(migration, /count\(\*\) over\(\)/i)
  assert.match(migration, /search_telemetry_daily/)
  assert.match(migration, /record_search_telemetry/)
  assert.match(migration, /to anon, authenticated/)
  assert.match(migration, /using \(false\)/)
  assert.match(page, /p_offset: searchOffset/)
  assert.match(page, /searchTotalCount/)
  assert.match(page, /after\(/)
  assert.match(page, /record_search_telemetry/)
  assert.match(page, /deba-classified-pagination/)
  assert.match(types, /total_count: number/)
})


test('seller dashboard and listing lifecycle are RPC-driven with private view telemetry', async () => {
  const migration = await read(
    'supabase/migrations/20260925200517_seller_dashboard_listing_lifecycle_20260925.sql',
  )
  const viewFix = await read(
    'supabase/migrations/20260925200528_fix_product_view_rpc_volatility_20260925.sql',
  )
  const partialEdit = await read(
    'supabase/migrations/20260925200553_preserve_seller_listing_description_on_partial_edit_20260925.sql',
  )
  const panel = await read('src/components/SellerListingsPanel.tsx')
  const sellForm = await read('src/app/sell/ProductListingForm.tsx')
  const tracker = await read('src/components/ProductViewTracker.tsx')
  const viewRoute = await read('src/app/api/products/[id]/view/route.ts')
  const productPage = await read('src/app/products/[slug]/page.tsx')

  assert.match(migration, /'paused'::text/)
  assert.match(migration, /product_views/)
  assert.match(migration, /private\.get_seller_dashboard/)
  assert.match(migration, /private\.update_seller_listing_status/)
  assert.match(migration, /guard_seller_product_lifecycle/)
  assert.match(migration, /SELLER_PRODUCT_LIFECYCLE_USE_RPC/)
  assert.match(migration, /status = 'draft'/)
  assert.match(migration, /moderation_status = 'pending'/)
  assert.match(migration, /revoke execute on function public\.get_seller_dashboard/)
  assert.match(migration, /grant execute on function public\.update_seller_listing_status/)
  assert.match(viewFix, /language plpgsql\s*volatile/)
  assert.match(viewFix, /language sql\s*volatile/)
  assert.match(partialEdit, /when p_description is null then v_product\.description/)

  assert.match(panel, /get_seller_dashboard/)
  assert.match(panel, /update_seller_listing_status/)
  assert.match(panel, /update_seller_listing/)
  assert.doesNotMatch(panel, /from\(['"]products['"]\)\s*\.update/)
  assert.match(sellForm, /update_seller_listing_status/)
  assert.doesNotMatch(sellForm, /from\(['"]products['"]\)\s*\.update/)
  assert.match(tracker, /api\/products\//)
  assert.match(viewRoute, /deba_visitor_id/)
  assert.match(viewRoute, /record_product_view/)
  assert.match(productPage, /ProductViewTracker/)
})

test('seller lifecycle private functions expose only required execute roles', async () => {
  const migration = await read(
    'supabase/migrations/20260925200827_restrict_seller_lifecycle_private_function_exec_20260925.sql',
  )

  assert.match(migration, /revoke execute on function private\.record_product_view/)
  assert.match(migration, /grant execute on function private\.record_product_view.*anon, authenticated/s)
  assert.match(migration, /revoke execute on function private\.get_seller_dashboard/)
  assert.match(migration, /grant execute on function private\.get_seller_dashboard.*authenticated/s)
  assert.match(migration, /revoke execute on function private\.update_seller_listing_status/)
  assert.match(migration, /grant execute on function private\.update_seller_listing_status.*authenticated/s)
  assert.match(migration, /revoke execute on function private\.update_seller_listing\(/)
  assert.match(migration, /grant execute on function private\.update_seller_listing\(.*authenticated/s)
  assert.match(migration, /revoke execute on function private\.guard_seller_product_lifecycle/)
})

test('product view telemetry keeps direct table access denied and indexed', async () => {
  const migration = await read(
    'supabase/migrations/20260925200916_harden_product_view_telemetry_access_20260925.sql',
  )

  assert.match(migration, /product_views_viewer_id_idx/)
  assert.match(migration, /product_views_no_direct_select/)
  assert.match(migration, /product_views_no_direct_insert/)
  assert.match(migration, /using \(false\)/)
  assert.match(migration, /with check \(false\)/)
})

test('seller partial edits preserve unedited description and location fields', async () => {
  const migration = await read(
    'supabase/migrations/20260925201036_preserve_seller_listing_location_on_partial_edit_20260925.sql',
  )

  assert.match(migration, /when p_description is null then v_product\.description/)
  assert.match(migration, /when p_city is null then v_product\.city/)
  assert.match(migration, /when p_governorate is null then v_product\.governorate/)
  assert.match(migration, /when p_district is null then v_product\.district/)
})

test('public profiles expose only public identity and seller trust aggregates', async () => {
  const page = await read('src/app/members/[username]/page.tsx')
  const store = await read('src/app/[sellerStoreKey]/page.tsx')
  const migration = await read(
    'supabase/migrations/20260925201854_public_profiles_trust_reviews_moderation_20260925.sql',
  )

  assert.match(page, /\.eq\(['"]is_public['"], true\)/)
  assert.match(page, /seller_store_key/)
  assert.match(page, /get_seller_rating_summary/)
  assert.doesNotMatch(page, /addressLine1|addressLine2|postalCode|document_storage_path|selfie_storage_path/)
  assert.match(store, /get_seller_rating_summary/)
  assert.match(store, /sellerReviews/)
  assert.match(store, /verifiedPurchase/)

  assert.match(migration, /get_seller_rating_summary/)
  assert.match(migration, /review_count >= 5/)
  assert.match(migration, /average_rating >= 4\.5/)
  assert.match(migration, /revoke insert, update, delete on public\.reviews/)
  assert.match(migration, /grant select on public\.reviews/)
})

test('report lifecycle is database-enforced and product reports can auto-pause at threshold', async () => {
  const route = await read('src/app/api/admin/moderation/route.ts')
  const reportApi = await read('src/app/api/reports/route.ts')
  const tabs = await read('src/components/ProductDetailTabs.tsx')
  const migration = await read(
    'supabase/migrations/20260925201854_public_profiles_trust_reviews_moderation_20260925.sql',
  )

  assert.match(route, /review_report/)
  assert.match(route, /admin_update_report_status/)
  assert.match(route, /under_review/)
  assert.match(reportApi, /fraud/)
  assert.match(reportApi, /prohibited_item/)
  assert.match(reportApi, /reason,\n        description/)
  assert.doesNotMatch(reportApi, /reason \+ ': '/)
  assert.match(tabs, /value="fraud"/)
  assert.match(tabs, /value="prohibited_item"/)
  assert.doesNotMatch(tabs, /value="scam"/)
  assert.match(migration, /count\(distinct reporter_id\)/)
  assert.match(migration, /v_distinct_reporters < 3/)
  assert.match(migration, /status = 'paused'/)
  assert.match(migration, /moderation_status = 'needs_changes'/)
  assert.match(migration, /report\.threshold_auto_pause/)
  assert.match(migration, /Only open reports can enter review/)
  assert.match(migration, /Review the report before resolving or dismissing it/)
})
 
test('verified seller ratings are only writable through transaction-bound review creation', async () => {
  const trust = await read('supabase/migrations/20260921202505_phase_2_trust_core.sql')
  const form = await read('src/components/SellerReviewForm.tsx')
  const api = await read('src/app/api/reviews/route.ts')

  assert.match(trust, /v_order\.status <> 'completed'/)
  assert.match(trust, /target_type = 'seller'/)
  assert.match(trust, /p_target_id <> v_order\.seller_id/)
  assert.match(form, /targetType: 'seller'/)
  assert.match(form, /targetId: sellerId/)
  assert.match(form, /Idempotency-Key/)
  assert.match(api, /rpc\('create_review'/)
  assert.match(api, /targetType !== 'product' && targetType !== 'seller'/)
  assert.match(api, /p_target_type: targetType/)
})

test('direct report row mutations are revoked for public API roles', async () => {
  const migration = await read(
    'supabase/migrations/20260925202257_lock_direct_report_mutations_20260925.sql',
  )

  assert.match(migration, /revoke update, delete on public\.reports from anon, authenticated/)
})

test('public review feeds expose safe columns instead of direct review table reads', async () => {
  const reviewApi = await read('src/app/api/reviews/route.ts')
  const store = await read('src/app/[sellerStoreKey]/page.tsx')
  const migration = await read(
    'supabase/migrations/20260925202524_safe_public_review_feeds_20260925.sql',
  )
  const limitFix = await read(
    'supabase/migrations/20260925202541_fix_seller_review_feed_limit_20260925.sql',
  )

  assert.match(reviewApi, /get_product_review_feed/)
  assert.doesNotMatch(reviewApi, /from\(['"]reviews['"]\)/)
  assert.match(store, /get_seller_review_feed/)
  assert.doesNotMatch(store, /from\(['"]reviews['"]\)/)
  assert.match(migration, /revoke select on public\.reviews from anon, authenticated/)
  assert.match(migration, /get_product_review_feed/)
  assert.match(migration, /verifiedPurchase/)
  assert.match(migration, /case when coalesce\(p\.is_public,false\)/)
  assert.match(limitFix, /limit greatest\(1, least\(coalesce\(p_limit,6\), 12\)\)/)
})
