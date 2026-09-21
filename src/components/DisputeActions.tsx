'use client'

import { AlertTriangle, Loader2, MessageSquare, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

type Message = {
  id: string
  author_id: string
  body: string
  created_at: string
}

type Dispute = {
  id: string
  order_id: string
  raised_by: string
  category: string
  subject: string
  description: string
  status: string
  priority: string
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
}

const CATEGORIES = [
  ['not_received', 'لم يصل الطلب'],
  ['not_as_described', 'المنتج لا يطابق الوصف'],
  ['damaged', 'المنتج وصل متضررًا'],
  ['wrong_item', 'وصل منتج مختلف'],
  ['seller_issue', 'مشكلة مع البائع'],
  ['delivery_issue', 'مشكلة في التسليم'],
  ['payment_issue', 'مشكلة في الدفع'],
  ['other', 'سبب آخر'],
] as const

const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوحة',
  under_review: 'قيد المراجعة',
  resolved_buyer: 'تم الحل لصالح المشتري',
  resolved_seller: 'تم الحل لصالح البائع',
  closed: 'مغلقة',
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

export default function DisputeActions({
  orderId,
  isBuyer,
  isSeller,
}: {
  orderId: string
  isBuyer: boolean
  isSeller: boolean
}) {
  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [replying, setReplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('not_received')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [reply, setReply] = useState('')

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(
        '/api/disputes?orderId=' + encodeURIComponent(orderId),
        { cache: 'no-store' },
      )
      if (!response.ok) throw new Error('تعذر تحميل المراجعة.')
      const data = (await response.json()) as {
        dispute: Dispute | null
        messages?: Message[]
      }
      setDispute(data.dispute)
      setMessages(data.messages || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل المراجعة.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [orderId])

  async function createDispute() {
    if (subject.trim().length < 4 || description.trim().length < 10) {
      setError('اكتب عنوانًا وشرحًا واضحًا للمشكلة.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          category,
          subject,
          description,
        }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذر فتح المراجعة.')
      setSubject('')
      setDescription('')
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'تعذر فتح المراجعة.')
    } finally {
      setSaving(false)
    }
  }

  async function sendReply() {
    if (!dispute || reply.trim().length < 2) return

    setReplying(true)
    setError(null)

    try {
      const response = await fetch(
        '/api/disputes/' + dispute.id + '/messages',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: reply.trim() }),
        },
      )
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذر إرسال الرسالة.')
      setReply('')
      await load()
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : 'تعذر إرسال الرسالة.')
    } finally {
      setReplying(false)
    }
  }

  if (loading) {
    return (
      <section className="deba-trust-panel">
        <Loader2 size={20} className="deba-spin" />
        جارٍ تحميل حماية المشتري...
      </section>
    )
  }

  return (
    <section className="deba-trust-panel">
      <div className="deba-trust-head">
        <div>
          <span>BUYER PROTECTION</span>
          <h2>حماية المشتري والمراجعة</h2>
        </div>
        <ShieldCheck size={21} />
      </div>

      {!dispute && isBuyer ? (
        <div className="deba-dispute-form">
          <div className="deba-trust-callout">
            <AlertTriangle size={18} />
            <div>
              <strong>هناك مشكلة في الطلب؟</strong>
              <span>افتح مراجعة مرتبطة بهذا الطلب وسيظهر سجلها للطرفين.</span>
            </div>
          </div>

          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <input
            value={subject}
            maxLength={180}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="عنوان المشكلة"
          />

          <textarea
            value={description}
            maxLength={4000}
            rows={5}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="اشرح ما حدث بالتفصيل..."
          />

          <button
            type="button"
            className="deba-review-submit"
            disabled={saving}
            onClick={() => void createDispute()}
          >
            {saving ? <Loader2 size={18} className="deba-spin" /> : <ShieldCheck size={18} />}
            فتح مراجعة
          </button>
        </div>
      ) : dispute ? (
        <div className="deba-dispute-body">
          <div className="deba-dispute-status">
            <div>
              <strong>{dispute.subject}</strong>
              <span>{STATUS_LABELS[dispute.status] || dispute.status} · أولوية {dispute.priority}</span>
            </div>
            <small>{dateLabel(dispute.created_at)}</small>
          </div>

          <div className="deba-dispute-description">
            {dispute.description}
          </div>

          <div className="deba-dispute-messages">
            {messages.map((message) => (
              <article key={message.id} className="deba-dispute-message">
                <div>
                  <MessageSquare size={14} />
                  <small>{dateLabel(message.created_at)}</small>
                </div>
                <p>{message.body}</p>
              </article>
            ))}
          </div>

          {!['closed','resolved_buyer','resolved_seller'].includes(dispute.status) &&
          (isBuyer || isSeller) ? (
            <div className="deba-dispute-reply">
              <textarea
                value={reply}
                maxLength={4000}
                rows={3}
                onChange={(event) => setReply(event.target.value)}
                placeholder="أضف ردًا إلى سجل المراجعة..."
              />
              <button
                type="button"
                className="deba-review-submit"
                disabled={replying || !reply.trim()}
                onClick={() => void sendReply()}
              >
                {replying ? <Loader2 size={18} className="deba-spin" /> : <Send size={18} />}
                إرسال الرد
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="deba-order-empty">لا توجد مراجعة مفتوحة لهذا الطلب.</div>
      )}

      {error ? <p className="deba-checkout-error" role="alert">{error}</p> : null}
    </section>
  )
}
