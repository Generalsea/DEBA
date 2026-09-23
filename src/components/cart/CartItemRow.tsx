'use client'

import Image from 'next/image'
import { Bookmark, CheckCircle2, MoreVertical, Trash2, TriangleAlert } from 'lucide-react'
import type { CartItem } from '@/lib/types'
import { moveCartItemToSaved, removeFromCart, updateCartQuantity } from '@/lib/cart-store'
import { QuantitySelector } from '@/components/shared/QuantitySelector'

const CONDITIONS: Record<string, string> = { new: 'جديد', like_new: 'كالجديد', excellent: 'ممتاز', good: 'جيد', fair: 'مقبول', poor: 'يحتاج عناية', for_parts: 'للقطع / الإصلاح' }

export function CartItemRow({ item }: { item: CartItem }) {
  const unavailable = item.product.quantityAvailable < 1
  const lowStock = !unavailable && item.product.quantityAvailable <= 3 && item.quantity >= item.product.quantityAvailable
  const condition = item.product.conditionGrade ? CONDITIONS[item.product.conditionGrade] || 'حالة غير محددة' : 'حالة غير محددة'
  return (
    <article className="deba-cart-item">
      <div className="deba-cart-item-media">
        {item.product.imageUrl ? <Image src={item.product.imageUrl} alt={item.product.imageAlt} fill sizes="110px" /> : <div className="deba-product-placeholder"><span>DEBA</span></div>}
        {unavailable ? <span className="deba-cart-item-badge unavailable">غير متاح</span> : lowStock ? <span className="deba-cart-item-badge warning">كمية محدودة</span> : null}
      </div>
      <div className="deba-cart-item-content">
        <div className="deba-cart-item-title-row"><div><span className="deba-cart-item-kicker">{condition}</span><h2>{item.product.title}</h2></div><strong className="deba-cart-item-total">{(item.product.price * item.quantity).toLocaleString('ar-EG')} {item.product.currency}</strong></div>
        <div className="deba-cart-item-meta"><span>{item.product.price.toLocaleString('ar-EG')} {item.product.currency} × {item.quantity}</span><span>البائع: {item.product.sellerName}</span></div>
        <div className="deba-cart-item-footer">
          {!unavailable ? <QuantitySelector value={item.quantity} min={1} max={Math.max(1, item.product.quantityAvailable)} onChange={(value) => updateCartQuantity(item.id, value)} /> : <div className="deba-cart-unavailable-note"><TriangleAlert size={15} />المنتج لم يعد متاحًا للشراء.</div>}
          <div className="deba-cart-item-actions"><button type="button" onClick={() => moveCartItemToSaved(item.id)}><Bookmark size={15} />حفظ لوقت لاحق</button><button type="button" onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) removeFromCart(item.id) }} className="is-danger"><Trash2 size={15} />حذف</button><span className="deba-cart-item-more" aria-hidden="true"><MoreVertical size={18} /></span></div>
        </div>
        {lowStock ? <div className="deba-cart-stock-warning"><TriangleAlert size={15} /><span>متبقي فقط {item.product.quantityAvailable.toLocaleString('ar-EG')} قطع في المخزون.</span></div> : null}
        {!unavailable ? <div className="deba-cart-trust-line"><CheckCircle2 size={14} /><span>السعر ثابت — يتم التحقق من المخزون مرة أخرى عند تأكيد الطلب.</span></div> : null}
      </div>
    </article>
  )
}