import 'server-only'

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  isNotificationEmailEnabled,
  type NotificationPreferences,
} from '@/lib/notifications/preferences'
import {
  NotificationEmailConfigurationError,
  sendNotificationEmail,
  type NotificationEmailRecord,
} from '@/lib/notifications/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type NotificationWebhookPayload = {
  notification?: Partial<NotificationEmailRecord>
}

function hasEqualSecret(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)

  if (actualBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(actualBuffer, expectedBuffer)
}

function parseNotification(value: unknown): NotificationEmailRecord | null {
  if (!value || typeof value !== 'object') return null

  const notification = value as Record<string, unknown>
  const id = typeof notification.id === 'string' ? notification.id.trim() : ''
  const userId = typeof notification.user_id === 'string' ? notification.user_id.trim() : ''
  const type = typeof notification.type === 'string' ? notification.type.trim() : ''
  const title = typeof notification.title === 'string' ? notification.title.trim() : ''
  const body = typeof notification.body === 'string' ? notification.body.trim() : ''
  const href =
    typeof notification.href === 'string' && notification.href.trim()
      ? notification.href.trim()
      : null
  const createdAt =
    typeof notification.created_at === 'string' ? notification.created_at : ''

  if (!id || !userId || !type || !title || !body || !createdAt) return null

  return {
    id,
    user_id: userId,
    type,
    title,
    body,
    href,
    metadata:
      notification.metadata && typeof notification.metadata === 'object'
        ? (notification.metadata as Record<string, unknown>)
        : {},
    created_at: createdAt,
  }
}

export async function POST(request: Request) {
  const configuredSecret = process.env.DEBA_NOTIFICATION_WEBHOOK_SECRET?.trim()

  if (!configuredSecret) {
    return NextResponse.json(
      { error: 'إرسال البريد الداخلي غير مهيأ.' },
      { status: 503 },
    )
  }

  const receivedSecret = request.headers.get('x-deba-notification-secret')?.trim() || ''
  if (!receivedSecret || !hasEqualSecret(receivedSecret, configuredSecret)) {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 })
  }

  let payload: NotificationWebhookPayload

  try {
    payload = (await request.json()) as NotificationWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Payload غير صالح.' }, { status: 400 })
  }

  const notification = parseNotification(payload.notification)
  if (!notification) {
    return NextResponse.json({ error: 'بيانات الإشعار غير مكتملة.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const [{ data: authUser, error: authError }, { data: preferences, error: preferencesError }, { data: storedNotification, error: notificationError }] =
    await Promise.all([
      admin.auth.admin.getUserById(notification.user_id),
      admin
        .from('notification_preferences')
        .select('order_updates,payment_updates,shipping_updates,security_updates,marketing_updates')
        .eq('user_id', notification.user_id)
        .maybeSingle(),
      admin
        .from('notifications')
        .select('id,user_id,type,title,body,href,metadata,created_at')
        .eq('id', notification.id)
        .maybeSingle(),
    ])

  if (authError || !authUser.user?.email) {
    return NextResponse.json({ ok: true, skipped: 'no-email-address' }, { status: 202 })
  }

  if (notificationError) {
    console.error('DEBA notification lookup failed', notificationError)
    return NextResponse.json({ error: 'تعذر التحقق من الإشعار.' }, { status: 503 })
  }

  const canonicalNotification = (storedNotification || notification) as NotificationEmailRecord
  const typedPreferences = (preferences || null) as NotificationPreferences | null

  if (preferencesError) {
    console.error('DEBA notification preferences lookup failed', preferencesError)
    return NextResponse.json({ error: 'تعذر قراءة تفضيلات الإشعارات.' }, { status: 503 })
  }

  if (!isNotificationEmailEnabled(canonicalNotification.type, typedPreferences)) {
    return NextResponse.json({ ok: true, skipped: 'preference-disabled' }, { status: 204 })
  }

  try {
    const result = await sendNotificationEmail({
      to: authUser.user.email,
      notification: canonicalNotification,
    })

    return NextResponse.json(
      { ok: true, provider: 'resend', providerMessageId: result.id || null },
      { status: 202 },
    )
  } catch (error) {
    if (error instanceof NotificationEmailConfigurationError) {
      console.error('DEBA notification email configuration error', error.message)
      return NextResponse.json({ error: 'مزود البريد غير مهيأ.' }, { status: 503 })
    }

    console.error('DEBA notification email delivery failed', error)
    return NextResponse.json({ error: 'تعذر إرسال البريد الإلكتروني.' }, { status: 503 })
  }
}
