'use client'

import { BadgeCheck, Loader2, Send, Star } from 'lucide-react'
import { useState } from 'react'

type Props = {
  orderId: string
  sellerId: string
}

export default function SellerReviewForm({ orderId, sellerId }: Props) {
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit() {
    if (!body.trim() || saving || done) return

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
          orderId,
          targetType: 'seller',
          targetId: sellerId,
          rating,
          title: title.trim(),
          body: body.trim(),
        }),
      })

      const result = (await response.json()) as { error?: string; status?: string }
      if (!response.ok) throw new Error(result.error || 'تعذر حفظ تقييم البائع.')

      setDone(true)
      setMessage(
        result.status === 'pending'
          ? 'تم استلام تقييمك وسيظهر بعد المراجعة.'
          : 'تم حفظ تقييم البائع.',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ تقييم البائع.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="deba-seller-review-form">
      <div className="deba-review-form-head">
        <div>
          <span>VERIFIED TRANSACTION</span>
          <h3>كيف كانت تجربتك مع البائع؟</h3>
        </div>
        <BadgeCheck size={20} />
      </div>

      <p className="deba-seller-review-note">
        لا يمكن نشر هذا التقييم إلا من طرف المشتري المرتبط بهذا الطلب المكتمل.
      </p>

      <div className="deba-review-stars-picker" aria-label="اختر تقييم البائع">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className={value <= rating ? 'active' : ''}
            aria-label={'تقييم ' + value + ' من 5'}
            onClick={() => setRating(value)}
            disabled={saving || done}
          >
            <Star size={20} fill="currentColor" />
          </button>
        ))}
      </div>

      <input
        className="deba-review-input"
        value={title}
        maxLength={120}
        disabled={saving || done}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="عنوان قصير (اختياري)"
      />

      <textarea
        className="deba-review-input deba-review-textarea"
        value={body}
        maxLength={2000}
        rows={5}
        disabled={saving || done}
        onChange={(event) => setBody(event.target.value)}
        placeholder="صف تجربتك الفعلية مع البائع..."
      />

      <button
        type="button"
        className="deba-review-submit"
        disabled={saving || done || !body.trim()}
        onClick={() => void submit()}
      >
        {saving ? <Loader2 size={18} className="deba-spin" /> : <Send size={18} />}
        إرسال تقييم البائع
      </button>

      {message ? <p className="deba-review-message" role="status">{message}</p> : null}
    </section>
  )
}
