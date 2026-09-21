'use client'

import {
  ChevronDown,
  Heart,
  Menu,
  MessageSquareText,
  Plus,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export type HeaderCategory = {
  id: string
  nameAr: string
  slug: string
}

type HeaderProps = {
  categories?: HeaderCategory[]
  initialSearch?: string
  initialCategory?: string
  favoriteCount?: number
  negotiationCount?: number
  cartCount?: number
}

function badge(value: number) {
  return value > 99 ? '99+' : new Intl.NumberFormat('ar-EG').format(Math.max(0, value))
}

export default function Header({
  categories = [],
  initialSearch = '',
  initialCategory = 'all',
  favoriteCount = 0,
  negotiationCount = 0,
  cartCount = 0,
}: HeaderProps) {
  const [query, setQuery] = useState(initialSearch)
  const [category, setCategory] = useState(initialCategory || 'all')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setQuery(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setCategory(initialCategory || 'all')
  }, [initialCategory])

  const items = categories

  return (
    <header className="deba-site-header">
      <div className="deba-header-main">
        <div className="deba-header-inner">
          <button
            type="button"
            className="deba-mobile-trigger"
            aria-label={menuOpen ? 'إغلاق قائمة الأقسام' : 'فتح قائمة الأقسام'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="deba-brand" aria-label="DEBA - الرئيسية">
            <span className="deba-brand-mark">D</span>
            <span className="deba-brand-copy">
              <strong>DEBA</strong>
              <small>سوق التبادل المصري</small>
            </span>
          </Link>

          <form action="/" method="get" className="deba-search" role="search">
            <div className="deba-search-category">
              <select
                name="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="اختيار قسم البحث"
              >
                <option value="all">كل الأقسام</option>
                {items.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.nameAr}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>

            <input
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="ابحث عن سلعة، تبرع، أو قسم..."
              aria-label="البحث في DEBA"
            />

            {query && (
              <button
                type="button"
                className="deba-search-clear"
                aria-label="مسح البحث"
                onClick={() => setQuery('')}
              >
                <X size={16} />
              </button>
            )}

            <button type="submit" className="deba-search-submit" aria-label="بحث">
              <Search size={21} strokeWidth={2.2} />
            </button>
          </form>

          <nav className="deba-header-actions" aria-label="الحساب والتسوق">
            <Link href="/login" className="deba-action">
              <span className="deba-action-icon"><UserRound size={19} /></span>
              <span className="deba-action-text"><small>مرحبًا</small><strong>حسابي</strong></span>
            </Link>

            <Link href="/login" className="deba-action">
              <span className="deba-action-icon">
                <Heart size={19} />
                <em>{badge(favoriteCount)}</em>
              </span>
              <span className="deba-action-text"><small>المختارة</small><strong>المفضلة</strong></span>
            </Link>

            <Link href="/login" className="deba-action">
              <span className="deba-action-icon">
                <MessageSquareText size={19} />
                <em>{badge(negotiationCount)}</em>
              </span>
              <span className="deba-action-text"><small>عروضك</small><strong>التفاوض</strong></span>
            </Link>

            <Link href="/login" className="deba-action">
              <span className="deba-action-icon deba-cart-icon">
                <ShoppingCart size={19} />
                <em>{badge(cartCount)}</em>
              </span>
              <span className="deba-action-text"><small>طلباتك</small><strong>السلة</strong></span>
            </Link>

            <Link href="/login" className="deba-sell-button">
              <Plus size={18} />
              <span>أضف إعلانك</span>
            </Link>
          </nav>
        </div>
      </div>

      <div className={'deba-category-bar' + (menuOpen ? ' is-open' : '')}>
        <div className="deba-category-inner">
          <Link href="/" className="deba-category-all">
            <Menu size={16} />
            تصفح جميع الأقسام
          </Link>

          {items.map((item) => (
            <Link
              key={item.id}
              href={'/?category=' + encodeURIComponent(item.slug)}
              className={initialCategory === item.slug ? 'is-active' : ''}
            >
              {item.nameAr}
            </Link>
          ))}

          <Link href="/?type=donation" className="deba-category-impact">
            التبرعات المجانية
          </Link>
        </div>
      </div>
    </header>
  )
}
