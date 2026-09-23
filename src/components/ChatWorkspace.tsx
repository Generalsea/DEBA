'use client'

import {
  BadgeCheck,
  CheckCheck,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Flag,
  Forward,
  Image as ImageIcon,
  Info,
  Loader2,
  MapPin,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Phone,
  Pin,
  RefreshCw,
  Reply,
  Search,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type ProductContext = {
  id: string
  title: string
  slug: string
  price: number | string | null
  currency: string
  city: string | null
  governorate: string | null
  conditionGrade: string | null
  categoryName: string | null
  imageUrl: string | null
}

type Room = {
  id: string
  product_id: string | null
  updated_at: string
  unreadCount?: number
  hasOffers?: boolean
  lastMessagePreview?: string | null
  lastMessageType?: string | null
  product: ProductContext | null
  participant: { last_read_at: string | null; is_muted: boolean } | null
  counterparty: {
    id: string
    display_name: string
    username: string | null
    avatar_url: string | null
    account_type: 'buyer' | 'seller'
  } | null
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

type ApiDebug = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
  supabaseHost?: string | null
}

type FilterTab = 'all' | 'unread' | 'offers'

const QUICK_REPLIES = [
  { text: 'هل السعر قابل للتفاوض؟', icon: '💰' },
  { text: 'أين يمكن الاستلام؟', icon: '📍' },
  { text: 'هل المنتج بحالة جيدة؟', icon: '✅', compact: 'حالة المنتج' },
  { text: 'أريد صور إضافية', icon: '📷' },
  { text: 'متى يكون متاحًا؟', icon: '', compact: 'موعد الاستلام' },
]

function formatTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'اليوم'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'اليوم'
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return 'اليوم'
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function initials(value: string | null | undefined, fallback = 'د') {
  const normalized = value?.trim() || ''
  if (!normalized) return fallback
  const chars = Array.from(normalized).filter((char) => char.trim().length > 0)
  return chars.slice(0, 2).join('') || fallback
}

function numberValue(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function currencyLabel(currency: string) {
  return currency === 'EGP' ? 'جنيه' : currency || 'جنيه'
}

function formatMoney(value: number | string | null | undefined, currency: string) {
  const numeric = numberValue(value)
  if (numeric === null) return 'السعر عند التواصل'
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(numeric) + ' ' + currencyLabel(currency)
}

function conditionLabel(value: string) {
  const labels: Record<string, string> = {
    new: 'جديد',
    like_new: 'مستعمل · كالجديد',
    excellent: 'مستعمل · ممتاز',
    good: 'مستعمل · جيد',
    fair: 'مستعمل · مقبول',
    poor: 'مستعمل · يحتاج عناية',
    for_parts: 'للقطع / الإصلاح',
  }
  return labels[value] || value
}

function gradientForName(value: string | null | undefined) {
  const palette = [
    'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
    'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
    'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)',
    'linear-gradient(135deg, #FA709A 0%, #FEE140 100%)',
    'linear-gradient(135deg, #A8EDEA 0%, #FED6E3 100%)',
  ]
  const key = value || ''
  let hash = 0
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  return palette[hash % palette.length]
}

function metadataRecord(message: Message) {
  return message.metadata && typeof message.metadata === 'object' ? message.metadata : {}
}

function nestedRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function productCardData(message: Message, room: Room | null) {
  const metadata = metadataRecord(message)
  const product = nestedRecord(metadata.product)
  if (!product && message.message_type !== 'product_card') return null
  const source = product || metadata
  return {
    title: typeof source.title === 'string' ? source.title : room?.product?.title || 'سلعة DEBA',
    price: typeof source.price === 'string' ? source.price : formatMoney(room?.product?.price, room?.product?.currency || 'EGP'),
    imageUrl:
      (typeof source.imageUrl === 'string' && source.imageUrl) ||
      (typeof source.image_url === 'string' && source.image_url) ||
      room?.product?.imageUrl ||
      null,
    location:
      (typeof source.location === 'string' && source.location) ||
      room?.product?.city ||
      room?.product?.governorate ||
      'مصر',
  }
}

function offerData(message: Message) {
  if (message.message_type !== 'offer') return null
  const metadata = metadataRecord(message)
  const amount = numberValue(metadata.amount ?? metadata.price)
  const currency = typeof metadata.currency === 'string' ? metadata.currency : 'EGP'
  const note =
    (typeof metadata.note === 'string' && metadata.note) ||
    (typeof metadata.body === 'string' && metadata.body) ||
    'عرض سعر مرتبط بالمحادثة.'
  return {
    amount: amount === null
      ? 'عرض مخصص'
      : new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(amount) + ' ' + currencyLabel(currency),
    note,
  }
}

function PackagePlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className={'deba-comms-package-placeholder' + (compact ? ' compact' : '')}>
      <span>DEBA</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 8.2 12 3 3 8.2v7.6L12 21l9-5.2V8.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m3.4 8.3 8.6 5 8.6-5M12 21v-7.7M8.5 5l8.8 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default function ChatWorkspace({ initialProduct }: { initialProduct?: string }) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [currentTab, setCurrentTab] = useState<FilterTab>('all')
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState('')
  const [debug, setDebug] = useState<ApiDebug | null>(null)
  const [toast, setToast] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: string } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId],
  )

  const filteredRooms = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('ar')
    return rooms.filter((room) => {
      const name = room.counterparty?.display_name || room.counterparty?.username || ''
      const preview = room.lastMessagePreview || ''
      const matchesSearch =
        !needle ||
        name.toLocaleLowerCase('ar').includes(needle) ||
        preview.toLocaleLowerCase('ar').includes(needle) ||
        (room.product?.title || '').toLocaleLowerCase('ar').includes(needle)

      const matchesTab =
        currentTab === 'all' ||
        (currentTab === 'unread' && (room.unreadCount || 0) > 0) ||
        (currentTab === 'offers' && Boolean(room.hasOffers))

      return matchesSearch && matchesTab
    })
  }, [currentTab, rooms, search])

  const unreadTotal = useMemo(
    () => rooms.reduce((total, room) => total + (room.unreadCount || 0), 0),
    [rooms],
  )

  const offerTotal = useMemo(
    () => rooms.filter((room) => room.hasOffers).length,
    [rooms],
  )

  function showToast(message: string) {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2500)
  }

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
    setDebug(null)
    setContextMenu(null)
    try {
      const response = await fetch(
        '/api/chat/rooms/' + encodeURIComponent(roomId) + '/messages?limit=100',
        { cache: 'no-store' },
      )
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

        if (initialProduct) {
          const response = await fetch('/api/chat/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: initialProduct }),
          })
          const payload = await response.json() as {
            room?: { room_id?: string }
            error?: string
            debug?: ApiDebug
          }
          if (!response.ok || !payload.room?.room_id) {
            if (payload.debug) setDebug(payload.debug)
            throw new Error(payload.error || 'تعذر فتح المحادثة.')
          }

          const roomsAfterCreate = await loadRooms()
          if (!active) return
          const createdRoomId = payload.room.room_id
          if (roomsAfterCreate.some((room) => room.id === createdRoomId)) {
            await openRoom(createdRoomId)
          } else {
            setSelectedRoomId(createdRoomId)
          }
          return
        }

        const data = await loadRooms()
        if (!active) return

        const url = new URL(window.location.href)
        const preferred = url.searchParams.get('room')
        if (preferred && data.some((room) => room.id === preferred)) {
          await openRoom(preferred)
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

  useEffect(() => {
    const dismissContextMenu = () => setContextMenu(null)
    window.addEventListener('click', dismissContextMenu)
    return () => window.removeEventListener('click', dismissContextMenu)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  function resizeInput() {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = Math.min(input.scrollHeight, 120) + 'px'
  }

  async function sendMessage(event?: React.FormEvent) {
    event?.preventDefault()
    const body = draft.trim()
    if (!selectedRoomId || !body || sending) return
    setSending(true)
    setTyping(true)
    setError('')
    setContextMenu(null)

    try {
      const response = await fetch(
        '/api/chat/rooms/' + encodeURIComponent(selectedRoomId) + '/messages',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        },
      )
      const data = await response.json() as { message?: Message; error?: string }
      if (!response.ok || !data.message) throw new Error(data.error || 'تعذر إرسال الرسالة.')

      setMessages((current) => [...current, data.message as Message])
      setDraft('')
      if (inputRef.current) inputRef.current.style.height = 'auto'
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('#deba-comms-messages-area')
          ?.scrollTo({ top: 999999, behavior: 'smooth' })
      })
      void loadRooms()
      showToast('تم إرسال الرسالة')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إرسال الرسالة.')
    } finally {
      setTyping(false)
      setSending(false)
    }
  }

  function sendQuick(text: string) {
    setDraft(text)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      resizeInput()
    })
  }

  function handleContextMenu(event: React.MouseEvent, message: Message) {
    event.preventDefault()
    const x = Math.min(event.clientX, window.innerWidth - 210)
    const y = Math.min(event.clientY, window.innerHeight - 290)
    setContextMenu({ x: Math.max(8, x), y: Math.max(8, y), messageId: message.id })
  }

  async function handleCopy(message: Message) {
    try {
      await navigator.clipboard.writeText(message.body || '')
      showToast('📋 تم النسخ')
    } catch {
      showToast('تعذر نسخ الرسالة')
    }
    setContextMenu(null)
  }

  function contextAction(action: string) {
    const actions: Record<string, string> = {
      pin: '📌 تم تثبيت الرسالة',
      reply: '↩️ تم الرد',
      forward: '➡️ تم التحويل',
      report: '🚩 تم الإبلاغ',
      delete: '🗑️ تم الحذف',
    }
    showToast(actions[action] || 'تم التنفيذ')
    setContextMenu(null)
  }

  const contextMessage = contextMenu
    ? messages.find((message) => message.id === contextMenu.messageId)
    : null

  const sellerName = selectedRoom?.counterparty?.display_name || selectedRoom?.counterparty?.username || 'عضو DEBA'
  const sellerAvatar = initials(sellerName)
  const sellerGradient = gradientForName(sellerName)
  const productPath = selectedRoom?.product?.slug
    ? '/products/' + encodeURIComponent(selectedRoom.product.slug)
    : '/'

  return (
    <div className="deba-comms-page">
      <div className="deba-comms-app">
        <header className="deba-comms-top-header">
          <div className="deba-comms-header-right">
            <div className="deba-comms-location-badge">
              <MapPin size={16} />
              <span>
                التسوق في مصر · {selectedRoom?.product?.city || selectedRoom?.product?.governorate || 'مصر'}
              </span>
            </div>
            <div className="deba-comms-header-help">
              <Link href="/help">المساعدة</Link>
              <span className="deba-comms-divider" />
              <Link href="/about">إعلان من نحن</Link>
            </div>
          </div>

          <div className="deba-comms-header-left">
            <Link href="/" className="deba-comms-logo" aria-label="DEBA">
              <div className="deba-comms-logo-mark">D</div>
              <div>
                <div>DEBA</div>
                <div className="deba-comms-logo-sub">سوق الإعلانات والبيع المباشر في مصر</div>
              </div>
            </Link>
          </div>
        </header>

        <div className="deba-comms-main-content">
          <section className="deba-comms-chat-panel">
            <div className="deba-comms-chat-topbar">
              <Link href={productPath} className="deba-comms-listing-back">
                <ChevronRight size={16} />
                <div>
                  <div className="deba-comms-listing-back-label">العودة للإعلان</div>
                  <div className="deba-comms-listing-inline">
                    <span className="deba-comms-listing-title">
                      {selectedRoom?.product?.title || 'العودة للإعلان'}
                    </span>
                    {selectedRoom?.product ? (
                      <span className="deba-comms-listing-price">
                        — {formatMoney(selectedRoom.product.price, selectedRoom.product.currency)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>

              <div className="deba-comms-seller-info-bar">
                <div className="deba-comms-seller-avatar-sm" style={{ background: sellerGradient }}>
                  {selectedRoom?.counterparty?.avatar_url ? (
                    <img src={selectedRoom.counterparty.avatar_url} alt="" />
                  ) : (
                    sellerAvatar
                  )}
                  <span className="deba-comms-online-dot" />
                </div>
                <div className="deba-comms-seller-meta">
                  <div className="deba-comms-seller-label">شريك المحادثة</div>
                  <div className="deba-comms-seller-name">
                    {sellerName}
                    <BadgeCheck className="deba-comms-verified-icon" aria-label="حساب بائع" />
                  </div>
                </div>
              </div>

              <div className="deba-comms-topbar-actions">
                <button type="button" className="deba-comms-icon-btn" title="مكالمة صوتية" onClick={() => showToast('بدء مكالمة صوتية')}>
                  <Phone size={18} />
                </button>
                <button type="button" className="deba-comms-icon-btn" title="معلومات" onClick={() => showToast('ℹ️ معلومات البائع')}>
                  <Info size={18} />
                </button>
                <button type="button" className="deba-comms-icon-btn" title="المزيد" onClick={() => showToast('⚙️ خيارات إضافية')}>
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            <div className="deba-comms-security-banner">
              <ShieldCheck size={18} />
              <div>
                <strong>احفظ التفاوض والصفقة داخل DEBA.</strong> الرسائل تُسجّل مع إشارات أمان متاحة للمنصة، وقد تُراجع عند وجود مؤشرات احتيال.
              </div>
            </div>

            <div className="deba-comms-product-context">
              <Link href={productPath} className="deba-comms-product-context-card">
                <div className="deba-comms-product-thumb">
                  {selectedRoom?.product?.imageUrl ? (
                    <img src={selectedRoom.product.imageUrl} alt={selectedRoom.product.title} />
                  ) : (
                    <PackagePlaceholder />
                  )}
                  <span className="deba-comms-product-badge">إعلان نشط</span>
                </div>

                <div className="deba-comms-product-details">
                  <div className="deba-comms-product-title">
                    {selectedRoom?.product?.title || 'سلعة مرتبطة بالمحادثة'}
                  </div>
                  <div className="deba-comms-product-meta">
                    <span>{selectedRoom?.product?.categoryName || 'إعلانات وسلع'}</span>
                    <span className="deba-comms-product-dot" />
                    <span>{selectedRoom?.product?.city || selectedRoom?.product?.governorate || 'مصر'}</span>
                    <span className="deba-comms-product-dot" />
                    <span>
                      {selectedRoom?.product?.conditionGrade
                        ? conditionLabel(selectedRoom.product.conditionGrade)
                        : 'الحالة حسب الإعلان'}
                    </span>
                  </div>
                  <div className="deba-comms-product-price-row">
                    <div className="deba-comms-product-price">
                      {formatMoney(selectedRoom?.product?.price, selectedRoom?.product?.currency || 'EGP')}
                    </div>
                    <span className="deba-comms-view-listing-btn">عرض الإعلان</span>
                  </div>
                </div>
              </Link>
            </div>

            <div className="deba-comms-messages-area" id="deba-comms-messages-area" aria-live="polite">
              {loadingMessages ? (
                <div className="deba-comms-empty-state">
                  <Loader2 size={21} className="deba-comms-spin" />
                  جاري تحميل الرسائل...
                </div>
              ) : messages.length ? (
                <>
                  <div className="deba-comms-date-divider">
                    <span className="deba-comms-date-divider-label">
                      {formatDateLabel(messages[0]?.created_at)} · {formatTime(messages[0]?.created_at)}
                    </span>
                  </div>

                  {messages.map((message) => {
                    const mine = Boolean(message.sender_id && currentUserId && message.sender_id === currentUserId)
                    const messageProduct = productCardData(message, selectedRoom)
                    const offer = offerData(message)
                    const avatar = mine ? 'أ' : initials(sellerName)
                    const gradient = mine
                      ? 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)'
                      : sellerGradient

                    return (
                      <article
                        key={message.id}
                        className={'deba-comms-message ' + (mine ? 'sent' : 'received')}
                        onContextMenu={(event) => handleContextMenu(event, message)}
                      >
                        <div className="deba-comms-message-avatar" style={{ background: gradient }}>
                          {!mine && selectedRoom?.counterparty?.avatar_url ? (
                            <img src={selectedRoom.counterparty.avatar_url} alt="" />
                          ) : (
                            avatar
                          )}
                        </div>

                        <div className="deba-comms-message-content">
                          {messageProduct ? (
                            <div className="deba-comms-product-card-msg">
                              {messageProduct.imageUrl ? (
                                <img src={messageProduct.imageUrl} alt="" />
                              ) : (
                                <PackagePlaceholder compact />
                              )}
                              <div className="deba-comms-product-card-msg-body">
                                <div className="deba-comms-product-card-msg-title">{messageProduct.title}</div>
                                <div className="deba-comms-product-card-msg-price">{messageProduct.price}</div>
                                <div className="deba-comms-product-card-msg-meta">
                                  <MapPin size={12} />
                                  {messageProduct.location} · إعلان مرتبط
                                </div>
                              </div>
                            </div>
                          ) : offer ? (
                            <div className="deba-comms-offer-card">
                              <div className="deba-comms-offer-header">
                                <CircleDollarSign size={14} />
                                عرض سعر من البائع
                              </div>
                              <div className="deba-comms-offer-amount">{offer.amount}</div>
                              <div className="deba-comms-offer-note">{offer.note}</div>
                              <div className="deba-comms-offer-actions">
                                <button type="button" className="deba-comms-offer-btn accept" onClick={() => showToast('✅ تم قبول عرض السعر')}>قبول</button>
                                <button type="button" className="deba-comms-offer-btn counter" onClick={() => showToast('💰 فتح نافذة التفاوض على السعر')}>تفاوض</button>
                                <button type="button" className="deba-comms-offer-btn decline" onClick={() => showToast('❌ تم رفض عرض السعر')}>رفض</button>
                              </div>
                            </div>
                          ) : (
                            <div className="deba-comms-message-bubble">{message.body}</div>
                          )}

                          <div className="deba-comms-message-meta">
                            <span>{formatTime(message.created_at)}</span>
                            {mine ? (
                              <span className="deba-comms-read-receipt" aria-label="تمت القراءة">
                                <CheckCheck size={14} />
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </>
              ) : (
                <div className="deba-comms-empty-conversation">
                  <MessageCircle size={30} />
                  <strong>ابدأ التواصل</strong>
                  <span>اسأل عن الحالة والسعر وموعد الاستلام قبل تثبيت الصفقة.</span>
                </div>
              )}

              {typing ? (
                <div className="deba-comms-message received">
                  <div className="deba-comms-message-avatar" style={{ background: sellerGradient }}>{sellerAvatar}</div>
                  <div className="deba-comms-message-content">
                    <div className="deba-comms-typing-indicator">
                      <span className="deba-comms-typing-dot" />
                      <span className="deba-comms-typing-dot" />
                      <span className="deba-comms-typing-dot" />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {error ? <div className="deba-comms-error" role="alert">{error}</div> : null}

            <div className="deba-comms-quick-replies">
              {QUICK_REPLIES.map((reply) => (
                <button
                  key={reply.text}
                  type="button"
                  className="deba-comms-quick-reply"
                  onClick={() => sendQuick(reply.text)}
                >
                  {reply.icon ? reply.icon + ' ' : ''}
                  {reply.compact || reply.text}
                </button>
              ))}
            </div>

            <form className="deba-comms-input-area" onSubmit={(event) => void sendMessage(event)}>
              <div className="deba-comms-input-wrapper">
                <div className="deba-comms-input-actions">
                  <button type="button" className="deba-comms-input-action-btn" title="إرفاق ملف" onClick={() => showToast('📎 اختر ملفًا')}>
                    <Paperclip size={18} />
                  </button>
                  <button type="button" className="deba-comms-input-action-btn" title="صورة" onClick={() => showToast('📷 اختر صورة')}>
                    <ImageIcon size={18} />
                  </button>
                  <button type="button" className="deba-comms-input-action-btn" title="موقع" onClick={() => showToast('📍 تم إرسال الموقع')}>
                    <MapPin size={18} />
                  </button>
                  <button type="button" className="deba-comms-input-action-btn" title="عرض سعر" onClick={() => showToast('💰 فتح نافذة عرض السعر')}>
                    <CircleDollarSign size={18} />
                  </button>
                </div>

                <textarea
                  ref={inputRef}
                  className="deba-comms-message-input"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    resizeInput()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void sendMessage()
                    }
                  }}
                  maxLength={4000}
                  placeholder="اكتب رسالة واضحة داخل DEBA..."
                  rows={1}
                />

                <button
                  type="submit"
                  className="deba-comms-send-btn"
                  disabled={!draft.trim() || sending || !selectedRoomId}
                  title="إرسال"
                >
                  {sending ? <Loader2 size={20} className="deba-comms-spin" /> : <Send size={20} />}
                </button>
              </div>
            </form>

            <div className="deba-comms-legal-footer">
              لمكافحة الاحتيال، تُسجّل DEBA بيانات السلامة المتعلقة بالجلسة مثل IP والبريد والهاتف المرتبط بالحساب. متصفح الويب لا يتيح للموقع قراءة عنوان MAC.
            </div>
          </section>

          <aside className="deba-comms-sidebar">
            <div className="deba-comms-sidebar-header">
              <div className="deba-comms-sidebar-top">
                <div className="deba-comms-brand">
                  <span className="deba-comms-brand-label">DEBA COMMS</span>
                  <h1 className="deba-comms-brand-title">مركز المحادثات</h1>
                </div>
                <button
                  type="button"
                  className="deba-comms-refresh-btn"
                  onClick={() => void loadRooms().catch((e) => setError(e instanceof Error ? e.message : 'تعذر تحديث المحادثات.'))}
                  title="تحديث"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              <div className="deba-comms-security-banner-sm">
                <ShieldCheck size={14} />
                <span>محادثات داخل المنصة وخاضعة للمراقبة الوقائية</span>
              </div>
            </div>

            <div className="deba-comms-search-box">
              <div className="deba-comms-search-input-wrapper">
                <Search className="deba-comms-search-icon" size={16} />
                <input
                  type="text"
                  className="deba-comms-search-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث في المحادثات..."
                />
              </div>
            </div>

            <div className="deba-comms-tabs">
              <button
                type="button"
                className={'deba-comms-tab ' + (currentTab === 'all' ? 'active' : '')}
                onClick={() => setCurrentTab('all')}
              >
                الكل
              </button>
              <button
                type="button"
                className={'deba-comms-tab ' + (currentTab === 'unread' ? 'active' : '')}
                onClick={() => setCurrentTab('unread')}
              >
                غير مقروءة {unreadTotal ? <span className="deba-comms-tab-badge">{unreadTotal}</span> : null}
              </button>
              <button
                type="button"
                className={'deba-comms-tab ' + (currentTab === 'offers' ? 'active' : '')}
                onClick={() => setCurrentTab('offers')}
              >
                عروض
              </button>
            </div>

            <div className="deba-comms-chat-list">
              {loadingRooms ? (
                <div className="deba-comms-empty-state">
                  <Loader2 size={21} className="deba-comms-spin" />
                  جاري تحميل المحادثات...
                </div>
              ) : filteredRooms.length ? (
                filteredRooms.map((room) => {
                  const name = room.counterparty?.display_name || room.counterparty?.username || 'عضو DEBA'
                  const unread = room.unreadCount || 0
                  return (
                    <button
                      key={room.id}
                      type="button"
                      className={
                        'deba-comms-chat-item ' +
                        (selectedRoomId === room.id ? 'active ' : '') +
                        (unread ? 'unread' : '')
                      }
                      onClick={() => void openRoom(room.id)}
                    >
                      <span
                        className={'deba-comms-chat-item-avatar' + (name ? ' online' : '')}
                        style={{ background: gradientForName(name) }}
                      >
                        {room.counterparty?.avatar_url ? (
                          <img src={room.counterparty.avatar_url} alt="" />
                        ) : (
                          initials(name)
                        )}
                      </span>

                      <span className="deba-comms-chat-item-info">
                        <span className="deba-comms-chat-item-top">
                          <span className="deba-comms-chat-item-name">
                            {name}
                            <BadgeCheck size={12} />
                          </span>
                          <span className="deba-comms-chat-item-time">{formatTime(room.updated_at)}</span>
                        </span>
                        <span className="deba-comms-chat-item-preview">
                          {room.lastMessagePreview || 'ابدأ محادثة من داخل الإعلان'}
                        </span>
                        {room.product ? (
                          <span className="deba-comms-chat-item-product">
                            {room.product.imageUrl ? (
                              <img src={room.product.imageUrl} className="deba-comms-chat-item-product-thumb" alt="" />
                            ) : null}
                            <span>{room.product.title}</span>
                          </span>
                        ) : null}
                      </span>

                      {unread ? <span className="deba-comms-unread-count">{unread}</span> : null}
                    </button>
                  )
                })
              ) : (
                <div className="deba-comms-filter-empty">
                  <MessageCircle size={30} />
                  <strong>لا توجد محادثات</strong>
                  <span>ابدأ محادثة من أي إعلان</span>
                </div>
              )}
            </div>

            <div className="deba-comms-sidebar-stats">
              <div className="deba-comms-stat-item">
                <div className="deba-comms-stat-value">{rooms.length}</div>
                <div className="deba-comms-stat-label">محادثة</div>
              </div>
              <div className="deba-comms-stat-item">
                <div className="deba-comms-stat-value">{offerTotal}</div>
                <div className="deba-comms-stat-label">عروض نشطة</div>
              </div>
              <div className="deba-comms-stat-item">
                <div className="deba-comms-stat-value">—</div>
                <div className="deba-comms-stat-label">معدل الرد</div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className={'deba-comms-toast' + (toast ? ' show' : '')} role="status" aria-live="polite">
        {toast}
      </div>

      {contextMenu ? (
        <div
          className="deba-comms-context-menu show"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" className="deba-comms-context-item" onClick={() => contextMessage && contextAction('pin')}>
            <Pin size={15} />
            <span>تثبيت الرسالة</span>
          </button>
          <button type="button" className="deba-comms-context-item" onClick={() => contextMessage && contextAction('reply')}>
            <Reply size={15} />
            <span>رد</span>
          </button>
          <button type="button" className="deba-comms-context-item" onClick={() => contextMessage && contextAction('forward')}>
            <Forward size={15} />
            <span>تحويل</span>
          </button>
          <button type="button" className="deba-comms-context-item" onClick={() => contextMessage && void handleCopy(contextMessage)}>
            <Copy size={15} />
            <span>نسخ</span>
          </button>
          <button type="button" className="deba-comms-context-item" onClick={() => contextMessage && contextAction('report')}>
            <Flag size={15} />
            <span>إبلاغ</span>
          </button>
          <div className="deba-comms-context-divider" />
          <button type="button" className="deba-comms-context-item danger" onClick={() => contextMessage && contextAction('delete')}>
            <Trash2 size={15} />
            <span>حذف</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
