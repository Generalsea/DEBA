'use client'

import type { OrderSummary } from '@/lib/types'

export function PriceBreakdown({ subtotal, shipping, platformFee, discount, tax, total }: OrderSummary) {
  return (
    <div className="deba-price-breakdown">
      <div><span>المجموع الفرعي</span><strong>{subtotal.toLocaleString('ar-EG')} ج.م</strong></div>
      {shipping > 0 ? <div><span>الشحن</span><strong>{shipping.toLocaleString('ar-EG')} ج.م</strong></div> : null}
      {platformFee > 0 ? <div><span>رسوم المنصة</span><strong>{platformFee.toLocaleString('ar-EG')} ج.م</strong></div> : null}
      {discount > 0 ? <div><span>الخصم</span><strong>−{discount.toLocaleString('ar-EG')} ج.م</strong></div> : null}
      {tax > 0 ? <div><span>الضريبة</span><strong>{tax.toLocaleString('ar-EG')} ج.م</strong></div> : null}
      <div className="is-total"><span>الإجمالي</span><strong>{total.toLocaleString('ar-EG')} ج.م</strong></div>
    </div>
  )
}