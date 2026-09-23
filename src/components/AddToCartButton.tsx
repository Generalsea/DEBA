'use client'

import { Check, Loader2, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import type { CartProduct } from '@/lib/types'
import { addToCart } from '@/lib/cart-store'

type AddToCartButtonProps = {
  product: CartProduct
  disabled?: boolean
}

export default function AddToCartButton({
  product,
  disabled = false,
}: AddToCartButtonProps) {
  const [state, setState] = useState<'idle' | 'added'>('idle')

  function handleClick() {
    if (disabled || state === 'added') return

    addToCart(product, 1)
    setState('added')
    window.setTimeout(() => setState('idle'), 1400)
  }

  return (
    <button
      type="button"
      className={'deba-product-cart-button' + (state === 'added' ? ' is-added' : '')}
      onClick={handleClick}
      disabled={disabled || product.quantityAvailable < 1}
      aria-live="polite"
    >
      {state === 'added' ? (
        <>
          <Check size={16} aria-hidden="true" />
          تمت الإضافة
        </>
      ) : (
        <>
          {disabled ? (
            <Loader2 size={16} className="deba-spin" aria-hidden="true" />
          ) : (
            <ShoppingCart size={16} aria-hidden="true" />
          )}
          إضافة إلى السلة
        </>
      )}
    </button>
  )
}
