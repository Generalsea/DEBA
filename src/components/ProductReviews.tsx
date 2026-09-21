'use client'

import { BadgeCheck, Loader2, Send, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type ReviewItem = {
  id: string
  rating: number
  title: string | null
  body: string | null
  verifiedPurchase: boolean
  createdAt: string
  reviewer: {
    display_name: string | null
    username: string | null
    avatar_url: string | null
  }
}

type ReviewResponse = {
  reviews: ReviewItem[]
  averageRating: number
  reviewCount: number
  breakdown: Array<{ rating: number; count: number }>
  canReview: boolean
  reviewOrderId: string | null
  pendingMine: boolean
}

function dateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function initials(value: string) {
  const text = value.trim()
  if (!text) return 'D'
  return text.slice(0, 2)
}

export default function ProductReviews({
  productId,
}: {
  productId: string
}) {
  const [data, setData] = useState<ReviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(
        '/api/reviews?productId=' + encodeURIComponent(productId),
        { cache: 'no-store' },
      )
      if (!response.ok) throw new Error('تعذر تحميل التقييمات.')
      setData((await response.json()) as ReviewResponse)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تحميل التقييمات.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [productId])

  const ratingStars = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => ({
        value: index + 1,
        active: index < Math.round(data?.averageRating || 0),
      })),
    [data?.averageRating],
  )

  async function submit() {
    if (!data?.reviewOrderId || !body.trim()) {
      setMessage('اكتب تعليقًا مختصرًا عن تجربتك مع المنتج.')
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          orderId: data.reviewOrderId,
          targetType: 'product',
          targetId: productId,
          rating,
          title: title.trim(),
          body: body.trim(),
        }),
      })

      const result = (await response.json()) as {
        error?: string
        status?: string
      }

      if (!response.ok) {
        throw new Error(result.error || 'تعذر حفظ التقييم.')
      }

      setTitle('')
      setBody('')
      setMessage(
        result.status === 'pending'
          ? 'تم استلام تقييمك وسيظهر بعد المراجعة.'
          : 'تم حفظ تقييمك.',
      )
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ التقييم.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="deba-detail-empty-panel">
        <Loader2 size={24} className="deba-spin" />
        <h2>جارٍ تحميل التقييمات</h2>
        <p>نقرأ التقييمات الفعلية المسجلة لهذا المنتج.</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="deba-detail-empty-panel">
        <BadgeCheck size={26} />
        <h2>تعذر تحميل التقييمات</h2>
        <p>{message || 'حاول تحديث الصفحة.'}</p>
      </div>
    )
  }

  return (
    <div className="deba-reviews-wrap">
      <div className="deba-reviews-summary">
        <div className="deba-reviews-rating">
          <strong>{data.averageRating ? data.averageRating.toFixed(1) : '—'}</strong>
          <div>
            <div className="deba-reviews-stars">
              {ratingStars.map((star) => (
                <Star key={star.value} size={17} fill={star.active ? 'currentColor' : 'none'} />
              ))}
            </div>
            <span>
              {data.reviewCount.toLocaleString('ar-EG')} تقييم موثق
            </span>
          </div>
        </div>

        <div className="deba-reviews-breakdown">
          {[5, 4, 3, 2, 1].map((ratingValue) => {
            const count =
              data.breakdown.find((item) => item.rating === ratingValue)?.count || 0
            const width = data.reviewCount ? (count / data.reviewCount) * 100 : 0
            return (
              <div key={ratingValue} className="deba-reviews-breakdown-row">
                <span>{ratingValue}</span>
                <div><i style={{ width: width + '%' }} /></div>
                <small>{count}</small>
              </div>
            )
          })}
        </div>
      </div>

      {data.canReview ? (
        <section className="deba-review-form">
          <div className="deba-review-form-head">
            <div>
              <span>VERIFIED PURCHASE</span>
              <h3>قيّم المنتج بعد استلام طلبك</h3>
            </div>
            <BadgeCheck size={20} />
          </div>

          <div className="deba-review-stars-picker" aria-label="اختر التقييم">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= rating ? 'active' : ''}
                aria-label={'تقييم ' + value + ' من 5'}
                onClick={() => setRating(value)}
              >
                <Star size={20} fill="currentColor" />
              </button>
            ))}
          </div>

          <input
            className="deba-review-input"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="عنوان قصير (اختياري)"
          />

          <textarea
            className="deba-review-input deba-review-textarea"
            value={body}
            maxLength={2000}
            rows={5}
            onChange={(event) => setBody(event.target.value)}
            placeholder="صف تجربتك الفعلية مع المنتج..."
          />

          <button
            type="button"
            className="deba-review-submit"
            disabled={saving || !body.trim()}
            onClick={() => void submit()}
          >
            {saving ? <Loader2 size={18} className="deba-spin" /> : <Send size={18} />}
            نشر التقييم
          </button>

          {message ? <p className="deba-review-message" role="status">{message}</p> : null}
        </section>
      ) : data.pendingMine ? (
        <div className="deba-review-pending">
          <BadgeCheck size={18} />
          <span>لديك تقييم سابق قيد المراجعة.</span>
        </div>
      ) : data.reviewCount === 0 ? (
        <div className="deba-review-empty">
          <Star size={19} />
          <span>لا توجد تقييمات منشورة لهذا المنتج حتى الآن.</span>
        </div>
      ) : null}

      <div className="deba-review-list">
        {data.reviews.map((review) => {
          const displayName =
            review.reviewer.display_name ||
            review.reviewer.username ||
            'مستخدم DEBA'

          return (
            <article key={review.id} className="deba-review-card">
              <div className="deba-review-head">
                <div className="deba-review-avatar">
                  {initials(displayName)}
                </div>
                <div>
                  <strong>{displayName}</strong>
                  <span>
                    {review.verifiedPurchase ? 'شراء موثق' : 'تقييم'} · {dateLabel(review.createdAt)}
                  </span>
                </div>
                <div className="deba-reviews-stars small" aria-label={review.rating + ' من 5'}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      size={13}
                      fill={index < review.rating ? 'currentColor' : 'none'}
                    />
                  ))}
                </div>
              </div>
              {review.title ? <h3>{review.title}</h3> : null}
              <p>{review.body || 'بدون تعليق.'}</p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
