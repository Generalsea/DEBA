'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ProductDetailError({
  reset,
}: {
  reset: () => void
}) {
  return (
    <main className="deba-detail-page deba-detail-state-page" dir="rtl">
      <section className="deba-detail-state-card deba-detail-error-state">
        <div className="deba-detail-state-icon is-error">
          <AlertTriangle size={28} />
        </div>
        <span className="deba-detail-state-kicker">DEBA PRODUCT PAGE</span>
        <h1>تعذر تحميل صفحة السلعة</h1>
        <p>
          حدث خطأ أثناء تحميل البيانات أو أحد مكونات الصفحة. أعد المحاولة، وإذا
          تكرر الخطأ يظهر الآن هذا التنبيه بدل صفحة فارغة.
        </p>
        <button type="button" className="deba-detail-state-action" onClick={reset}>
          <RefreshCw size={17} />
          إعادة المحاولة
        </button>
      </section>
    </main>
  )
}
