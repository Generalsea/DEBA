import test from 'node:test'
import assert from 'node:assert/strict'
import { sendNotificationEmail } from '../src/lib/notifications/email-core.ts'

test('transactional email request is built and delivered through a mocked Resend transport', async () => {
  try {
    process.env.RESEND_API_KEY = 're_test_phase4'
    process.env.RESEND_FROM_EMAIL = 'DEBA <notifications@example.test>'

    const calls = []
    const notification = {
      id: '00000000-0000-0000-0000-000000000004',
      user_id: '00000000-0000-0000-0000-000000000005',
      type: 'offer.created',
      title: 'وصل عرض جديد',
      body: 'وصل عرض بقيمة 1200 EGP.',
      href: '/chat',
      metadata: {},
      created_at: '2026-09-29T19:00:00.000Z',
    }

    const result = await sendNotificationEmail({
      to: 'buyer@example.test',
      notification,
      siteUrl: 'https://deba.example.test',
      fetchImpl: async (input, init) => {
        calls.push({ input: String(input), init })
        return new Response(JSON.stringify({ id: 'resend_test_123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })

    assert.equal(result.id, 'resend_test_123')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].input, 'https://api.resend.com/emails')

    const headers = new Headers(calls[0].init.headers)
    assert.equal(headers.get('authorization'), 'Bearer re_test_phase4')
    assert.equal(
      headers.get('idempotency-key'),
      'deba-notification-00000000-0000-0000-0000-000000000004',
    )

    const payload = JSON.parse(calls[0].init.body)
    assert.deepEqual(payload.to, ['buyer@example.test'])
    assert.equal(payload.from, 'DEBA <notifications@example.test>')
    assert.equal(payload.subject, '[DEBA] وصل عرض جديد')
    assert.match(payload.html, /lang="ar" dir="rtl"/)
    assert.match(payload.html, /1200 EGP/)
    assert.equal(payload.html.includes('<script'), false)
  } finally {
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM_EMAIL
  }
})

test('transactional email integration fails closed when the provider rejects the request', async () => {
  try {
    process.env.RESEND_API_KEY = 're_test_phase4'
    process.env.RESEND_FROM_EMAIL = 'DEBA <notifications@example.test>'

    await assert.rejects(
      sendNotificationEmail({
        to: 'buyer@example.test',
        notification: {
          id: '00000000-0000-0000-0000-000000000006',
          user_id: '00000000-0000-0000-0000-000000000007',
          type: 'order.updated',
          title: 'تحديث الطلب',
          body: 'تم تحديث الطلب.',
          href: null,
          metadata: {},
          created_at: '2026-09-29T19:00:00.000Z',
        },
        fetchImpl: async () =>
          new Response(JSON.stringify({ message: 'rate limited' }), {
            status: 429,
            headers: { 'content-type': 'application/json' },
          }),
      }),
      /Resend email failed: rate limited/,
    )
  } finally {
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM_EMAIL
  }
})
