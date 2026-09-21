export type ShipmentStatus =
  | 'pending'
  | 'label_created'
  | 'ready'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'returned'

export type CreateShipmentInput = {
  orderId: string
  address: Record<string, unknown>
  serviceLevel?: string
  shippingFee?: number
}

export interface ShippingProvider {
  readonly name: string
}
