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
