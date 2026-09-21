'use client'

import { LifeBuoy, Loader2, MessageSquare, Plus, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type Ticket = {
  id: string
  order_id: string | null
  category: string
  subject: string
  description: string
  status: string
  priority: string
  created_at: string
  updated_at: string
}

type Message = {
  id: string
  author_id: string
  body: string
  created_at: string
}

const CATEGORIES = [
  ['order', 'طلب'],
  ['payment', 'دفع'],
  ['shipping', 'شحن'],
  ['account', 'الحساب'],
  ['product', 'منتج'],
  ['security', 'أمان'],
  ['other', 'أخرى'],
] as const

const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوحة',
  in_progress: 'قيد المتابعة',
  waiting_user: 'بانتظار ردك',
  resolved: 'تم الحل',
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

export default function SupportCenter() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('order')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [reply, setReply] = useState('')

  async function loadTickets() {
    setLoading(true)
    try {
      const response = await fetch('/api/support/tickets', { cache: 'no-store' })
      if (!response.ok) throw new Error('تعذر تحميل الدعم.')
      const data = (await response.json()) as { tickets?: Ticket[] }
      setTickets(data.tickets || [])
      if (!selected && data.tickets?.[0]) setSelected(data.tickets[0])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل الدعم.')
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(ticketId: string) {
    setLoadingMessages(true)
    try {
      const response = await fetch(
        '/api/support/tickets/' + encodeURIComponent(ticketId) + '/messages',
        { cache: 'no-store' },
      )
      if (!response.ok) throw new Error('تعذر تحميل الرسائل.')
      const data = (await response.json()) as { messages?: Message[] }
      setMessages(data.messages || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل الرسائل.')
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => {
    void loadTickets()
  }, [])

  useEffect(() => {
    if (selected) void loadMessages(selected.id)
  }, [selected?.id])

  async function createTicket() {
    if (subject.trim().length < 4 || description.trim().length < 10) {
      setError('اكتب عنوانًا ووصفًا واضحين للمشكلة.')
      return
    }

    setCreating(true)
    setError(null)
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subject, description }),
      })
      const data = (await response.json()) as { ticket?: Ticket; error?: string }
      if (!response.ok || !data.ticket) throw new Error(data.error || 'تعذر إنشاء التذكرة.')
      setSubject('')
      setDescription('')
      setShowForm(false)
      await loadTickets()
      setSelected(data.ticket)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'تعذر إنشاء التذكرة.')
    } finally {
      setCreating(false)
    }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return

    setSending(true)
    setError(null)
    try {
      const response = await fetch(
        '/api/support/tickets/' + encodeURIComponent(selected.id) + '/messages',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: reply.trim() }),
        },
      )
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر إرسال الرسالة.')
      setReply('')
      await loadMessages(selected.id)
      await loadTickets()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'تعذر إرسال الرسالة.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="deba-support-center">
      <div className="deba-support-head">
        <div>
          <span>DEBA SUPPORT</span>
          <h1>مركز الدعم</h1>
          <p>تذكرة واحدة تجمع المشكلة، الطلب المرتبط، والردود في سجل واضح.</p>
        </div>
        <button
          type="button"
          className="deba-review-submit"
          onClick={() => setShowForm((value) => !value)}
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'إغلاق' : 'فتح تذكرة'}
        </button>
      </div>

      {showForm ? (
        <section className="deba-support-form">
          <div className="deba-support-form-grid">
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
          </div>
          <textarea
            value={description}
            maxLength={4000}
            rows={5}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="اكتب تفاصيل المشكلة..."
          />
          <button
            type="button"
            className="deba-review-submit"
            disabled={creating}
            onClick={() => void createTicket()}
          >
            {creating ? <Loader2 size={18} className="deba-spin" /> : <LifeBuoy size={18} />}
            إنشاء التذكرة
          </button>
        </section>
      ) : null}

      <div className="deba-support-grid">
        <aside className="deba-support-tickets">
          <div className="deba-support-section-head">
            <strong>تذاكري</strong>
            <span>{tickets.length.toLocaleString('ar-EG')}</span>
          </div>

          {loading ? (
            <div className="deba-support-empty"><Loader2 size={18} className="deba-spin" /> جارٍ التحميل...</div>
          ) : tickets.length ? (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                className={'deba-support-ticket' + (selected?.id === ticket.id ? ' active' : '')}
                onClick={() => setSelected(ticket)}
              >
                <div>
                  <strong>{ticket.subject}</strong>
                  <small>{STATUS_LABELS[ticket.status] || ticket.status} · {dateLabel(ticket.updated_at)}</small>
                </div>
                <MessageSquare size={15} />
              </button>
            ))
          ) : (
            <div className="deba-support-empty">لا توجد تذاكر دعم حتى الآن.</div>
          )}
        </aside>

        <section className="deba-support-thread">
          {selected ? (
            <>
              <div className="deba-support-thread-head">
                <div>
                  <span>{selected.category.toUpperCase()}</span>
                  <h2>{selected.subject}</h2>
                  <small>{STATUS_LABELS[selected.status] || selected.status} · {dateLabel(selected.created_at)}</small>
                </div>
                <LifeBuoy size={20} />
              </div>

              <div className="deba-support-messages">
                {loadingMessages ? (
                  <div className="deba-support-empty"><Loader2 size={18} className="deba-spin" /> جارٍ تحميل الرسائل...</div>
                ) : messages.length ? (
                  messages.map((message) => (
                    <article key={message.id} className="deba-support-message">
                      <div><MessageSquare size={13} /><small>{dateLabel(message.created_at)}</small></div>
                      <p>{message.body}</p>
                    </article>
                  ))
                ) : (
                  <div className="deba-support-empty">لا توجد رسائل إضافية.</div>
                )}
              </div>

              {!['closed','resolved'].includes(selected.status) ? (
                <div className="deba-support-reply">
                  <textarea
                    value={reply}
                    maxLength={4000}
                    rows={3}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="اكتب ردك..."
                  />
                  <button
                    type="button"
                    className="deba-review-submit"
                    disabled={sending || !reply.trim()}
                    onClick={() => void sendReply()}
                  >
                    {sending ? <Loader2 size={18} className="deba-spin" /> : <Send size={18} />}
                    إرسال الرد
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="deba-support-empty large">
              <LifeBuoy size={26} />
              <strong>اختر تذكرة من القائمة</strong>
              <span>أو افتح تذكرة جديدة لبدء محادثة مع فريق الدعم.</span>
            </div>
          )}
        </section>
      </div>

      {error ? <p className="deba-checkout-error" role="alert">{error}</p> : null}
    </div>
  )
}
