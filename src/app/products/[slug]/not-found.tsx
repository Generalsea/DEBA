import Link from 'next/link'
import { ArrowRight, SearchX } from 'lucide-react'

export default function ProductDetailNotFound() {
  return (
    <main className="deba-detail-page deba-detail-state-page" dir="rtl">
      <section className="deba-detail-state-card deba-detail-empty-state">
        <div className="deba-detail-state-icon">
          <SearchX size={28} />
        </div>
        <span className="deba-detail-state-kicker">PRODUCT NOT FOUND</span>
        <h1>السلعة غير موجودة</h1>
        <p>
          لم نتمكن من العثور على هذه السلعة أو أنها لم تعد متاحة للعرض العام.
        </p>
        <Link href="/" className="deba-detail-state-action">
          <ArrowRight size={17} />
          العودة إلى السوق
        </Link>
      </section>
    </main>
  )
}
