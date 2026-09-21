'use client'

import { BarChart3, Loader2, PackageCheck, Star, TriangleAlert, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'

type TopProduct = {
  id: string
  title: string
  slug: string
  orders: number
  revenue: number
  units: number
}

type Analytics = {
  ordersTotal: number
  ordersCompleted: number
  ordersOpen: number
  grossRevenue: number
  successfulRefunds: number
  publishedProducts: number
  productsSold: number
  reviewsCount: number
  averageRating: number
  disputesOpen: number
  last30DaysGross: number
  last30DaysOrders: number
  topProducts: TopProduct[]
}

function money(value: number) {
  return new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: 2,
  }).format(value) + ' EGP'
}

function number(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value)
}

export default function SellerAnalytics() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/analytics/seller', { cache: 'no-store' })
        const payload = (await response.json()) as { analytics?: Analytics; error?: string }
        if (!response.ok || !payload.analytics) {
          throw new Error(payload.error || 'تعذر تحميل التحليلات.')
        }
        setData(payload.analytics)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل التحليلات.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <section className="deba-analytics-state">
        <Loader2 size={22} className="deba-spin" />
        جارٍ تحميل تحليلات المبيعات...
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="deba-analytics-state">
        <TriangleAlert size={22} />
        {error || 'لا تتوفر بيانات التحليلات.'}
      </section>
    )
  }

  return (
    <section className="deba-analytics-panel">
      <div className="deba-analytics-head">
        <div>
          <span>SELLER ANALYTICS</span>
          <h2>أداء نشاطك على DEBA</h2>
          <p>الأرقام هنا محسوبة من الطلبات والمدفوعات والاستردادات والتقييمات الفعلية.</p>
        </div>
        <BarChart3 size={22} />
      </div>

      <div className="deba-analytics-grid">
        <article><WalletCards size={18} /><span>إجمالي المبيعات</span><strong>{money(data.grossRevenue)}</strong></article>
        <article><PackageCheck size={18} /><span>طلبات مكتملة</span><strong>{number(data.ordersCompleted)}</strong></article>
        <article><PackageCheck size={18} /><span>طلبات مفتوحة</span><strong>{number(data.ordersOpen)}</strong></article>
        <article><Star size={18} /><span>متوسط التقييم</span><strong>{data.averageRating ? data.averageRating.toFixed(2) : '—'}</strong></article>
        <article><PackageCheck size={18} /><span>منتجات منشورة</span><strong>{number(data.publishedProducts)}</strong></article>
        <article><PackageCheck size={18} /><span>منتجات بيعت</span><strong>{number(data.productsSold)}</strong></article>
        <article><Star size={18} /><span>التقييمات</span><strong>{number(data.reviewsCount)}</strong></article>
        <article><TriangleAlert size={18} /><span>نزاعات مفتوحة</span><strong>{number(data.disputesOpen)}</strong></article>
      </div>

      <div className="deba-analytics-30">
        <div><span>آخر 30 يومًا</span><strong>{number(data.last30DaysOrders)} طلب</strong><small>{money(data.last30DaysGross)}</small></div>
        <div><span>الاستردادات الناجحة</span><strong>{money(data.successfulRefunds)}</strong><small>مخصومة من القراءة المالية عند التسوية</small></div>
      </div>

      <div className="deba-analytics-list">
        <div className="deba-analytics-list-head">
          <span>TOP PRODUCTS</span>
          <strong>الأكثر تحقيقًا للإيراد</strong>
        </div>
        {data.topProducts.length ? data.topProducts.map((product) => (
          <article key={product.id}>
            <div><strong>{product.title}</strong><span>{number(product.units)} وحدة · {number(product.orders)} طلبات مكتملة</span></div>
            <b>{money(product.revenue)}</b>
          </article>
        )) : (
          <div className="deba-analytics-empty">لا توجد مبيعات مكتملة بعد.</div>
        )}
      </div>
    </section>
  )
}
