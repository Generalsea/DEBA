'use client'

import Link from 'next/link'

export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label="DEBA الرئيسية">
          <span className="site-brand-mark">D</span>
          <span>DEBA</span>
        </Link>

        <nav className="site-nav" aria-label="التنقل الرئيسي">
          <Link href="/#marketplace">السوق</Link>
          <Link href="/#donations">التبرعات</Link>
          <Link href="/login">تسجيل الدخول</Link>
        </nav>
      </div>
    </header>
  )
}
