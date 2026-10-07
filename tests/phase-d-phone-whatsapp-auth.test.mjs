import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function read(path) {
  return readFile(new URL('../' + path, import.meta.url), 'utf8')
}

test('Phase D phone normalizer accepts Egyptian mobile E.164 only', async () => {
  const phone = await read('src/lib/auth/egyptian-phone.ts')

  assert.match(phone, /\+20/)
  assert.match(phone, /010/)
  assert.match(phone, /011/)
  assert.match(phone, /012/)
  assert.match(phone, /015/)
  assert.match(phone, /0020/)
  assert.match(phone, /ARABIC_DIGITS/)
  assert.match(phone, /isValidEgyptianPhone/)
  assert.match(phone, /assertEgyptianPhone/)
  assert.doesNotMatch(phone, /\+44|\+1|foreign/)
})

test('Phase D OTP send is WhatsApp-only and rate-limited server-side', async () => {
  const route = await read('src/app/api/auth/otp/send/route.ts')
  const limiter = await read('src/utils/auth/otpRateLimit.ts')

  assert.match(route, /sameOrigin/)
  assert.match(route, /enforceOtpSendRateLimits/)
  assert.match(route, /channel: 'whatsapp'/)
  assert.match(route, /shouldCreateUser: true/)
  assert.doesNotMatch(route, /channel: 'sms'/)
  assert.doesNotMatch(route, /DEBA_ALLOW_DEV_OTP|console.*OTP/i)

  assert.match(limiter, /consume_api_rate_limit/)
  assert.match(limiter, /sha256/)
  assert.match(limiter, /send-phone/)
  assert.match(limiter, /send-ip/)
  assert.match(limiter, /send-device/)
  assert.match(limiter, /return false/)
})

test('Phase D OTP verification uses the Supabase phone OTP verification contract', async () => {
  const route = await read('src/app/api/auth/otp/verify/route.ts')

  assert.match(route, /enforceOtpVerifyRateLimits/)
  assert.match(route, /verifyOtp/)
  assert.match(route, /type: 'sms'/)
  assert.match(route, /PHONE.*?verification|رمز التحقق/s)
  assert.doesNotMatch(route, /email.*otp|magiclink/i)
})

test('Phase D phone trust cannot be self-asserted through public.profiles', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')
  assert.match(migration, /sync_profile_phone_verified/)
  assert.match(migration, /before insert or update of phone_verified on public\.profiles/)
  assert.match(migration, /new\.phone_verified := exists/)
  assert.match(migration, /phone_confirmed_at/)
})

test('Phase D phone trust is projected from auth.users and enforced by database triggers', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')

  assert.match(migration, /phone_verified boolean not null default false/)
  assert.match(migration, /phone_confirmed_at/)
  assert.match(migration, /sync_profile_phone_verification/)
  assert.match(migration, /assert_marketplace_phone_verified/)
  assert.match(migration, /products/)
  assert.match(migration, /chat_rooms/)
  assert.match(migration, /messages/)
  assert.match(migration, /offers/)
  assert.match(migration, /current_setting\('request.jwt.claim.role'/)
  assert.match(migration, /42501/)
  assert.match(migration, /\^\\\+20\(10\|11\|12\|15\)/)
})

test('Phase D important marketplace APIs return an explicit phone-verification boundary', async () => {
  const chat = await read('src/app/api/chat/rooms/route.ts')
  const offer = await read('src/app/api/smart-offers/route.ts')
  const trust = await read('src/utils/auth/phoneTrust.ts')

  assert.match(chat, /requireVerifiedPhone/)
  assert.match(offer, /requireVerifiedPhone/)
  assert.match(trust, /PHONE_VERIFICATION_REQUIRED/)
  assert.match(trust, /phone_confirmed_at/)
  assert.match(trust, /status: 403/)
})

test('Phase D seller UI fails before draft creation when phone is not verified', async () => {
  const form = await read('src/app/sell/ProductListingForm.tsx')
  assert.match(form, /userData.user.phone_confirmed_at/)
  assert.match(form, /PHONE_VERIFICATION_REQUIRED/)
  assert.match(form, /توثيق رقم الهاتف المصري عبر WhatsApp/)
})

test('Phase D listing detail only displays phone trust when evidence exists', async () => {
  const page = await read('src/app/products/[slug]/page.tsx')
  assert.match(page, /phone_verified/)
  assert.match(page, /هاتف موثّق/)
  assert.doesNotMatch(page, /هاتف موثّق.*true/)
})

test('Phase D auth UX is phone-first, RTL, OTP-friendly, and contains no primary Google/email login', async () => {
  const page = await read('src/app/(auth)/login/page.tsx')
  const css = await read('src/app/globals.css')

  assert.match(page, /إرسال رمز WhatsApp/)
  assert.match(page, /otp-send/)
  assert.match(page, /otp-verify/)
  assert.match(page, /one-time-code/)
  assert.match(page, /changeNumber/)
  assert.match(page, /إعادة إرسال الرمز/)
  assert.match(page, /dir="rtl"/)
  assert.doesNotMatch(page, /signInWithPassword|signInWithOAuth|المتابعة باستخدام Google/)
  assert.match(css, /\.deba-phone-auth-page/)
  assert.match(css, /\.deba-otp-input/)
  assert.match(css, /\.deba-phone-input/)
  assert.match(css, /@media \(max-width: 760px\)/)
})

test('Phase D auth code does not expose service-role or private credentials to the browser', async () => {
  const page = await read('src/app/(auth)/login/page.tsx')
  assert.doesNotMatch(page, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|service_role/i)
})


test('Phase D prevents direct profile phone mutation outside Auth verification', async () => {
  const route = await read('src/app/api/profile/route.ts')
  assert.match(route, /PHONE_CHANGE_REQUIRES_VERIFICATION/)
  assert.match(route, /normalizeEgyptianPhone/)
  assert.match(route, /verifiedAuthPhone/)
  assert.match(route, /phone: verifiedAuthPhone/)
})

test('Phase D seller verification is downstream of verified phone trust', async () => {
  const route = await read('src/app/api/seller-verification/route.ts')
  assert.match(route, /requireVerifiedPhone/)
  assert.match(route, /status: 403/)
})

test('Phase D stale phone-change cleanup is scheduled and removes unconfirmed stale attempts', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')
  assert.match(migration, /cleanup_stale_phone_change/)
  assert.match(migration, /phone_change_sent_at/)
  assert.match(migration, /phone_change_token = null/)
  assert.match(migration, /deba-auth-cleanup-stale-phone-change/)
  assert.match(migration, /0 \* \* \* \*/)
})

test('Phase D reuses existing trust and safety infrastructure instead of inventing a parallel risk stack', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')
  const risk = await read('supabase/migrations/20260921210000_risk_engine.sql')
  const trust = await read('supabase/migrations/20260925201854_public_profiles_trust_reviews_moderation_20260925.sql')

  assert.match(migration, /api_rate_limit/i)
  assert.match(risk, /risk_assessments/)
  assert.match(trust, /chat_security_events|reports|auto_pause_reported_product/)
})


test('Phase D keeps seller trust signals evidence-backed', async () => {
  const page = await read('src/app/products/[slug]/page.tsx')
  const trustMigration = await read('supabase/migrations/20260925201854_public_profiles_trust_reviews_moderation_20260925.sql')

  assert.match(page, /get_seller_rating_summary/)
  assert.match(page, /phone_verified/)
  assert.match(page, /هاتف موثّق/)
  assert.match(page, /بائع موثّق/)
  assert.match(page, /reviewCount/)
  assert.match(trustMigration, /verified_seller/)
  assert.match(trustMigration, /review_count/)
})

test('Phase D synchronizes a newly confirmed Auth phone into profile_private', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')

  assert.match(migration, /insert into public\.profile_private\(user_id, phone, updated_at\)/)
  assert.match(migration, /phone = excluded\.phone/)
  assert.match(migration, /phone_confirmed_at/)
})


test('Phase D presence is realtime, read-only for observers, and scoped per user', async () => {
  const tracker = await read('src/components/PresenceSessionTracker.tsx')
  const observer = await read('src/components/UserPresence.tsx')
  const account = await read('src/components/AccountDashboard.tsx')
  const layout = await read('src/app/layout.tsx')

  assert.match(tracker, /deba:presence:' \+ userId/)
  assert.match(tracker, /presence:/)
  assert.match(tracker, /track\(/)
  assert.match(tracker, /onAuthStateChange/)
  assert.match(tracker, /removeChannel/)

  assert.match(observer, /deba:presence:' \+ userId/)
  assert.match(observer, /presenceState/)
  assert.doesNotMatch(observer, /\.track\(/)

  assert.match(account, /<UserPresence userId={account\.userId}/)
  assert.match(account, /متصل الآن/)
  assert.match(layout, /<PresenceSessionTracker \/>/)
})

test('Phase D must not expose premium presence controls without a verified premium entitlement source', async () => {
  const tracker = await read('src/components/PresenceSessionTracker.tsx')
  const observer = await read('src/components/UserPresence.tsx')
  assert.doesNotMatch(tracker, /show.*offline|display.*offline/i)
  assert.doesNotMatch(observer, /premium|subscription|اشتراك|مدفوع/i)
})


test('Phase D presence uses private Realtime channels with RLS owner-only publish', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')
  const tracker = await read('src/components/PresenceSessionTracker.tsx')
  const observer = await read('src/components/UserPresence.tsx')

  assert.match(migration, /realtime\.messages/)
  assert.match(migration, /realtime\.topic\(\)/)
  assert.match(migration, /extension = 'presence'/)
  assert.match(migration, /deba:presence:%/)
  assert.match(migration, /deba:presence:'? \|\|?/)
  assert.match(migration, /auth\.uid\(\)/)
  assert.match(tracker, /config: \{ private: true \}/)
  assert.match(observer, /config: \{ private: true \}/)
})


test('Phase D chat abuse signals are deterministic, advisory, and attached to existing message metadata', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')
  const route = await read('src/app/api/chat/rooms/[id]/messages/route.ts')

  assert.match(migration, /annotate_chat_abuse_signals/)
  assert.match(migration, /rapid_messages/)
  assert.match(migration, /repeated_content/)
  assert.match(migration, /now\(\) - interval '2 minutes'/)
  assert.match(migration, /now\(\) - interval '10 minutes'/)
  assert.match(migration, /to_jsonb\(v_risk_flags\)/)
  assert.match(route, /chat_security_events/)
})


test('Phase D seller verification RPC itself enforces phone trust against direct API bypass', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')
  assert.match(migration, /create or replace function public\.start_seller_verification/)
  assert.match(migration, /perform private\.assert_marketplace_phone_verified\(\)/)
})


test('Phase D presence never maps a channel failure to a false offline claim', async () => {
  const observer = await read('src/components/UserPresence.tsx')
  assert.match(observer, /unavailable/)
  assert.match(observer, /الحالة غير متاحة/)
})


test('Phase D legacy phone constraint is intentionally NOT VALID while protecting future writes', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')
  assert.match(
    migration,
    /add constraint profile_private_phone_egyptian_check[\s\S]{0,300}\) not valid;/,
  )
  assert.match(migration, /phone ~ '\^\\\+20\(10\|11\|12\|15\)\[0-9\]\{8\}\$'/)
})

test('Phase D migration has one transaction boundary and no production activation command', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')
  assert.equal((migration.match(/^begin;$/gm) || []).length, 1)
  assert.equal((migration.match(/^commit;$/gm) || []).length, 1)
  assert.doesNotMatch(migration, /supabase db push|production|apply migration/i)
})


test('Phase D marketplace phone guard preserves authenticated admin/service access', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')
  assert.match(migration, /private\.is_admin\(\)/)
  assert.match(migration, /service_role/)
  assert.match(migration, /supabase_admin/)
})


test('Phase D duplicate listing protection is advisory, scoped, and non-blocking', async () => {
  const migration = await read('supabase/migrations/20261004140000_phase_d_phone_identity.sql')

  assert.match(migration, /annotate_listing_risk_signals/)
  assert.match(migration, /possible_duplicate_listing/)
  assert.match(migration, /30 days/)
  assert.match(migration, /0\.92/)
  assert.match(migration, /system_risk_flags/)
  assert.doesNotMatch(migration, /raise exception[^\n]*duplicate/i)
})
