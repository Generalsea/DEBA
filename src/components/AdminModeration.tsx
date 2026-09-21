'use client'

import {
  CheckCircle2,
  FileSearch,
  Flag,
  Loader2,
  MessageSquare,
  PackageCheck,
  RefreshCw,
  Star,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type Queue = {
  products: Array<{
    id: string
    title: string
    owner_id: string | null
    price: number | string | null
    currency: string
    status: string
    moderation_status: string
    details_schema_version: number
    created_at: string
  }>
  reviews: Array<{
    id: string
    rating: number
    title: string | null
    body: string | null
    created_at: string
    reviewer: { display_name: string | null; username: string | null } | null
    product: { title: string; slug: string } | null
  }>
  reports: Array<{
    id: string
    reason: string
    description: string | null
    created_at: string
    reporter: { display_name: string | null; username: string | null } | null
    reportedUser: { display_name: string | null; username: string | null } | null
    product: { title: string; slug: string } | null
  }>
}

type Action =
  | 'approve_product'
  | 'reject_product'
  | 'publish_review'
  | 'hide_review'
  | 'resolve_report'
  | 'dismiss_report'

const REASONS: Record<string, string> = {
  fraud: 'احتيال',
  counterfeit: 'منتج مقلد',
  prohibited_item: 'منتج محظور',
  misleading: 'محتوى مضلل',
  harassment: 'إساءة',
  spam: 'محتوى مزعج',
  unsafe: 'محتوى غير آمن',
  other: 'أخرى',
}

function money(value: number | string | null, currency: string) {
  if (value === null) return '—'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('ar-EG').format(amount) + ' ' + currency
}

function dateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function AdminModeration() {
  const [queue, setQueue] = useState<Queue | null>(null)
  const [active, setActive] = useState<'products' | 'reviews' | 'reports'>('products')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/moderation', { cache: 'no-store' })
      const data = (await response.json()) as Queue & { error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل قائمة المراجعة.')
      setQueue(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل الإدارة.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function act(action: Action, id: string, note = '') {
    setBusy(id + ':' + action)
    setError(null)

    try {
      const response = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, note }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر تنفيذ العملية.')
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'تعذر تنفيذ العملية.')
    } finally {
      setBusy(null)
    }
  }

  const counts = useMemo(
    () => ({
      products: queue?.products.length || 0,
      reviews: queue?.reviews.length || 0,
      reports: queue?.reports.length || 0,
    }),
    [queue],
  )

  return (
    <div className="deba-admin-shell">
      <div className="deba-admin-hero">
        <div>
          <span>DEBA OPERATIONS</span>
          <h1>مركز المراجعة</h1>
          <p>لوحة تشغيلية للمحتوى المعلّق والتقييمات والبلاغات المفتوحة.</p>
        </div>
        <button type="button" className="deba-admin-refresh" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'deba-spin' : ''} />
          تحديث
        </button>
      </div>

      <div className="deba-admin-tabs">
        {([
          ['products', 'الإعلانات', PackageCheck],
          ['reviews', 'التقييمات', Star],
          ['reports', 'البلاغات', Flag],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            className={active === value ? 'active' : ''}
            onClick={() => setActive(value)}
          >
            <Icon size={17} />
            {label}
            <b>{counts[value]}</b>
          </button>
        ))}
      </div>

      {loading && !queue ? (
        <div className="deba-admin-empty">
          <Loader2 size={22} className="deba-spin" />
          جارٍ تحميل قائمة المراجعة...
        </div>
      ) : queue ? (
        <section className="deba-admin-list">
          {active === 'products' ? (
            queue.products.length ? (
              queue.products.map((item) => (
                <article key={item.id} className="deba-admin-card">
                  <div className="deba-admin-card-main">
                    <div className="deba-admin-card-icon"><PackageCheck size={19} /></div>
                    <div>
                      <span>{item.details_schema_version === 1 ? 'Structured listing' : 'Listing'}</span>
                      <h2>{item.title}</h2>
                      <p>
                        {money(item.price, item.currency)} · {item.status} · أُضيف {dateLabel(item.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="deba-admin-card-actions">
                    <button
                      type="button"
                      className="primary"
                      disabled={busy !== null}
                      onClick={() => void act('approve_product', item.id)}
                    >
                      {busy === item.id + ':approve_product' ? <Loader2 size={15} className="deba-spin" /> : <CheckCircle2 size={15} />}
                      اعتماد ونشر
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy !== null}
                      onClick={() => void act('reject_product', item.id)}
                    >
                      {busy === item.id + ':reject_product' ? <Loader2 size={15} className="deba-spin" /> : <XCircle size={15} />}
                      رفض
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="deba-admin-empty"><CheckCircle2 size={22} /> لا توجد إعلانات معلقة.</div>
            )
          ) : null}

          {active === 'reviews' ? (
            queue.reviews.length ? (
              queue.reviews.map((review) => (
                <article key={review.id} className="deba-admin-card">
                  <div className="deba-admin-card-main">
                    <div className="deba-admin-card-icon"><Star size={19} /></div>
                    <div>
                      <span>{review.product?.title || 'منتج غير متاح'} · {review.rating}/5</span>
                      <h2>{review.title || 'تقييم بدون عنوان'}</h2>
                      <p>{review.body || 'بدون تعليق.'} · {dateLabel(review.created_at)}</p>
                      <small>
                        {review.reviewer?.display_name || review.reviewer?.username || 'مستخدم DEBA'}
                      </small>
                    </div>
                  </div>
                  <div className="deba-admin-card-actions">
                    <button
                      type="button"
                      className="primary"
                      disabled={busy !== null}
                      onClick={() => void act('publish_review', review.id)}
                    >
                      {busy === review.id + ':publish_review' ? <Loader2 size={15} className="deba-spin" /> : <CheckCircle2 size={15} />}
                      نشر
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy !== null}
                      onClick={() => void act('hide_review', review.id)}
                    >
                      {busy === review.id + ':hide_review' ? <Loader2 size={15} className="deba-spin" /> : <XCircle size={15} />}
                      إخفاء
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="deba-admin-empty"><CheckCircle2 size={22} /> لا توجد تقييمات معلقة.</div>
            )
          ) : null}

          {active === 'reports' ? (
            queue.reports.length ? (
              queue.reports.map((report) => (
                <article key={report.id} className="deba-admin-card">
                  <div className="deba-admin-card-main">
                    <div className="deba-admin-card-icon"><Flag size={19} /></div>
                    <div>
                      <span>{REASONS[report.reason] || report.reason}</span>
                      <h2>{report.product?.title || report.reportedUser?.display_name || 'بلاغ محتوى'}</h2>
                      <p>{report.description || 'بدون وصف إضافي.'} · {dateLabel(report.created_at)}</p>
                      <small>
                        المبلّغ: {report.reporter?.display_name || report.reporter?.username || 'مستخدم DEBA'}
                      </small>
                    </div>
                  </div>
                  <div className="deba-admin-card-actions">
                    <button
                      type="button"
                      className="primary"
                      disabled={busy !== null}
                      onClick={() => void act('resolve_report', report.id, 'تمت مراجعة البلاغ واتخاذ الإجراء المناسب.')}
                    >
                      {busy === report.id + ':resolve_report' ? <Loader2 size={15} className="deba-spin" /> : <CheckCircle2 size={15} />}
                      معالجة
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy !== null}
                      onClick={() => void act('dismiss_report', report.id, 'لم يثبت وجود مخالفة بعد المراجعة.')}
                    >
                      {busy === report.id + ':dismiss_report' ? <Loader2 size={15} className="deba-spin" /> : <XCircle size={15} />}
                      إغلاق
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="deba-admin-empty"><CheckCircle2 size={22} /> لا توجد بلاغات مفتوحة.</div>
            )
          ) : null}
        </section>
      ) : null}

      {error ? <p className="deba-checkout-error" role="alert">{error}</p> : null}

      <div className="deba-admin-footnote">
        <FileSearch size={16} />
        <span>كل عملية إدارية تُسجل في audit trail مع المنفذ والتغيير قبل/بعد العملية.</span>
      </div>
    </div>
  )
}
