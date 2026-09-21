import { PaymobProvider } from './paymob'
import type { PaymentProvider } from './types'

export function getPaymentProvider(): PaymentProvider {
  const providerName = (process.env.PAYMENT_PROVIDER || 'paymob').trim().toLowerCase()

  if (providerName === 'paymob') {
    return new PaymobProvider()
  }

  throw new Error('Unsupported payment provider: ' + providerName)
}

export { PaymobProvider } from './paymob'
export type * from './types'
