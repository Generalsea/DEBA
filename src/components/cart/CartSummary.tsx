'use client'

import { ArrowLeft, CheckCircle2, Tag } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useCartStore } from '@/lib/cart-store'
import type { OrderSummary } from '@/lib/types'
import { PriceBreakdown } from '@/components/shared/PriceBreakdown'

export function CartSummary({ checkoutAllowed = true }: { checkoutAllowed?: boolean }) {
  const { items } = useCartStore()
  const [promoCode, setPromoCode] = useState('')
  const [promoMessage, setPromoMessage] = useState<string | null>(null)
  const summary: OrderSummary = { subtotal: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0), shipping: 0, platformFee: 0, discount: 0, tax: 0, total: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) }
  return <aside className="deba-cart-summary"><div className="deba-cart-summary-head"><div><span>DEBA CART</span><h2>ملخص الطلب</h2></div><Tag size={20} /></div>
    <div className="deba-promo-box"><label htmlFor="deba-promo">كود الخصم</label><div><input id="deba-promo" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="أدخل كود الخصم" maxLength={40} /><button type="button" onClick={() => setPromoMessage(promoCode.trim() ? 'الكوبونات غير مفعّلة حاليًا في DEBA، لذلك لم يتم خصم أي مبلغ.' : 'أدخل كود الخصم عند تفعيل الكوبونات.')}>تطبيق</button></div>{promoMessage ? <p>{promoMessage}</p> : null}</div>
    <PriceBreakdown {...summary} />
    <div className="deba-cart-summary-note"><CheckCircle2 size={15} /><span>لا تتم إضافة شحن أو ضريبة أو رسوم منصة افتراضية. تظهر فقط عند تفعيل محركها الفعلي.</span></div>
    <Link href={checkoutAllowed ? '/checkout' : '#'} aria-disabled={!checkoutAllowed} onClick={(e) => { if (!checkoutAllowed) e.preventDefault() }} className={'deba-cart-checkout-button' + (!checkoutAllowed ? ' is-disabled' : '')}><span>إتمام الشراء</span><strong>{summary.total.toLocaleString('ar-EG')} ج.م</strong><ArrowLeft size={18} /></Link>
  </aside>
}