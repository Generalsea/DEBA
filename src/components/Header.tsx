'use client'

import Link from 'next/link'

export type HeaderCategory = {
  id: string
  nameAr: string
  slug: string
}

type HeaderProps = {
  categories?: HeaderCategory[]
  initialSearch?: string
  initialCategory?: string
}

export default function Header({
  categories = [],
  initialSearch = '',
  initialCategory = 'all',
}: HeaderProps) {
  const ordered = categories

  return (
    <header className="header">
      <div className="header-top">
        <div className="header-top-content">
          <span>🚚 شحن مجاني للطلبات فوق 500 جنيه</span>
          <span>📞 دعم العملاء: 19999</span>
        </div>
      </div>

      <div className="header-main">
        <Link href="/" className="logo">
          <div className="logo-icon">🛍️</div>
          <span>سوق</span>
        </Link>

        <form action="/" method="get" className="search-bar">
          <input
            name="q"
            type="text"
            defaultValue={initialSearch}
            placeholder="ابحث عن منتجات، بائعين، أو فئات..."
            aria-label="البحث في سوق"
          />
          {initialCategory && initialCategory !== 'all' && (
            <input type="hidden" name="category" value={initialCategory} />
          )}
          <button type="submit" className="search-btn" aria-label="بحث">
            🔍
          </button>
        </form>

        <div className="header-actions">
          <Link href="/login" className="header-btn btn-outline">
            تسجيل الدخول
          </Link>
          <Link href="/login" className="header-btn btn-primary">
            ابدأ البيع
          </Link>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-content">
          <Link
            href="/"
            className={'nav-item' + (!initialCategory || initialCategory === 'all' ? ' active' : '')}
          >
            الرئيسية
          </Link>

          {ordered.map((item) => (
            <Link
              key={item.id}
              href={'/?category=' + encodeURIComponent(item.slug)}
              className={'nav-item' + (initialCategory === item.slug ? ' active' : '')}
            >
              {item.nameAr}
            </Link>
          ))}

          <Link href="/?type=donation#donations" className="nav-item">
            تبرعات
          </Link>

          <Link href="/login" className="nav-item">
            البائعون
          </Link>
        </div>
      </nav>
    </header>
  )
}
