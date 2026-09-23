'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

type Product = {
  title?: string | null
  slug?: string | null
  price?: number | string | null
  currency?: string | null
  city?: string | null
  governorate?: string | null
  conditionGrade?: string | null
  categoryName?: string | null
  imageUrl?: string | null
}

type Room = {
  id: string
  product_id: string | null
  updated_at: string
  unreadCount?: number
  hasOffers?: boolean
  lastMessagePreview?: string | null
  product?: Product | null
  participant?: { last_read_at: string | null; is_muted: boolean } | null
  counterparty?: {
    id?: string
    display_name?: string | null
    username?: string | null
    avatar_url?: string | null
    account_type?: string | null
  } | null
}

type LiveChat = {
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
  hasOffers?: boolean
  active?: boolean
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

const gradients = [
  'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
  'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
  'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
  'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)',
  'linear-gradient(135deg, #FA709A 0%, #FEE140 100%)',
  'linear-gradient(135deg, #A8EDEA 0%, #FED6E3 100%)',
]

function initials(value: string) {
  return Array.from(value.trim()).filter(Boolean).slice(0, 2).join('') || 'د'
}

function gradientFor(value: string) {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return gradients[hash % gradients.length]
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatPrice(product: Product | null | undefined) {
  const numeric = Number(product?.price)
  if (!Number.isFinite(numeric)) return 'السعر عند التواصل'
  const value = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(numeric)
  return value + ' ' + (product?.currency === 'EGP' || !product?.currency ? 'جنيه' : product.currency)
}

export default function ChatCommsExact({ initialProduct }: { initialProduct: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const roomIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const roomsRef = useRef<Room[]>([])
  const refreshInFlightRef = useRef(false)

  useEffect(() => {
    const frame = iframeRef.current
    if (!frame) return

    let disposed = false
    let pollingTimer: number | null = null

    const frameWindow = () => frame.contentWindow as (Window & {
      DEBAComms?: {
        setChats?: (chats: LiveChat[]) => void
        setStats?: (stats: { conversations: number; activeOffers: number; responseRate: string }) => void
        setRoom?: (room: Room) => void
        renderMessages?: (messages: Message[], currentUserId: string | null) => void
        onOpenChat?: (roomId: string) => void | Promise<void>
        onSend?: () => void | Promise<void>
        onQuick?: (text: string) => void | Promise<void>
        onRefresh?: () => void | Promise<void>
      }
      showToast?: (message: string) => void
      setTimeout: typeof window.setTimeout
    }) | null

    const showToast = (message: string) => {
      frameWindow()?.showToast?.(message)
    }

    const loadRooms = async () => {
      const response = await fetch('/api/chat/rooms', { cache: 'no-store' })
      const data = await response.json() as { rooms?: Room[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل المحادثات.')
      return data.rooms || []
    }

    const mapChats = (rooms: Room[]) => rooms.map((room, index): LiveChat => {
      const name = room.counterparty?.display_name || room.counterparty?.username || 'عضو DEBA'
      return {
        id: room.id,
        name,
        avatar: initials(name),
        gradient: gradientFor(name + index),
        online: true,
        verified: true,
        unread: Number(room.unreadCount || 0),
        lastTime: formatTime(room.updated_at),
        lastMsg: room.lastMessagePreview || 'ابدأ التفاوض داخل DEBA',
        product: room.product
          ? {
              title: room.product.title || 'إعلان DEBA',
              price: formatPrice(room.product),
              img: room.product.imageUrl || '',
            }
          : null,
        hasOffers: Boolean(room.hasOffers),
        active: room.id === roomIdRef.current,
      }
    })

    const renderRooms = (rooms: Room[]) => {
      roomsRef.current = rooms
      const bridge = frameWindow()?.DEBAComms
      const mapped = mapChats(rooms)
      bridge?.setChats?.(mapped)
      bridge?.setStats?.({
        conversations: rooms.length,
        activeOffers: rooms.filter((room) => Boolean(room.hasOffers)).length,
        responseRate: '—',
      })
    }

    const loadMessages = async (roomId: string) => {
      const response = await fetch('/api/chat/rooms/' + encodeURIComponent(roomId) + '/messages?limit=100', {
        cache: 'no-store',
      })
      const data = await response.json() as { messages?: Message[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل الرسائل.')
      frameWindow()?.DEBAComms?.renderMessages?.(data.messages || [], userIdRef.current)
      return data.messages || []
    }

    const openLiveRoom = async (roomId: string) => {
      const room = roomsRef.current.find((item) => item.id === roomId)
      if (!room) {
        showToast('المحادثة لم تعد متاحة.')
        return
      }

      roomIdRef.current = roomId
      renderRooms(roomsRef.current.map((item) => ({ ...item })))
      frameWindow()?.DEBAComms?.setRoom?.(room)
      try {
        await loadMessages(roomId)
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'تعذر تحميل الرسائل.')
      }
    }

    const refreshRooms = async (autoSelect = true) => {
      if (refreshInFlightRef.current || disposed) return
      refreshInFlightRef.current = true
      try {
        const rooms = await loadRooms()
        renderRooms(rooms)

        if (roomIdRef.current && rooms.some((room) => room.id === roomIdRef.current)) {
          const current = rooms.find((room) => room.id === roomIdRef.current) || null
          if (current) frameWindow()?.DEBAComms?.setRoom?.(current)
        } else if (autoSelect && rooms[0]) {
          await openLiveRoom(rooms[0].id)
        } else if (!rooms.length) {
          roomIdRef.current = null
          frameWindow()?.DEBAComms?.renderMessages?.([], userIdRef.current)
        }
      } finally {
        refreshInFlightRef.current = false
      }
    }

    const createProductRoom = async () => {
      if (!initialProduct) return null
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: initialProduct }),
        cache: 'no-store',
      })
      const data = await response.json() as { room?: { room_id?: string }; error?: string }
      if (!response.ok || !data.room?.room_id) throw new Error(data.error || 'تعذر فتح المحادثة الآن.')
      return data.room.room_id
    }

    const sendMessage = async () => {
      const doc = frame.contentDocument
      const input = doc?.getElementById('messageInput') as HTMLTextAreaElement | null
      if (!input) return
      const body = input.value.trim()
      if (!body) return

      const roomId = roomIdRef.current
      if (!roomId) {
        showToast('لا توجد محادثة حقيقية مفتوحة.')
        return
      }

      const sendButton = doc?.getElementById('sendBtn') as HTMLButtonElement | null
      if (sendButton) sendButton.disabled = true

      try {
        const response = await fetch('/api/chat/rooms/' + encodeURIComponent(roomId) + '/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
          cache: 'no-store',
        })
        const data = await response.json() as { message?: Message; error?: string }
        if (!response.ok || !data.message) throw new Error(data.error || 'تعذر إرسال الرسالة.')

        input.value = ''
        input.style.height = 'auto'
        input.dispatchEvent(new Event('input', { bubbles: true }))
        showToast('تم إرسال الرسالة')

        await loadMessages(roomId)
        await refreshRooms(false)
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'تعذر إرسال الرسالة.')
      } finally {
        if (sendButton) {
          sendButton.disabled = false
          sendButton.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }
    }

    const installBridge = async () => {
      const win = frameWindow()
      const bridge = win?.DEBAComms
      if (!win || !bridge || disposed) return

      bridge.onOpenChat = openLiveRoom
      bridge.onSend = sendMessage
      bridge.onQuick = async (text) => {
        const input = frame.contentDocument?.getElementById('messageInput') as HTMLTextAreaElement | null
        if (!input) return
        input.value = text
        input.focus()
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await sendMessage()
      }
      bridge.onRefresh = () => refreshRooms(false)

      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getClaims()
        userIdRef.current = typeof data?.claims?.sub === 'string' ? data.claims.sub : null

        frameWindow()?.DEBAComms?.setChats?.([])
        frameWindow()?.DEBAComms?.renderMessages?.([], userIdRef.current)

        if (initialProduct) {
          roomIdRef.current = await createProductRoom()
        }

        await refreshRooms(true)

        if (roomIdRef.current) {
          await openLiveRoom(roomIdRef.current)
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'تعذر تحميل مركز المحادثات.')
      }

      if (pollingTimer == null) {
        pollingTimer = window.setInterval(async () => {
          await refreshRooms(false)
          if (roomIdRef.current) await loadMessages(roomIdRef.current)
        }, 5000)
      }
    }

    const onLoad = () => { void installBridge() }
    frame.addEventListener('load', onLoad)
    if (frame.contentDocument?.readyState === 'complete') void installBridge()

    return () => {
      disposed = true
      frame.removeEventListener('load', onLoad)
      if (pollingTimer != null) window.clearInterval(pollingTimer)
    }
  }, [initialProduct])

  return (
    <iframe
      ref={iframeRef}
      title="DEBA Comms"
      src={'/deba-comms.html' + (initialProduct ? '?product=' + encodeURIComponent(initialProduct) : '')}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        display: 'block',
        background: '#F5F6F8',
      }}
    />
  )
}
