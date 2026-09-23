export type DeliveryMethod = 'pickup' | 'seller_delivery' | 'platform_delivery'

export type CartProduct = {
  id: string
  title: string
  slug: string
  price: number
  currency: string
  conditionGrade: string | null
  listingType: 'sale'
  quantityAvailable: number
  sellerId: string
  sellerName: string
  sellerAvatar: string | null
  imageUrl: string | null
  imageAlt: string
  deliveryMethod: 'pickup' | 'seller_delivery' | 'platform_delivery' | 'both'
}

export type CartItem = {
  id: string
  product: CartProduct
  quantity: number
  savedForLater?: boolean
  addedAt: string
}

export type Address = {
  id: string
  label: string
  fullName: string
  phone: string
  governorate: string
  city: string
  district: string
  street: string
  building?: string
  floor?: string
  apartment?: string
  isDefault: boolean
  notes?: string
}

export type CartDeliverySelection = Record<string, DeliveryMethod | undefined>

export type OrderSummary = {
  subtotal: number
  shipping: number
  platformFee: number
  discount: number
  tax: number
  total: number
}

export type CheckoutGroup = {
  sellerId: string
  sellerName: string
  items: CartItem[]
  deliveryMethod: DeliveryMethod | null
}

export type CheckoutOrder = {
  orderId: string
  referenceCode: string
  status: string
  subtotal: number
  shippingFee: number
  platformFee: number
  total: number
  currency: string
  sellerId: string
  itemCount: number
}

export type PaymentChoice = 'online' | 'cod' | 'instapay'