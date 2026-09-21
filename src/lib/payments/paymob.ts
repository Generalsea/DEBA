import crypto from 'node:crypto'
import type {
  CreatePaymentIntentInput,
  PaymentIntentResult,
  PaymentProvider,
  PaymentStatus,
} from './types'

const DEFAULT_BASE_URL = 'https://accept.paymob.com'

type PaymobTransaction = {
  id?: number | string
  amount_cents?: number | string
  created_at?: string
  currency?: string
  error_occured?: boolean
  has_parent_transaction?: boolean
  integration_id?: number | string
  is_3d_secure?: boolean
  is_auth?: boolean
  is_capture?: boolean
  is_refunded?: boolean
  is_standalone_payment?: boolean
  is_voided?: boolean
  owner?: number | string
  pending?: boolean
  success?: boolean
  order?: { id?: number | string; merchant_order_id?: string }
  source_data?: { pan?: string; sub_type?: string; type?: string }
  refunded_amount_cents?: number | string
}

type PaymobWebhookBody = {
  type?: string
  obj?: PaymobTransaction
}

function env(name: string) {
  return process.env[name]?.trim() || ''
}

function booleanString(value: unknown) {
  return value === true ? 'true' : value === false ? 'false' : String(value ?? '')
}

function validateTransactionShape(obj: PaymobTransaction) {
  return [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    obj.order?.id,
    obj.owner,
    obj.pending,
    obj.source_data?.pan,
    obj.source_data?.sub_type,
    obj.source_data?.type,
    obj.success,
  ].every((value) => value !== undefined && value !== null)
}

function transactionHmacMessage(obj: PaymobTransaction) {
  if (!validateTransactionShape(obj)) return null

  return [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    booleanString(obj.error_occured),
    booleanString(obj.has_parent_transaction),
    obj.id,
    obj.integration_id,
    booleanString(obj.is_3d_secure),
    booleanString(obj.is_auth),
    booleanString(obj.is_capture),
    booleanString(obj.is_refunded),
    booleanString(obj.is_standalone_payment),
    booleanString(obj.is_voided),
    obj.order?.id,
    obj.owner,
    booleanString(obj.pending),
    obj.source_data?.pan,
    obj.source_data?.sub_type,
    obj.source_data?.type,
    booleanString(obj.success),
  ]
    .map(String)
    .join('')
}

function verifyHmac(obj: PaymobTransaction, receivedHmac: string, secret: string) {
  if (!receivedHmac || !secret) return false

  const message = transactionHmacMessage(obj)
  if (!message) return false

  const computed = crypto.createHmac('sha512', secret).update(message).digest('hex')
  const received = receivedHmac.trim().toLowerCase()

  if (computed.length !== received.length) return false

  return crypto.timingSafeEqual(
    Buffer.from(computed, 'utf8'),
    Buffer.from(received, 'utf8'),
  )
}

export class PaymobProvider implements PaymentProvider {
  readonly name = 'paymob'

  private readonly baseUrl = env('PAYMOB_BASE_URL') || DEFAULT_BASE_URL
  private readonly secretKey = env('PAYMOB_SECRET_KEY')
  private readonly publicKey = env('PAYMOB_PUBLIC_KEY')
  private readonly hmacSecret = env('PAYMOB_HMAC_SECRET')
  private readonly integrationIds = env('PAYMOB_INTEGRATION_IDS')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)

  isConfigured() {
    return Boolean(
      this.secretKey &&
        this.publicKey &&
        this.hmacSecret &&
        this.integrationIds.length,
    )
  }

  async createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResult> {
    if (!this.isConfigured()) {
      throw new Error('PAYMOB_NOT_CONFIGURED')
    }

    const amountCents = Math.round(input.amount * 100)
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error('PAYMOB_INVALID_AMOUNT')
    }

    const callbackBaseUrl = input.callbackBaseUrl.replace(/\/$/, '')

    const response = await fetch(this.baseUrl + '/v1/intention/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Token ' + this.secretKey,
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: input.currency,
        payment_methods: this.integrationIds,
        items: input.items.map((item) => ({
          name: item.name.slice(0, 120),
          amount: Math.round(item.amount * 100),
          quantity: item.quantity,
        })),
        billing_data: {
          first_name: input.customer.firstName.slice(0, 50),
          last_name: input.customer.lastName.slice(0, 50),
          email: input.customer.email.slice(0, 120),
          phone_number: input.customer.phone.slice(0, 30),
          city: (input.customer.city || 'Cairo').slice(0, 50),
          state: (input.customer.state || input.customer.city || 'Cairo').slice(0, 50),
          street: (input.customer.street || 'DEBA marketplace').slice(0, 120),
          country: (input.customer.country || 'EG').slice(0, 2),
        },
        special_reference: input.referenceCode,
        expiration: 3600,
        notification_url: callbackBaseUrl + '/api/payments/webhooks/paymob',
        redirection_url:
          callbackBaseUrl +
          '/payment/complete?orderId=' +
          encodeURIComponent(input.orderId),
      }),
      cache: 'no-store',
    })

    const payload = (await response.json()) as Record<string, unknown>

    if (!response.ok) {
      console.error('Paymob intention API failed', {
        status: response.status,
        payload,
      })
      throw new Error('PAYMOB_INTENTION_FAILED')
    }

    const clientSecret =
      typeof payload.client_secret === 'string' ? payload.client_secret : null

    if (!clientSecret) {
      throw new Error('PAYMOB_CLIENT_SECRET_MISSING')
    }

    const checkoutUrl =
      this.baseUrl +
      '/unifiedcheckout/?publicKey=' +
      encodeURIComponent(this.publicKey) +
      '&clientSecret=' +
      encodeURIComponent(clientSecret)

    return {
      providerPaymentId:
        payload.id !== undefined && payload.id !== null ? String(payload.id) : null,
      providerOrderId:
        payload.intention_order_id !== undefined &&
        payload.intention_order_id !== null
          ? String(payload.intention_order_id)
          : null,
      clientSecret,
      checkoutUrl,
      raw: payload,
    }
  }

  async refundPayment(input: { transactionId: string; amount: number }) {
    if (!this.isConfigured()) {
      throw new Error('PAYMOB_NOT_CONFIGURED')
    }

    const amountCents = Math.round(input.amount * 100)
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error('PAYMOB_INVALID_AMOUNT')
    }

    const response = await fetch(
      this.baseUrl + '/api/acceptance/void_refund/refund',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Token ' + this.secretKey,
        },
        body: JSON.stringify({
          transaction_id: Number(input.transactionId),
          amount_cents: amountCents,
        }),
        cache: 'no-store',
      },
    )

    const payload = (await response.json()) as Record<string, unknown>

    if (!response.ok) {
      console.error('Paymob refund API failed', {
        status: response.status,
        payload,
      })
      throw new Error('PAYMOB_REFUND_FAILED')
    }

    return {
      providerRefundId:
        payload.id !== undefined && payload.id !== null ? String(payload.id) : null,
      raw: payload,
    }
  }

  verifyTransactionWebhook(payload: unknown, receivedHmac: string) {
    const body = payload as PaymobWebhookBody
    return Boolean(body.obj && verifyHmac(body.obj, receivedHmac, this.hmacSecret))
  }

  mapWebhookStatus(payload: unknown, expectedAmount: number): PaymentStatus {
    const body = payload as PaymobWebhookBody
    const obj = body.obj

    if (!obj) return 'failed'

    const amountCents = Number(obj.amount_cents || 0)
    const refundedCents = Number(obj.refunded_amount_cents || 0)
    const expectedCents = Math.round(expectedAmount * 100)

    if (obj.is_refunded || refundedCents >= expectedCents) return 'refunded'
    if (refundedCents > 0) return 'partially_refunded'
    if (obj.success === true && obj.pending === false && obj.is_voided !== true) {
      return amountCents === expectedCents ? 'paid' : 'failed'
    }
    if (obj.pending === true) return 'processing'
    if (obj.is_voided === true) return 'cancelled'

    return 'failed'
  }
}
