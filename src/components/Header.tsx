'use client'

import {
  ChevronDown,
  Heart,
  MessageSquareText,
  Plus,
  Search,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'

const categories = [
  'كل الفئات',
  'إلكترونيات',
  'أثاث ومستلزمات',
  'أجهزة منزلية',
  'ملابس',
  'كتب',
  'أطفال',
  'سيارات',
  'تبرعات عاجلة',
]

export default function Header() {
  return (
    <header className="market-header">
      <div className="market-header-main">
        <Link href="/" className="market-brand" aria-label="DEBA الرئيسية">
          <span className="market-brand-mark">D</span>
          <span className="market-brand-copy">
            <strong>DEBA</strong>
            <small>سوق التبادل المصري</small>
          </span>
        </Link>

        <form className="market-search" action="/" method="get" role="search">
          <select
            name="category"
            aria-label="اختيار الفئة"
            defaultValue="all"
            className="market-search-category"
          >
            <option value="all">كل الفئات</option>
            {categories.slice(1).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <input
            name="q"
            type="search"
            placeholder="ابحث عن سلعة، تبرع، أو فئة..."
            aria-label="البحث عن سلعة أو تبرع"
          />

          <button type="submit" aria-label="بحث">
            <Search size={21} strokeWidth={2.2} />
          </button>
        </form>

        <nav className="market-actions" aria-label="إجراءات الحساب">
          <Link href="/login" className="market-action">
            <UserRound size={19} />
            <span>حسابي</span>
          </Link>

          <Link href="/login" className="market-action market-action-with-count">
            <Heart size={19} />
            <span>المفضلة</span>
          </Link>

          <Link href="/login" className="market-action market-action-with-count">
            <MessageSquareText size={19} />
            <span>المفاوضات</span>
          </Link>

          <Link href="/login" className="market-sell">
            <Plus size={18} />
            <span>أضف سلعة / تبرع الآن</span>
          </Link>
        </nav>
      </div>

      <div className="market-category-bar">
        <div className="market-category-inner">
          <span className="market-category-menu">
            <ChevronDown size={16} />
            تصفح جميع الفئات
          </span>

          {categories.slice(1).map((category) => (
            <Link
              key={category}
              href={'/?category=' + encodeURIComponent(category)}
              className={category === 'تبرعات عاجلة' ? 'is-impact' : ''}
            >
              {category}
            </Link>
          ))}
        </div>
      </div>
    </header>
  )
}
