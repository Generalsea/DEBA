'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

type DemoChat = {
  id: string
  name: string
  avatar: string
  gradient: string
  online: boolean
  verified: boolean
  unread: number
  lastTime: string
  lastMsg: string
  product: { title: string; price: string; img: string } | null
  active?: boolean
}

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

type FilterTab = 'all' | 'unread' | 'offers'

const DEMO_IMAGE_1 = 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=300&fit=crop'

const demoChats: DemoChat[] = [
  {
    id: 'demo-1',
    name: 'songtone1',
    avatar: 'S',
    gradient: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
    online: true,
    verified: true,
    unread: 0,
    lastTime: '14:42',
    lastMsg: 'شكرًا على الصور! السعر معقول...',
    product: { title: 'شليور لاسلكي 18V', price: '180 جنيه', img: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=100&h=100&fit=crop' },
    active: true,
  },
  {
    id: 'demo-2',
    name: 'أحمد محمد',
    avatar: 'أ',
    gradient: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    online: true,
    verified: true,
    unread: 2,
    lastTime: '12:15',
    lastMsg: 'هل الساعة لا تزال متاحة؟',
    product: { title: 'ساعة ذكية متعددة الوظائف', price: '2,450 جنيه', img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&h=100&fit=crop' },
  },
  {
    id: 'demo-3',
    name: 'فاطمة حسن',
    avatar: 'ف',
    gradient: 'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
    online: false,
    verified: false,
    unread: 1,
    lastTime: 'أمس',
    lastMsg: 'شكرًا جزيلاً لك!',
    product: { title: 'سماعات لاسلكية', price: '1,850 جنيه', img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&h=100&fit=crop' },
  },
  {
    id: 'demo-4',
    name: 'يوسف إبراهيم',
    avatar: 'ي',
    gradient: 'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)',
    online: false,
    verified: true,
    unread: 0,
    lastTime: 'أمس',
    lastMsg: 'هل يمكن خفض السعر قليلاً؟',
    product: { title: 'لابتوب للأعمال', price: '15,500 جنيه', img: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=100&h=100&fit=crop' },
  },
  {
    id: 'demo-5',
    name: 'نور الدين',
    avatar: 'ن',
    gradient: 'linear-gradient(135deg, #FA709A 0%, #FEE140 100%)',
    online: true,
    verified: false,
    unread: 0,
    lastTime: 'منذ يومين',
    lastMsg: 'تم الاستلام، شكرًا!',
    product: null,
  },
  {
    id: 'demo-6',
    name: 'كريم سامي',
    avatar: 'ك',
    gradient: 'linear-gradient(135deg, #A8EDEA 0%, #FED6E3 100%)',
    online: false,
    verified: false,
    unread: 0,
    lastTime: 'منذ 3 أيام',
    lastMsg: 'أرسلت لك الصور',
    product: { title: 'كاميرا احترافية', price: '8,900 جنيه', img: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=100&h=100&fit=crop' },
  },
]

const DEMO_MESSAGES: Array<{
  from: 'mine' | 'seller'
  kind: 'text' | 'product' | 'offer'
  time: string
  body?: string
}> = [
  { from: 'mine', kind: 'text', time: '14:32', body: 'السلام عليكم، أنا مهتم بالشليور اللاسلكي. هل لا يزال متاحًا؟' },
  { from: 'seller', kind: 'text', time: '14:35', body: 'وعليكم السلام ورحمة الله! نعم متاح، استخدمته شوية بس في حالة ممتازة. معاه بطاريتين وشاحن أصلي.' },
  { from: 'mine', kind: 'text', time: '14:36', body: 'ممتاز! هل يمكن رؤية صور إضافية للبطاريات؟ وهل السعر قابل للتفاوض؟' },
  { from: 'seller', kind: 'product', time: '14:38' },
  { from: 'seller', kind: 'offer', time: '14:40' },
  { from: 'mine', kind: 'text', time: '14:42', body: 'شكرًا على الصور! السعر معقول. هل يمكن الاستلام من مدينة نصر بدل المعادي؟' },
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
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'اليوم'
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function formatMoney(value: number | string | null | undefined, currency: string) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 'السعر عند التواصل'
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(numeric) + ' ' + (currency === 'EGP' ? 'جنيه' : currency)
}

function initials(value: string | null | undefined, fallback = 'أ') {
  const text = value?.trim() || ''
  if (!text) return fallback
  return Array.from(text).filter((char) => char.trim()).slice(0, 2).join('') || fallback
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
  const seed = value || ''
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

function avatarMarkup(avatarUrl: string | null | undefined, fallback: string) {
  return avatarUrl ? <img src={avatarUrl} alt="" /> : fallback
}

export default function ChatWorkspace({ initialProduct }: { initialProduct?: string }) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [currentTab, setCurrentTab] = useState<FilterTab>('all')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [toast, setToast] = useState('')
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const toastTimer = useRef<number | null>(null)

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId],
  )

  const demoMode = process.env.NODE_ENV !== 'production'
  const showDemoConversation = demoMode && selectedRoom?.product?.title === 'شليور لاسلكي 18V — تجربة DEBA' && messages.length === 0

  const mergedChats = useMemo(() => {
    const live = rooms.map((room): DemoChat & { roomId: string; live: true } => {
      const name = room.counterparty?.display_name || room.counterparty?.username || 'عضو DEBA'
      return {
        id: room.id,
        roomId: room.id,
        live: true,
        name,
        avatar: initials(name, 'د'),
        gradient: gradientForName(name),
        online: true,
        verified: true,
        unread: room.unreadCount || 0,
        lastTime: formatTime(room.updated_at),
        lastMsg: room.lastMessagePreview || 'ابدأ محادثة من داخل الإعلان',
        product: room.product
          ? {
              title: room.product.title,
              price: formatMoney(room.product.price, room.product.currency),
              img: room.product.imageUrl || '',
            }
          : null,
        active: room.id === selectedRoomId,
      }
    })

    const demos = demoMode
      ? demoChats
          .filter((chat) => !live.some((room) => room.name === chat.name && room.product?.title?.startsWith(chat.product?.title || '\u0000')))
          .map((chat) => ({ ...chat, live: false as const }))
      : []

    return [...live, ...demos]
  }, [demoMode, rooms, selectedRoomId, refreshToken])

  const filteredChats = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('ar')
    return mergedChats.filter((chat) => {
      const text = (chat.name + ' ' + chat.lastMsg + ' ' + (chat.product?.title || '')).toLocaleLowerCase('ar')
      const matchesSearch = !needle || text.includes(needle)
      const matchesTab =
        currentTab === 'all' ||
        (currentTab === 'unread' && chat.unread > 0) ||
        (currentTab === 'offers' && Boolean(chat.product))
      return matchesSearch && matchesTab
    })
  }, [currentTab, mergedChats, search])

  const unreadTotal = mergedChats.reduce((sum, chat) => sum + chat.unread, 0)
  const offerTotal = mergedChats.filter((chat) => Boolean(chat.product)).length

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2500)
  }

  async function loadRooms() {
    const response = await fetch('/api/chat/rooms', { cache: 'no-store' })
    const data = await response.json() as { rooms?: Room[]; error?: string }
    if (!response.ok) throw new Error(data.error || 'تعذر تحميل المحادثات.')
    setRooms(data.rooms || [])
    setLoading(false)
    return data.rooms || []
  }

  async function openRoom(roomId: string) {
    if (roomId.startsWith('demo-')) {
      showToast('💬 فتح محادثة تجريبية')
      setSelectedRoomId(null)
      return
    }

    setSelectedRoomId(roomId)
    setLoadingMessages(true)
    setContextMenu(null)

    try {
      const response = await fetch('/api/chat/rooms/' + encodeURIComponent(roomId) + '/messages?limit=100', { cache: 'no-store' })
      const data = await response.json() as { messages?: Message[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل الرسائل.')
      setMessages(data.messages || [])
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر تحميل الرسائل.')
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }

  async function createOrOpenProductRoom(productId: string) {
    const response = await fetch('/api/chat/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    })

    const data = await response.json() as { room?: { room_id?: string }; error?: string }
    if (!response.ok || !data.room?.room_id) {
      throw new Error(data.error || 'تعذر فتح المحادثة الآن.')
    }

    const loadedRooms = await loadRooms()
    const roomId = data.room.room_id
    if (!loadedRooms.some((room) => room.id === roomId)) {
      setSelectedRoomId(roomId)
      return
    }
    await openRoom(roomId)
  }

  useEffect(() => {
    let active = true

    async function boot() {
      try {
        const roomsData = await loadRooms()
        if (!active) return

        const claimsClient = (await import('@/utils/supabase/client')).createClient()
        const { data: claims } = await claimsClient.auth.getClaims()
        const id = typeof claims?.claims?.sub === 'string' ? claims.claims.sub : null
        setCurrentUserId(id)

        if (initialProduct) {
          await createOrOpenProductRoom(initialProduct)
          return
        }

        const preferred = new URL(window.location.href).searchParams.get('room')
        if (preferred && roomsData.some((room) => room.id === preferred)) {
          await openRoom(preferred)
        } else if (roomsData[0]) {
          await openRoom(roomsData[0].id)
        }
      } catch (error) {
        if (active) {
          setLoading(false)
          showToast(error instanceof Error ? error.message : 'تعذر تحميل مركز المحادثات.')
        }
      }
    }

    void boot()
    return () => { active = false }
  }, [initialProduct, refreshToken])

  useEffect(() => {
    if (!selectedRoomId) return
    const interval = window.setInterval(() => void openRoom(selectedRoomId), 5000)
    return () => window.clearInterval(interval)
  }, [selectedRoomId])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  function resizeInput() {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = Math.min(input.scrollHeight, 120) + 'px'
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending || !selectedRoomId) return

    setSending(true)
    try {
      const response = await fetch('/api/chat/rooms/' + encodeURIComponent(selectedRoomId) + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const data = await response.json() as { message?: Message; error?: string }
      if (!response.ok || !data.message) throw new Error(data.error || 'تعذر إرسال الرسالة.')

      setMessages((current) => [...current, data.message as Message])
      setDraft('')
      resizeInput()
      showToast('تم إرسال الرسالة')
      requestAnimationFrame(() => {
        document.getElementById('messagesArea')?.scrollTo({ top: 999999, behavior: 'smooth' })
      })
      void loadRooms()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر إرسال الرسالة.')
    } finally {
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

  function handleOffer(action: 'accept' | 'counter' | 'decline') {
    const texts = {
      accept: '✅ تم قبول عرض السعر (160 جنيه)',
      counter: '💰 فتح نافذة التفاوض على السعر',
      decline: '❌ تم رفض عرض السعر',
    }
    showToast(texts[action])
  }

  function contextAction(action: string) {
    const texts: Record<string, string> = {
      pin: '📌 تم تثبيت الرسالة',
      reply: '↩️ تم الرد',
      forward: '➡️ تم التحويل',
      copy: '📋 تم النسخ',
      report: '🚩 تم الإبلاغ',
      delete: '🗑️ تم الحذف',
    }
    showToast(texts[action] || 'تم التنفيذ')
    setContextMenu(null)
  }

  async function copyMessage(messageId: string) {
    const message = messages.find((item) => item.id === messageId)
    if (!message?.body) return
    try {
      await navigator.clipboard.writeText(message.body)
      showToast('📋 تم النسخ')
    } catch {
      showToast('تعذر نسخ الرسالة')
    }
    setContextMenu(null)
  }

  const sellerName = selectedRoom?.counterparty?.display_name || selectedRoom?.counterparty?.username || 'songtone1'
  const sellerAvatar = initials(sellerName, 'أ')
  const sellerGradient = gradientForName(sellerName)
  const listingTitle = selectedRoom?.product?.title || 'شليور لاسلكي 18V'
  const listingPrice = selectedRoom?.product ? formatMoney(selectedRoom.product.price, selectedRoom.product.currency) : '180 جنيه'
  const productLink = selectedRoom?.product?.slug ? '/products/' + encodeURIComponent(selectedRoom.product.slug) : '/'

  const liveMessages = showDemoConversation ? [] : messages

  return (
    <div className="deba-comms-page deba-comms-exact" dir="rtl">
      <div className="deba-comms-app app">

        <header className="deba-comms-top-header top-header">
          <div className="deba-comms-header-right header-right">
            <div className="deba-comms-location-badge location-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>التسوق في مصر · {selectedRoom?.product?.city || selectedRoom?.product?.governorate || 'القاهرة، القاهرة'}</span>
            </div>
            <div className="deba-comms-header-help header-help">
              <Link href="/help">المساعدة</Link>
              <span className="divider" />
              <Link href="/about">إعلان من نحن</Link>
            </div>
          </div>

          <div className="deba-comms-header-left header-left">
            <Link href="/" className="deba-comms-logo logo">
              <div className="deba-comms-logo-mark logo-mark">D</div>
              <div>
                <div>DEBA</div>
                <div className="deba-comms-logo-sub logo-sub">سوق الإعلانات والبيع المباشر في مصر</div>
              </div>
            </Link>
          </div>
        </header>

        <div className="deba-comms-main-content main-content">

          <section className="deba-comms-chat-panel chat-panel">

            <div className="deba-comms-chat-topbar chat-topbar">
              <Link href={productLink} className="deba-comms-listing-back listing-back">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>العودة للإعلان</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="listing-title">{listingTitle}</span>
                    <span className="listing-price">— {listingPrice}</span>
                  </div>
                </div>
              </Link>

              <div className="deba-comms-seller-info-bar seller-info-bar">
                <div className="deba-comms-seller-avatar-sm seller-avatar-sm" style={{ background: sellerGradient }}>
                  {selectedRoom?.counterparty?.avatar_url ? (
                    <img src={selectedRoom.counterparty.avatar_url} alt="" />
                  ) : (
                    sellerAvatar
                  )}
                  <span className="online-dot" />
                </div>
                <div className="deba-comms-seller-meta seller-meta">
                  <div className="seller-label">شريك المحادثة</div>
                  <div className="seller-name">
                    {sellerName}
                    <svg className="verified-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L14.09 4.26L17 3.27L17.74 6.26L20.73 7L19.74 9.91L22 12L19.74 14.09L20.73 17L17.74 17.74L17 20.73L14.09 19.74L12 22L9.91 19.74L7 20.73L6.26 17.74L3.27 17L4.26 14.09L2 12L4.26 9.91L3.27 7L6.26 6.26L7 3.27L9.91 4.26L12 2Z" />
                      <path d="M10 12L11.5 13.5L14 10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="deba-comms-topbar-actions topbar-actions">
                <button type="button" className="deba-comms-icon-btn icon-btn" title="مكالمة صوتية" onClick={() => showToast(' بدء مكالمة صوتية')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>
                <button type="button" className="deba-comms-icon-btn icon-btn" title="معلومات" onClick={() => showToast('ℹ️ معلومات البائع')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
                <button type="button" className="deba-comms-icon-btn icon-btn" title="المزيد" onClick={() => showToast('⚙️ خيارات إضافية')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="deba-comms-security-banner security-banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              <div>
                <strong>احفظ التفاوض والصفقة داخل DEBA.</strong> الرسائل تُسجّل مع إشارات أمان متاحة للمنصة، وقد تُراجع عند وجود مؤشرات احتيال.
              </div>
            </div>

            <div className="deba-comms-product-context product-context">
              <Link href={productLink} className="deba-comms-product-context-card product-context-card">
                <div className="deba-comms-product-thumb product-thumb">
                  {selectedRoom?.product?.imageUrl ? (
                    <img src={selectedRoom.product.imageUrl} alt={selectedRoom.product.title} />
                  ) : (
                    <img src={DEMO_IMAGE_1} alt="شليور" />
                  )}
                  <span className="badge">إعلان نشط</span>
                </div>
                <div className="deba-comms-product-details product-details">
                  <div className="product-title">{listingTitle === 'شليور لاسلكي 18V' ? 'شليور لاسلكي 18V — تجربة DEBA' : listingTitle}</div>
                  <div className="product-meta">
                    <span>{selectedRoom?.product?.categoryName || 'أدوات ومعدات'}</span>
                    <span className="dot" />
                    <span>{selectedRoom?.product?.city || selectedRoom?.product?.governorate || 'القاهرة'}</span>
                    <span className="dot" />
                    <span>{selectedRoom?.product?.conditionGrade || 'مستعمل · حالة ممتازة'}</span>
                  </div>
                  <div className="product-price-row">
                    <div className="product-price">
                      {listingPrice.replace(' ', ' ')}
                    </div>
                    <span className="view-listing-btn">عرض الإعلان</span>
                  </div>
                </div>
              </Link>
            </div>

            <div className="deba-comms-messages-area messages-area" id="messagesArea" aria-live="polite">
              <div className="date-divider">
                <div className="date-divider-label">
                  {showDemoConversation ? 'اليوم · 14:32' : liveMessages.length ? formatDateLabel(liveMessages[0]?.created_at) + ' · ' + formatTime(liveMessages[0]?.created_at) : 'اليوم'}
                </div>
              </div>

              {loadingMessages && !showDemoConversation ? (
                <div className="deba-comms-empty-state">جاري تحميل الرسائل...</div>
              ) : showDemoConversation ? (
                DEMO_MESSAGES.map((message, index) => {
                  const mine = message.from === 'mine'
                  return (
                    <div className={'message ' + (mine ? 'sent' : 'received')} key={'demo-message-' + index}>
                      <div
                        className="message-avatar"
                        style={mine ? undefined : { background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)' }}
                      >
                        {mine ? 'S' : 'أ'}
                      </div>
                      <div className="message-content">
                        {message.kind === 'text' ? (
                          <div className="message-bubble">{message.body}</div>
                        ) : null}

                        {message.kind === 'product' ? (
                          <div className="product-card-msg">
                            <img src={DEMO_IMAGE_1} alt="" />
                            <div className="product-card-msg-body">
                              <div className="product-card-msg-title">شليور لاسلكي 18V + بطاريتين</div>
                              <div className="product-card-msg-price">180 جنيه</div>
                              <div className="product-card-msg-meta">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                القاهرة · إعلان مرتبط
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {message.kind === 'offer' ? (
                          <div className="offer-card">
                            <div className="offer-header">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="1" x2="12" y2="23" />
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                              </svg>
                              عرض سعر من البائع
                            </div>
                            <div className="offer-amount">160 جنيه</div>
                            <div className="offer-note">يمكنني تخفيض السعر إلى 160 جنيه إذا استلمته اليوم من المعادي.</div>
                            <div className="offer-actions">
                              <button className="offer-btn accept" type="button" onClick={() => handleOffer('accept')}>قبول</button>
                              <button className="offer-btn counter" type="button" onClick={() => handleOffer('counter')}>تفاوض</button>
                              <button className="offer-btn decline" type="button" onClick={() => handleOffer('decline')}>رفض</button>
                            </div>
                          </div>
                        ) : null}

                        <div className="message-meta">
                          <span>{message.time}</span>
                          {mine ? (
                            <span className="read-receipt">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                                <polyline points="16 6 7 17 2 12" transform="translate(4, 0)" />
                              </svg>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : liveMessages.length ? (
                liveMessages.map((message) => {
                  const mine = Boolean(message.sender_id && currentUserId && message.sender_id === currentUserId)
                  return (
                    <div
                      className={'message ' + (mine ? 'sent' : 'received')}
                      key={message.id}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setContextMenu({ messageId: message.id, x: event.clientX, y: event.clientY })
                      }}
                    >
                      <div className="message-avatar">{mine ? 'S' : sellerAvatar}</div>
                      <div className="message-content">
                        <div className="message-bubble">{message.body}</div>
                        <div className="message-meta">
                          <span>{formatTime(message.created_at)}</span>
                          {mine ? (
                            <span className="read-receipt">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                                <polyline points="16 6 7 17 2 12" transform="translate(4, 0)" />
                              </svg>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="deba-comms-empty-conversation">
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                  <strong>لا توجد رسائل بعد</strong>
                  <span>اكتب أول رسالة لبدء التفاوض داخل DEBA.</span>
                </div>
              )}

              <div className="message received" id="typingMsg">
                <div className="message-avatar">أ</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              </div>
            </div>

            <div className="quick-replies">
              <button className="quick-reply" type="button" onClick={() => sendQuick('هل السعر قابل للتفاوض؟')}>💰 هل السعر قابل للتفاوض؟</button>
              <button className="quick-reply" type="button" onClick={() => sendQuick('أين يمكن الاستلام؟')}>📍 أين يمكن الاستلام؟</button>
              <button className="quick-reply" type="button" onClick={() => sendQuick('هل المنتج بحالة جيدة؟')}>✅ حالة المنتج</button>
              <button className="quick-reply" type="button" onClick={() => sendQuick('أريد صور إضافية')}>📷 صور إضافية</button>
              <button className="quick-reply" type="button" onClick={() => sendQuick('متى يكون متاحًا؟')}>موعد الاستلام</button>
            </div>

            <div className="input-area">
              <div className="input-wrapper">
                <div className="input-actions">
                  <button className="input-action-btn" type="button" title="إرفاق ملف" onClick={() => showToast('📎 اختر ملفًا')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <button className="input-action-btn" type="button" title="صورة" onClick={() => showToast('📷 اختر صورة')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </button>
                  <button className="input-action-btn" type="button" title="موقع" onClick={() => showToast('📍 تم إرسال الموقع')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </button>
                  <button className="input-action-btn" type="button" title="عرض سعر" onClick={() => showToast('💰 فتح نافذة عرض السعر')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </button>
                </div>

                <textarea
                  ref={inputRef}
                  className="message-input"
                  value={draft}
                  placeholder="اكتب رسالة واضحة داخل DEBA..."
                  rows={1}
                  maxLength={4000}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    resizeInput()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void handleSend()
                    }
                  }}
                />

                <button className="send-btn" type="button" disabled={!draft.trim() || sending || !selectedRoomId} onClick={() => void handleSend()}>
                  {sending ? (
                    <span style={{ fontSize: 12 }}>…</span>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="legal-footer">
              لمكافحة الاحتيال، تُسجّل DEBA بيانات السلامة المتعلقة من الجلسة مثل IP والبريد والهاتف. عند إرسال الرسالة، ستصبح الوسيط لا يُتيح للموقع قراءة عنوان MAC.
            </div>
          </section>

          <aside className="deba-comms-sidebar sidebar">
            <div className="sidebar-header">
              <div className="sidebar-top">
                <div className="brand">
                  <span className="brand-label">DEBA COMMS</span>
                  <h1 className="brand-title">مركز المحادثات</h1>
                </div>
                <button className="refresh-btn" type="button" onClick={() => setRefreshToken((value) => value + 1)} title="تحديث">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </button>
              </div>

              <div className="security-banner-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                <span>محادثات داخل المنصة وخاضعة للمراقبة الوقائية</span>
              </div>
            </div>

            <div className="search-box">
              <div className="search-input-wrapper">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="search-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث في المحادثات..."
                />
              </div>
            </div>

            <div className="tabs">
              <button className={'tab ' + (currentTab === 'all' ? 'active' : '')} type="button" onClick={() => setCurrentTab('all')}>
                الكل
              </button>
              <button className={'tab ' + (currentTab === 'unread' ? 'active' : '')} type="button" onClick={() => setCurrentTab('unread')}>
                غير مقروءة {unreadTotal > 0 ? <span className="tab-badge">{unreadTotal}</span> : null}
              </button>
              <button className={'tab ' + (currentTab === 'offers' ? 'active' : '')} type="button" onClick={() => setCurrentTab('offers')}>
                عروض
              </button>
            </div>

            <div className="chat-list">
              {loading && !filteredChats.length ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>جاري تحميل المحادثات...</div>
              ) : filteredChats.length ? (
                filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    className={'chat-item ' + (chat.id === selectedRoomId || (!selectedRoomId && chat.active) ? 'active ' : '') + (chat.unread > 0 ? 'unread' : '')}
                    onClick={() => void (chat.live ? openRoom(chat.id) : showToast('💬 فتح محادثة مع ' + chat.name))}
                    style={{ width: '100%', textAlign: 'right' }}
                  >
                    <span className={'chat-item-avatar ' + (chat.online ? 'online' : '')} style={{ background: chat.gradient }}>
                      {chat.live
                        ? (rooms.find((room) => room.id === chat.id)?.counterparty?.avatar_url
                            ? <img src={rooms.find((room) => room.id === chat.id)?.counterparty?.avatar_url || ''} alt="" />
                            : chat.avatar)
                        : chat.avatar}
                    </span>
                    <span className="chat-item-info">
                      <span className="chat-item-top">
                        <span className="chat-item-name">
                          {chat.name}
                          {chat.verified ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#3B82F6">
                              <path d="M12 2L14.09 4.26L17 3.27L17.74 6.26L20.73 7L19.74 9.91L22 12L19.74 14.09L20.73 17L17.74 17.74L17 20.73L14.09 19.74L12 22L9.91 19.74L7 20.73L6.26 17.74L3.27 17L4.26 14.09L2 12L4.26 9.91L3.27 7L6.26 6.26L7 3.27L9.91 4.26L12 2Z" />
                              <path d="M10 12L11.5 13.5L14 10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : null}
                        </span>
                        <span className="chat-item-time">{chat.lastTime}</span>
                      </span>
                      <span className="chat-item-preview">{chat.lastMsg}</span>
                      {chat.product ? (
                        <span className="chat-item-product">
                          <img src={chat.product.img} className="chat-item-product-thumb" alt="" />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.product.title}</span>
                        </span>
                      ) : null}
                    </span>
                    {chat.unread > 0 ? <span className="unread-count">{chat.unread}</span> : null}
                  </button>
                ))
              ) : (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>لا توجد محادثات</div>
                  <div style={{ fontSize: 11.5 }}>ابدأ محادثة من أي إعلان</div>
                </div>
              )}
            </div>

            <div className="sidebar-stats">
              <div className="stat-item">
                <div className="stat-value">{rooms.length || (demoMode ? 12 : 0)}</div>
                <div className="stat-label">محادثة</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{rooms.length ? offerTotal : (demoMode ? 3 : 0)}</div>
                <div className="stat-label">عروض نشطة</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{rooms.length ? '—' : (demoMode ? '98%' : '—')}</div>
                <div className="stat-label">معدل الرد</div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className={'toast ' + (toast ? 'show' : '')} id="toast" role="status" aria-live="polite">
        {toast}
      </div>

      {contextMenu ? (
        <div
          className="context-menu show"
          style={{ left: contextMenu.x, top: contextMenu.y, display: 'block' }}
          onClick={(event) => event.stopPropagation()}
        >
          <button className="context-item" type="button" onClick={() => contextAction('pin')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            <span>تثبيت الرسالة</span>
          </button>
          <button className="context-item" type="button" onClick={() => contextAction('reply')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></svg>
            <span>رد</span>
          </button>
          <button className="context-item" type="button" onClick={() => contextAction('forward')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 0 1 4-4h12" /></svg>
            <span>تحويل</span>
          </button>
          <button className="context-item" type="button" onClick={() => void copyMessage(contextMenu.messageId)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            <span>نسخ</span>
          </button>
          <button className="context-item" type="button" onClick={() => contextAction('report')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
            <span>إبلاغ</span>
          </button>
          <div className="context-divider" />
          <button className="context-item danger" type="button" onClick={() => contextAction('delete')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            <span>حذف</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
