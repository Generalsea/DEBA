'use client'

import { Heart } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type FavoriteButtonProps = {
  productId: string
  initialFavorite?: boolean
  size?: number
  className?: string
  label?: string
}

export default function FavoriteButton({
  productId,
  initialFavorite = false,
  size = 18,
  className = '',
  label = 'إضافة إلى المفضلة',
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite)
  const [loading, setLoading] = useState(false)
  const [errorState, setErrorState] = useState(false)

  async function toggleFavorite(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    if (loading) return

    const previous = isFavorite
    setErrorState(false)
    setLoading(true)
    setIsFavorite(!previous)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'
        window.location.assign('/login?next=' + encodeURIComponent(next))
        return
      }

      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId)

        if (error) throw error
        setIsFavorite(false)
        window.dispatchEvent(new CustomEvent('deba:favorite-changed', { detail: { productId, isFavorite: false } }))
      } else {
        const { error } = await supabase.from('favorites').insert({
          user_id: user.id,
          product_id: productId,
        })

        if (error && error.code !== '23505') throw error
        setIsFavorite(true)
        window.dispatchEvent(new CustomEvent('deba:favorite-changed', { detail: { productId, isFavorite: true } }))
      }
    } catch (error) {
      console.error('DEBA favorite toggle failed', error)
      setIsFavorite(previous)
      setErrorState(true)
      window.setTimeout(() => setErrorState(false), 1600)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={'deba-favorite-button' + (isFavorite ? ' is-favorite' : '') + (loading ? ' is-loading' : '') + (errorState ? ' has-error' : '') + (className ? ' ' + className : '')}
      aria-label={isFavorite ? 'إزالة من المفضلة' : label}
      aria-pressed={isFavorite}
      disabled={loading}
      onClick={toggleFavorite}
      aria-busy={loading}
    >
      <Heart
        size={size}
        strokeWidth={2}
        fill={isFavorite ? 'currentColor' : 'none'}
      />
    </button>
  )
}
