'use client'

import Image from 'next/image'
import { CheckCircle2, MapPin, PackageCheck, Truck } from 'lucide-react'
import type { CartItem, DeliveryMethod } from '@/lib/types'
import { setCartDeliveryMethod, useCartStore } from '@/lib/cart-store'
import { CartItemRow } from '@/components/cart/CartItemRow'

function supports(method: string, selected: DeliveryMethod) { return method === selected || (method === 'both' && selected !== 'platform_delivery') }
const OPTIONS: Array<{ value: DeliveryMethod; label: string; description: string; icon: typeof MapPin }> = [
  { value: 'pickup', label: 'استلام من البائع', description: 'بدون رسوم شحن محتسبة حاليًا.', icon: MapPin },
  { value: 'seller_delivery', label: 'توصيل عبر البائع', description: 'تكلفة الشحن ستحدد عند تفعيل مزود الشحن.', icon: Truck },
  { value: 'platform_delivery', label: 'توصيل عبر DEBA', description: 'متاح فقط للإعلانات التي تدعمه.', icon: PackageCheck },
]

export function SellerGroup({ sellerId, sellerName, sellerAvatar, items }: { sellerId: string; sellerName: string; sellerAvatar?: string | null; items: CartItem[] }) {
  const cart = useCartStore()
  const methods = OPTIONS.map((option) => option.value).filter((method) => items.every((item) => supports(item.product.deliveryMethod, method)))
  const savedSelection = cart.deliverySelections[sellerId]
  const selected = savedSelection && methods.includes(savedSelection) ? savedSelection : methods[0] || null
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  return (
    <section className="deba-seller-group">
      <div className="deba-seller-group-head">
        <div className="deba-seller-identity"><span className="deba-seller-avatar-small">{sellerAvatar ? <Image src={sellerAvatar} alt="" fill sizes="42px" /> : sellerName.trim().charAt(0).toUpperCase()}</span><div><span>البائع</span><strong>{sellerName}</strong></div></div>
        <div className="deba-seller-group-subtotal"><span>{items.length} {items.length === 1 ? 'منتج' : 'منتجات'}</span><strong>{subtotal.toLocaleString('ar-EG')} ج.م</strong></div>
      </div>
      <div className="deba-seller-group-items">{items.map((item) => <CartItemRow key={item.id} item={item} />)}</div>
      <div className="deba-seller-delivery"><div className="deba-seller-delivery-head"><div><span>DELIVERY</span><strong>طريقة الشحن</strong></div><Truck size={20} /></div>
        {methods.length ? <div className="deba-delivery-options">{OPTIONS.map((option) => { const Icon = option.icon; const active = selected === option.value; return <label key={option.value} className={active ? 'is-selected' : ''}><input type="radio" name={'cart-delivery-' + sellerId} checked={active} onChange={() => setCartDeliveryMethod(sellerId, option.value)} /><Icon size={18} /><span><strong>{option.label}</strong><small>{option.description}</small></span>{active ? <CheckCircle2 size={16} /> : null}</label> })}</div> : <div className="deba-cart-delivery-blocker"><MapPin size={17} />لا توجد طريقة استلام مشتركة بين منتجات هذا البائع.</div>}
      </div>
    </section>
  )
}