'use client'

import { useEffect } from 'react'

type Props = {
  productId: string
}

export default function ProductViewTracker({ productId }: Props) {
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/products/' + encodeURIComponent(productId) + '/view', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      signal: controller.signal,
    }).catch(() => undefined)

    return () => controller.abort()
  }, [productId])

  return null
}
