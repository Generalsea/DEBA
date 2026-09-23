'use client'

import Link from 'next/link'
import { Grid2X2, Heart, Home, ShoppingCart, UserRound } from 'lucide-react'
import type { HeaderCategory } from '@/components/Header'
import { useCartStore } from '@/lib/cart-store'

type MobileNavigationProps = {
  categories?: HeaderCategory[]
  favoriteCount?: number
  authenticated?: boolean
}

export default function MobileNavigation({
  categories = [],
  favoriteCount = 0,
  authenticated = false,
}: MobileNavigationProps) {
  const cart = useCartStore()
  const cartCount = cart.hydrated
    ? cart.items.reduce((sum, item) => sum + item.quantity, 0)
    : 0

  const favoritesHref = authenticated
    ? '/profile?tab=favorites'
    : '/login?next=%2Fprofile%3Ftab%3Dfavorites'
  const accountHref = authenticated ? '/profile' : '/login?next=%2Fprofile'

  return (
    <nav className="deba-mobile-nav" aria-label="التنقل الرئيسي على الهاتف">
      <Link href="/" className="deba-mobile-nav-item">
        <span><Home size={20} aria-hidden="true" /></span>
        <strong>الرئيسية</strong>
      </Link>

      <details className="deba-mobile-nav-categories">
        <summary className="deba-mobile-nav-item">
          <span><Grid2X2 size={20} aria-hidden="true" /></span>
          <strong>الأقسام</strong>
        </summary>
        <div className="deba-mobile-category-panel">
          <Link href="/?category=all">كل الأقسام</Link>
          {categories.map((category) => (
            <Link key={category.id} href={'/?category=' + encodeURIComponent(category.slug)}>
              {category.nameAr}
            </Link>
          ))}
        </div>
      </details>

      <Link href={favoritesHref} className="deba-mobile-nav-item">
        <span>
          <Heart size={20} aria-hidden="true" />
          {favoriteCount > 0 ? <em>{favoriteCount > 99 ? '99+' : favoriteCount}</em> : null}
        </span>
        <strong>المفضلة</strong>
      </Link>

      <Link href="/cart" className="deba-mobile-nav-item">
        <span>
          <ShoppingCart size={20} aria-hidden="true" />
          {cartCount > 0 ? <em>{cartCount > 99 ? '99+' : cartCount}</em> : null}
        </span>
        <strong>السلة</strong>
      </Link>

      <Link href={accountHref} className="deba-mobile-nav-item">
        <span><UserRound size={20} aria-hidden="true" /></span>
        <strong>حسابي</strong>
      </Link>
    </nav>
  )
}
