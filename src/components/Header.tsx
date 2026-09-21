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
import { useState } from 'react'

export type HeaderCategory = {
  id: string
  nameAr: string
  slug: string
}

const FALLBACK_CATEGORIES: HeaderCategory[] = [
  { id: 'electronics', nameAr: 'إلكترونيات', slug: 'electronics' },
  { id: 'home-appliances', nameAr: 'أجهزة منزلية', slug: 'home-appliances' },
  { id: 'furniture-home', nameAr: 'أثاث ومنزل', slug: 'furniture-home' },
  { id: 'fashion', nameAr: 'ملابس وأحذية', slug: 'fashion' },
  { id: 'books-education', nameAr: 'كتب ومستلزمات تعليمية', slug: 'books-education' },
  { id: 'toys-hobbies', nameAr: 'ألعاب وهوايات', slug: 'toys-hobbies' },
  { id: 'vehicles-parts', nameAr: 'مركبات وقطع غيار', slug: 'vehicles-parts' },
  { id: 'tools-equipment', nameAr: 'معدات وأدوات', slug: 'tools-equipment' },
  { id: 'baby-kids', nameAr: 'مستلزمات أطفال', slug: 'baby-kids' },
  { id: 'sports-fitness', nameAr: 'رياضة ولياقة', slug: 'sports-fitness' },
]

type HeaderProps = {
  categories?: HeaderCategory[]
  initialSearch?: string
  initialCategory?: string
  favoriteCount?: number
  negotiationCount?: number
  cartCount?: number
}

function countLabel(value: number) {
  if (value <= 0) return null
  if (value > 99) return '99+'
  return new Intl.NumberFormat('ar-EG').format(value)
}

export default function Header({
  categories = FALLBACK_CATEGORIES,
  initialSearch = '',
  initialCategory = 'all',
  favoriteCount = 0,
  negotiationCount = 0,
  cartCount = 0,
}: HeaderProps) {
  const [query, setQuery] = useState(initialSearch)
  const [category, setCategory] = useState(initialCategory || 'all')
  const [mobileOpen, setMobileOpen] = useState(false)

  const visibleCategories = categories.length ? categories : FALLBACK_CATEGORIES
  const favoriteBadge = countLabel(favoriteCount)
  const negotiationBadge = countLabel(negotiationCount)
  const cartBadge = countLabel(cartCount)

  return (
    <header className="deba-header">
      <div className="deba-header-top">
        <div className="deba-header-inner">
          <button
            type="button"
            className="deba-mobile-menu"
            aria-label="فتح قائمة DEBA"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="deba-brand" aria-label="DEBA - الرئيسية">
            <span className="deba-brand-mark">D</span>
            <span className="deba-brand-text">
              <strong>DEBA</strong>
              <small>سوق القيمة والتبادل</small>
            </span>
          </Link>

          <form className="deba-search" action="/" method="get" role="search">
            <div className="deba-search-category">
              <select
                name="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="اختيار فئة البحث"
              >
                <option value="all">كل الأقسام</option>
                {visibleCategories.map((item) => (
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
              aria-label="ابحث في DEBA"
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

            <button type="submit" className="deba-search-submit" aria-label="تنفيذ البحث">
              <Search size={21} strokeWidth={2.25} />
            </button>
          </form>

          <nav className="deba-header-actions" aria-label="روابط الحساب">
            <Link href="/login" className="deba-header-action">
              <span className="deba-icon-wrap">
                <UserRound size={19} />
              </span>
              <span className="deba-action-copy">
                <small>مرحبًا</small>
                <strong>حسابي</strong>
              </span>
            </Link>

            <Link href="/login" className="deba-header-action deba-header-action-badge">
              <span className="deba-icon-wrap">
                <Heart size={19} />
                {favoriteBadge && <em>{favoriteBadge}</em>}
              </span>
              <span className="deba-action-copy">
                <small>المختارة</small>
                <strong>المفضلة</strong>
              </span>
            </Link>

            <Link href="/login" className="deba-header-action deba-header-action-badge">
              <span className="deba-icon-wrap">
                <MessageSquareText size={19} />
                {negotiationBadge && <em>{negotiationBadge}</em>}
              </span>
              <span className="deba-action-copy">
                <small>عروضك</small>
                <strong>المفاوضات</strong>
              </span>
            </Link>

            <Link href="/login" className="deba-header-action deba-header-cart">
              <span className="deba-icon-wrap">
                <ShoppingCart size={20} />
                {cartBadge && <em>{cartBadge}</em>}
              </span>
              <span className="deba-action-copy">
                <small>الإجمالي</small>
                <strong>السلة</strong>
              </span>
            </Link>

            <Link href="/login" className="deba-sell-button">
              <Plus size={18} />
              <span>أضف سلعة</span>
              <b>تبرع الآن</b>
            </Link>
          </nav>
        </div>
      </div>

      <div className={'deba-category-row' + (mobileOpen ? ' is-open' : '')}>
        <div className="deba-category-inner">
          <Link href="/" className="deba-category-all">
            <Menu size={17} />
            <span>تصفح جميع الأقسام</span>
          </Link>

          {visibleCategories.map((item) => (
            <Link
              key={item.id}
              href={'/?category=' + encodeURIComponent(item.slug)}
              className={initialCategory === item.slug ? 'is-active' : ''}
            >
              {item.nameAr}
            </Link>
          ))}

          <Link href="/?type=donation" className="deba-category-impact">
            تبرعات مجانية
          </Link>

          <Link href="/?type=sale" className="deba-category-last">
            أحدث العروض
          </Link>
        </div>
      </div>
    </header>
  )
}
