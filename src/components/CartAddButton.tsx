'use client'
import { CheckCircle2, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { addToCart } from '@/lib/cart-store'
import type { CartProduct } from '@/lib/types'
export default function CartAddButton({ product }: { product: CartProduct }) {
  const [added, setAdded] = useState(false)
  return <button type="button" className="deba-add-to-cart-button" disabled={product.quantityAvailable < 1} onClick={() => { addToCart(product); setAdded(true); window.setTimeout(() => setAdded(false), 1600) }}>{added ? <CheckCircle2 size={18} /> : <ShoppingCart size={18} />}{added ? 'تمت الإضافة للسلة' : 'أضف للسلة'}</button>
}