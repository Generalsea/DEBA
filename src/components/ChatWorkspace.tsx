'use client'

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MessageCircle,
  Package,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Room = {
  id: string
  product_id: string | null
  updated_at: string
  unreadCount?: number
  product: { id: string; title: string; slug: string; price: number; currency: string } | null
  participant: { last_read_at: string | null; is_muted: boolean } | null
  counterparty: { id: string; display_name: string; username: string | null; avatar_url: string | null; account_type: 'buyer' | 'seller' } | null
}

type Message = {
  id: string
  room_id: string
  sender_id: string | null
  body: string | null
  message_type: string
  metadata: Record<string, unknown>
  created_at: string
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' }).format(date)
}

export default function ChatWorkspace({ initialProduct }: { initialProduct?: string }) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function loadRooms() {
    const response = await fetch('/api/chat/rooms', { cache: 'no-store' })
    const data = await response.json() as { rooms?: Room[]; error?: string }
    if (!response.ok) throw new Error(data.error || 'تعذر تحميل المحادثات.')
    setRooms(data.rooms || [])
    setLoadingRooms(false)
    return data.rooms || []
  }

  async function openRoom(roomId: string) {
    setSelectedRoomId(roomId)
    setLoadingMessages(true)
    setError('')
    try {
      const response = await fetch('/api/chat/rooms/' + encodeURIComponent(roomId) + '/messages?limit=100', { cache: 'no-store' })
      const data = await response.json() as { messages?: Message[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل الرسائل.')
      setMessages(data.messages || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الرسائل.')
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => {
    let active = true

    async function boot() {
      try {
        const supabase = createClient()
        const { data: claims } = await supabase.auth.getClaims()
        const id = typeof claims?.claims?.sub === 'string' ? claims.claims.sub : null
        if (!id) {
          if (active) {
            setCurrentUserId(null)
            setLoadingRooms(false)
            setError('يجب تسجيل الدخول لاستخدام مركز المحادثات.')
          }
          return
        }

        if (active) setCurrentUserId(id)
        let data = await loadRooms()
        if (!active) return

        const url = new URL(window.location.href)
        const preferred = url.searchParams.get('room')
        if (preferred && data.some((room) => room.id === preferred)) {
          await openRoom(preferred)
          return
        }

        if (initialProduct) {
          const response = await fetch('/api/chat/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: initialProduct }),
          })
          const payload = await response.json() as { room?: { room_id?: string }; error?: string }
          if (!response.ok || !payload.room?.room_id) {
            throw new Error(payload.error || 'تعذر فتح المحادثة.')
          }
          data = await loadRooms()
          if (!active) return
          await openRoom(payload.room.room_id)
          void data
          return
        }

        if (data[0]) await openRoom(data[0].id)
      } catch (e) {
        if (active) {
          setLoadingRooms(false)
          setError(e instanceof Error ? e.message : 'تعذر تحميل المحادثات.')
        }
      }
    }

    void boot()
    return () => { active = false }
  }, [initialProduct])

  useEffect(() => {
    if (!selectedRoomId) return
    const interval = window.setInterval(() => void openRoom(selectedRoomId), 5000)
    return () => window.clearInterval(interval)
  }, [selectedRoomId])

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId],
  )

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!selectedRoomId || !body || sending) return
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/chat/rooms/' + encodeURIComponent(selectedRoomId) + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const data = await response.json() as { message?: Message; error?: string }
      if (!response.ok || !data.message) throw new Error(data.error || 'تعذر إرسال الرسالة.')
      setMessages((current) => [...current, data.message as Message])
      setDraft('')
      requestAnimationFrame(() => document.querySelector('.deba-chat-message-list')?.scrollTo({ top: 999999, behavior: 'smooth' }))
      void loadRooms()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إرسال الرسالة.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="deba-chat-shell">
      <aside className={'deba-chat-sidebar' + (selectedRoomId ? ' has-selection' : '')}>
        <div className="deba-chat-sidebar-head">
          <div>
            <span>DEBA COMMS</span>
            <h1>مركز المحادثات</h1>
          </div>
          <button type="button" onClick={() => void loadRooms()} aria-label="تحديث المحادثات">
            <RefreshCw size={17} />
          </button>
        </div>

        <div className="deba-chat-safety-chip">
          <ShieldCheck size={16} />
          <span>محادثات داخل المنصة وخاضعة للمراقبة الوقائية</span>
        </div>

        <div className="deba-chat-room-list">
          {loadingRooms ? (
            <div className="deba-chat-empty"><Loader2 size={21} className="deba-spin" />جارٍ تحميل الغرف...</div>
          ) : rooms.length ? (
            rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                className={'deba-chat-room' + (selectedRoomId === room.id ? ' is-active' : '')}
                onClick={() => void openRoom(room.id)}
              >
                <span className="deba-chat-avatar">
                  {room.counterparty?.avatar_url ? (
                    <img src={room.counterparty.avatar_url} alt="" />
                  ) : (
                    <UserRound size={18} />
                  )}
                </span>
                <span className="deba-chat-room-copy">
                  <strong>{room.counterparty?.display_name || 'عضو DEBA'}</strong>
                  <small>{room.product?.title || 'محادثة DEBA'}</small>
                </span>
                <span className="deba-chat-room-time">{formatTime(room.updated_at)}</span>
              </button>
            ))
          ) : (
            <div className="deba-chat-empty">
              <MessageCircle size={24} />
              <strong>لا توجد محادثات بعد</strong>
              <span>افتح «تواصل مع البائع» من أي إعلان متاح لبدء غرفة آمنة.</span>
            </div>
          )}
        </div>
      </aside>

      <main className="deba-chat-main">
        {selectedRoom ? (
          <>
            <header className="deba-chat-main-head">
              <button type="button" className="deba-chat-mobile-back" onClick={() => setSelectedRoomId(null)} aria-label="العودة إلى المحادثات">
                <ArrowRight size={17} />
              </button>
              <div className="deba-chat-main-person">
                <span className="deba-chat-avatar large">
                  {selectedRoom.counterparty?.avatar_url ? (
                    <img src={selectedRoom.counterparty.avatar_url} alt="" />
                  ) : (
                    <UserRound size={20} />
                  )}
                </span>
                <div>
                  <span>شريك المحادثة</span>
                  <strong>{selectedRoom.counterparty?.display_name || 'عضو DEBA'}</strong>
                </div>
              </div>
              {selectedRoom.product ? (
                <Link href={'/products/' + encodeURIComponent(selectedRoom.product.slug)} className="deba-chat-context">
                  <Package size={15} />
                  <span>{selectedRoom.product.title}</span>
                  <ArrowLeft size={15} />
                </Link>
              ) : null}
            </header>

            <div className="deba-chat-protection">
              <ShieldCheck size={16} />
              <span>احفظ التفاوض والصفقة داخل DEBA. الرسائل تُسجل مع إشارات أمان متاحة للمنصة، وقد تُراجع عند وجود مؤشرات احتيال.</span>
            </div>

            <div className="deba-chat-message-list" aria-live="polite">
              {loadingMessages ? (
                <div className="deba-chat-empty"><Loader2 size={21} className="deba-spin" />جارٍ تحميل الرسائل...</div>
              ) : messages.length ? (
                messages.map((message) => {
                  const mine = Boolean(message.sender_id && currentUserId && message.sender_id === currentUserId)
                  return (
                    <article key={message.id} className={'deba-chat-message ' + (mine ? 'mine' : 'theirs')}>
                      <div className="deba-chat-message-bubble">
                        <span>{message.body}</span>
                        <small>{formatTime(message.created_at)} {mine ? <Check size={12} /> : null}</small>
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="deba-chat-empty">
                  <MessageCircle size={25} />
                  <strong>ابدأ التواصل</strong>
                  <span>اسأل عن الحالة والسعر وموعد الاستلام قبل تثبيت الصفقة.</span>
                </div>
              )}
            </div>

            {error ? <div className="deba-chat-error">{error}</div> : null}

            <form className="deba-chat-composer" onSubmit={(event) => void sendMessage(event)}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={4000}
                rows={2}
                placeholder="اكتب رسالة واضحة داخل DEBA..."
              />
              <button type="submit" disabled={sending || !draft.trim()}>
                {sending ? <Loader2 size={18} className="deba-spin" /> : <Send size={18} />}
                إرسال
              </button>
            </form>

            <p className="deba-chat-privacy">
              لمكافحة الاحتيال، تسجل DEBA بيانات السلامة المتاحة من الجلسة مثل IP والبريد والهاتف المرتبط بالحساب عند إرسال الرسالة. متصفح الويب لا يتيح للموقع قراءة عنوان MAC.
            </p>
          </>
        ) : (
          <div className="deba-chat-welcome">
            <div className="deba-chat-welcome-mark"><MessageCircle size={31} /></div>
            <span>DEBA COMMUNICATIONS</span>
            <h2>التواصل جزء من الصفقة</h2>
            <p>غرفة محادثة مرتبطة بالسلعة، مع سياق المنتج، تحديثات سريعة، وسجل أمان لمساعدة المنصة في اكتشاف السلوك المشبوه.</p>
            <Link href="/" className="deba-profile-primary-action">استكشف السلع <ArrowLeft size={16} /></Link>
          </div>
        )}
      </main>
    </section>
  )
}
