'use client'

import { BarChart3, FileWarning, Flag, LifeBuoy, Loader2, PackageCheck, ShoppingBag, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type Analytics = {
  members: number
  sellers: number
  publishedProducts: number
  pendingProducts: number
  orders: number
  completedOrders: number
  openDisputes: number
  openTickets: number
  reviewsPending: number
  reportsOpen: number
  paidGross: number
  successfulRefunds: number
  last30DaysOrders: number
  last30DaysGross: number
  daily30: Array<{ day: string; orders: number; gross: number }>
}

function money(value: number) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value) + ' EGP'
}

function number(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value)
}

export default function AdminAnalytics() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/analytics/admin', { cache: 'no-store' })
        const payload = (await response.json()) as { analytics?: Analytics; error?: string }
        if (!response.ok || !payload.analytics) {
          throw new Error(payload.error || 'تعذر تحميل تحليلات الإدارة.')
        }
        setData(payload.analytics)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل التحليلات.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const maxDailyGross = useMemo(
    () => Math.max(...(data?.daily30 || []).map((row) => row.gross), 1),
    [data],
  )

  if (loading) return <section className="deba-analytics-state"><Loader2 size={22} className="deba-spin" /> جارٍ تحميل لوحة المؤشرات...</section>
  if (error || !data) return <section className="deba-analytics-state"><FileWarning size={22} /> {error || 'لا تتوفر بيانات.'}</section>

  return (
    <section className="deba-analytics-panel">
      <div className="deba-analytics-head">
        <div>
          <span>ADMIN ANALYTICS</span>
          <h2>مؤشرات DEBA التشغيلية</h2>
          <p>بيانات حقيقية من الأعضاء والإعلانات والطلبات والمدفوعات والتشغيل.</p>
        </div>
        <BarChart3 size={22} />
      </div>

      <div className="deba-analytics-grid">
        <article><Users size={18} /><span>الأعضاء</span><strong>{number(data.members)}</strong></article>
        <article><Users size={18} /><span>البائعون</span><strong>{number(data.sellers)}</strong></article>
        <article><PackageCheck size={18} /><span>الإعلانات المنشورة</span><strong>{number(data.publishedProducts)}</strong></article>
        <article><PackageCheck size={18} /><span>بانتظار المراجعة</span><strong>{number(data.pendingProducts)}</strong></article>
        <article><ShoppingBag size={18} /><span>كل الطلبات</span><strong>{number(data.orders)}</strong></article>
        <article><ShoppingBag size={18} /><span>طلبات مكتملة</span><strong>{number(data.completedOrders)}</strong></article>
        <article><LifeBuoy size={18} /><span>تذاكر مفتوحة</span><strong>{number(data.openTickets)}</strong></article>
        <article><Flag size={18} /><span>بلاغات مفتوحة</span><strong>{number(data.reportsOpen)}</strong></article>
        <article><FileWarning size={18} /><span>نزاعات مفتوحة</span><strong>{number(data.openDisputes)}</strong></article>
        <article><PackageCheck size={18} /><span>تقييمات بانتظار المراجعة</span><strong>{number(data.reviewsPending)}</strong></article>
      </div>

      <div className="deba-analytics-30">
        <div><span>GMV مسجل عبر الطلبات المدفوعة</span><strong>{money(data.paidGross)}</strong><small>يشمل الحالات المدفوعة والجزئية والمستردة</small></div>
        <div><span>استردادات ناجحة</span><strong>{money(data.successfulRefunds)}</strong><small>من سجل refunds المؤكد</small></div>
        <div><span>آخر 30 يومًا</span><strong>{number(data.last30DaysOrders)} طلب</strong><small>{money(data.last30DaysGross)}</small></div>
      </div>

      <div className="deba-analytics-chart" aria-label="الإيراد اليومي لآخر 30 يومًا">
        <div className="deba-analytics-chart-head"><strong>الإيراد اليومي</strong><span>آخر 30 يومًا</span></div>
        <div className="deba-analytics-bars">
          {data.daily30.map((row) => (
            <div key={row.day} title={row.day + ' · ' + money(row.gross)}>
              <i style={{ height: Math.max(2, (row.gross / maxDailyGross) * 100) + '%' }} />
              <small>{new Date(row.day).getDate()}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
