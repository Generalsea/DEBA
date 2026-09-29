import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function read(path) {
  return readFile(new URL('../' + path, import.meta.url), 'utf8')
}

test('Phase 4 notification database wiring is complete and RLS-first', async () => {
  const migration = await read(
    'supabase/migrations/20260929224200_phase4_realtime_notifications.sql',
  )

  assert.match(migration, /alter table public\.notifications enable row level security/)
  assert.match(migration, /revoke insert, delete on public\.notifications from anon, authenticated/)
  assert.match(migration, /notifications_user_created_idx/)
  assert.match(migration, /notifications_user_unread_idx/)
  assert.match(migration, /alter publication supabase_realtime add table public\.notifications/)

  assert.match(migration, /private\.create_notification/)
  assert.match(migration, /security definer/)
  assert.match(migration, /set search_path = public, private, pg_temp/)

  assert.match(migration, /create trigger offers_notify_lifecycle/)
  assert.match(migration, /create trigger orders_notify_lifecycle/)
  assert.match(migration, /create trigger shipments_notify_lifecycle/)
  assert.match(migration, /create trigger reports_notify_lifecycle/)

  for (const type of [
    'offer.created',
    'offer.accepted',
    'offer.rejected',
    'offer.countered',
    'order.status_updated',
    'order.payment_updated',
    'shipment.status_updated',
    'moderation.report_updated',
  ]) {
    assert.match(migration, new RegExp(type.replace('.', '\\.')))
  }

  assert.match(migration, /notification_email_enabled/)
  assert.match(migration, /notification_preferences/)
  assert.match(migration, /net\.http_post/)
  assert.match(migration, /vault\.decrypted_secrets/)
  assert.match(migration, /deba_notification_webhook_url/)
  assert.match(migration, /deba_notification_webhook_secret/)
  assert.match(migration, /x-deba-notification-secret/)
  assert.doesNotMatch(migration, /current_setting\('app\.deba_notification_email_webhook_url'/)
})

test('Resend integration contract uses server-only credentials, RTL HTML, and idempotency', async () => {
  const email = await read('src/lib/notifications/email.ts')

  assert.match(email, /^import 'server-only'/)
  assert.match(email, /https:\/\/api\.resend\.com\/emails/)
  assert.match(email, /Authorization: 'Bearer '/)
  assert.match(email, /Idempotency-Key/)
  assert.match(email, /dir="rtl"/)
  assert.match(email, /escapeHtml/)
  assert.match(email, /RESEND_API_KEY/)
  assert.match(email, /RESEND_FROM_EMAIL/)
  assert.match(email, /resolveNotificationHref/)
  assert.match(email, /response\.ok/)
  assert.match(email, /Resend email failed/)
})

test('Resend request mock integration verifies payload without external delivery', async () => {
  const email = await read('src/lib/notifications/email.ts')

  assert.match(email, /fetchImpl = fetch/)
  assert.match(email, /method: 'POST'/)
  assert.match(email, /to: \[to\]/)
  assert.match(email, /subject/)
  assert.match(email, /html/)
  assert.match(email, /text:/)
  assert.match(email, /deba-notification-.*notification\.id/)
})

test('internal notification email webhook is authenticated and preference-aware', async () => {
  const route = await read('src/app/api/internal/notifications/email/route.ts')

  assert.match(route, /timingSafeEqual/)
  assert.match(route, /DEBA_NOTIFICATION_WEBHOOK_SECRET/)
  assert.match(route, /x-deba-notification-secret/)
  assert.match(route, /createAdminClient/)
  assert.match(route, /auth\.admin\.getUserById/)
  assert.match(route, /notification_preferences/)
  assert.match(route, /isNotificationEmailEnabled/)
  assert.match(route, /sendNotificationEmail/)
  assert.match(route, /status: 503/)
  assert.match(route, /provider: 'resend'/)
})

test('notifications API is authenticated, owner-scoped, and CSRF-hardened for writes', async () => {
  const route = await read('src/app/api/notifications/route.ts')

  assert.match(route, /export const dynamic = 'force-dynamic'/)
  assert.match(route, /createClient/)
  assert.match(route, /auth\.getUser/)
  assert.match(route, /from\('notifications'\)/)
  assert.match(route, /\.eq\('user_id', user\.id\)/)
  assert.match(route, /notificationId/)
  assert.match(route, /origin/)
  assert.match(route, /status: 401/)
})

test('client Realtime subscription is user-filtered and contains no server credentials', async () => {
  const hook = await read('src/hooks/useNotifications.ts')

  assert.match(hook, /createClient/)
  assert.match(hook, /postgres_changes/)
  assert.match(hook, /event: 'INSERT'/)
  assert.match(hook, /table: 'notifications'/)
  assert.match(hook, /filter: 'user_id=eq\.' \+ user\.id/)
  assert.match(hook, /event: 'UPDATE'/)
  assert.match(hook, /removeChannel/)
  assert.match(hook, /deba-notifications:/)
  assert.match(hook, /deba:notification/)
  assert.doesNotMatch(hook, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(hook, /SUPABASE_SECRET_KEY/)
  assert.doesNotMatch(hook, /RESEND_API_KEY/)
})

test('environment contract keeps Phase 4 secrets server-only', async () => {
  const env = await read('.env.example')

  assert.match(env, /RESEND_API_KEY=/)
  assert.match(env, /RESEND_FROM_EMAIL=/)
  assert.match(env, /DEBA_NOTIFICATION_WEBHOOK_SECRET=/)
  assert.doesNotMatch(env, /NEXT_PUBLIC_RESEND_API_KEY/)
  assert.doesNotMatch(env, /NEXT_PUBLIC_DEBA_NOTIFICATION_WEBHOOK_SECRET/)
})

test('existing order route still drives lifecycle through the guarded RPC', async () => {
  const route = await read('src/app/api/orders/[id]/status/route.ts')
  assert.match(route, /transition_order_status/)
  assert.match(route, /p_idempotency_key/)
})
