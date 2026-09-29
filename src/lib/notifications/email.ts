import 'server-only'

export type NotificationEmailRecord = {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  href?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export class NotificationEmailConfigurationError extends Error {}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getSiteUrl(value?: string) {
  const source = (value || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim()
  return source.replace(/\/$/, '')
}

export function resolveNotificationHref(href: string | null | undefined, siteUrl = getSiteUrl()) {
  if (!href) return null

  try {
    const target = new URL(href, siteUrl)
    const base = new URL(siteUrl)

    if (target.origin !== base.origin) return null

    return target.href
  } catch {
    return null
  }
}

export function buildNotificationEmailHtml(
  notification: NotificationEmailRecord,
  siteUrl = getSiteUrl(),
) {
  const href = resolveNotificationHref(notification.href, siteUrl)
  const title = escapeHtml(notification.title)
  const body = escapeHtml(notification.body).replace(/\r?\n/g, '<br />')
  const button = href
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;background:#FF6B35;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700">فتح في DEBA</a></p>`
    : ''

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#f5f7fa;font-family:Arial,'Segoe UI',sans-serif;direction:rtl">
    <div style="max-width:640px;margin:0 auto;padding:32px 16px">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">
        <div style="font-size:28px;font-weight:800;letter-spacing:-0.02em;color:#111827">DEBA</div>
        <div style="height:4px;width:56px;background:#FF6B35;border-radius:999px;margin:12px 0 24px"></div>
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.4;color:#111827">${title}</h1>
        <p style="margin:0;font-size:16px;line-height:1.9;color:#374151">${body}</p>
        ${button}
        <p style="margin:28px 0 0;font-size:12px;line-height:1.7;color:#6b7280">هذه رسالة تلقائية من DEBA. يمكنك إدارة تفضيلات الإشعارات من حسابك.</p>
      </div>
    </div>
  </body>
</html>`
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim()

  if (!apiKey || !fromEmail) {
    throw new NotificationEmailConfigurationError(
      'Missing RESEND_API_KEY or RESEND_FROM_EMAIL on the server.',
    )
  }

  return { apiKey, fromEmail }
}

export async function sendNotificationEmail({
  to,
  notification,
  fetchImpl = fetch,
  siteUrl,
}: {
  to: string
  notification: NotificationEmailRecord
  fetchImpl?: FetchLike
  siteUrl?: string
}) {
  const { apiKey, fromEmail } = getResendConfig()
  const html = buildNotificationEmailHtml(notification, siteUrl)
  const subject = '[DEBA] ' + notification.title

  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'deba-notification-' + notification.id,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
      text: notification.title + '\n\n' + notification.body,
    }),
  })

  const raw = await response.text()
  let payload: unknown = null

  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = raw
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message?: unknown }).message || 'Resend request failed')
        : 'Resend request failed'

    throw new Error('Resend email failed: ' + detail)
  }

  return payload as { id?: string }
}
