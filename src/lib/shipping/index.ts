import type { ShippingProvider } from './types'

class ManualShippingProvider implements ShippingProvider {
  readonly name = 'manual'
}

export function getShippingProvider(): ShippingProvider {
  const provider = (process.env.SHIPPING_PROVIDER || 'manual').trim().toLowerCase()

  if (provider === 'manual') return new ManualShippingProvider()

  throw new Error('Unsupported shipping provider: ' + provider)
}

export type * from './types'
