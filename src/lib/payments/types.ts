export type PaymentStatus =
  | 'pending'
  | 'requires_action'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded'

export type PaymentCustomer = {
  firstName: string
  lastName: string
  email: string
  phone: string
  city?: string
  state?: string
  street?: string
  country?: string
}

export type PaymentItem = {
  name: string
  amount: number
  quantity: number
}

export type CreatePaymentIntentInput = {
  orderId: string
  referenceCode: string
  amount: number
  currency: string
  items: PaymentItem[]
  customer: PaymentCustomer
  callbackBaseUrl: string
}

export type PaymentIntentResult = {
  providerPaymentId: string | null
  providerOrderId: string | null
  clientSecret: string | null
  checkoutUrl: string
  raw: Record<string, unknown>
}

export type RefundPaymentInput = {
  transactionId: string
  amount: number
}

export type RefundPaymentResult = {
  providerRefundId: string | null
  raw: Record<string, unknown>
}

export interface PaymentProvider {
  readonly name: string
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>
  verifyTransactionWebhook(payload: unknown, receivedHmac: string): boolean
  mapWebhookStatus(payload: unknown, expectedAmount: number): PaymentStatus
}
