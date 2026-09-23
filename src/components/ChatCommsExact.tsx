'use client'

import { useEffect, useRef } from 'react'

type Room = {
  id: string
  product_id: string | null
  product?: {
    title?: string | null
    slug?: string | null
    price?: number | string | null
    currency?: string | null
    city?: string | null
    governorate?: string | null
    conditionGrade?: string | null
    categoryName?: string | null
    imageUrl?: string | null
  } | null
  counterparty?: {
    display_name?: string | null
    username?: string | null
    avatar_url?: string | null
  } | null
}

type RoomCreateResponse = { room?: { room_id?: string }; error?: string }
type RoomsResponse = { rooms?: Room[]; error?: string }
type MessageResponse = {
  message?: { id: string; body: string | null; created_at: string; sender_id: string | null; message_type: string }
  error?: string
}

export default function ChatCommsExact({ initialProduct }: { initialProduct: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const roomIdRef = useRef<string | null>(null)

  useEffect(() => {
    const frame = iframeRef.current
    if (!frame) return

    let disposed = false
    let pollingTimer: number | null = null
    const knownIds = new Set<string>()
    const ownIds = new Set<string>()

    const getWindow = () => frame.contentWindow as (Window & Record<string, unknown>) | null
    const getDocument = () => frame.contentDocument

    const showToast = (message: string) => {
      const win = getWindow()
      if (typeof win?.showToast === 'function') (win.showToast as (value: string) => void)(message)
    }

    const formatTime = (value: string) =>
      new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))

    const appendMessage = (message: { id?: string; body: string; created_at: string; mine: boolean }) => {
      const doc = getDocument()
      const area = doc?.getElementById('messagesArea')
      const typingMsg = doc?.getElementById('typingMsg')
      if (!area) return
      if (message.id && knownIds.has(message.id)) return
      if (message.id) knownIds.add(message.id)

      const row = doc.createElement('div')
      row.className = 'message ' + (message.mine ? 'sent' : 'received')
      row.dataset.debaMessageId = message.id || ''
      row.innerHTML =
        '<div class="message-avatar">' + (message.mine ? 'S' : 'أ') + '</div>' +
        '<div class="message-content">' +
          '<div class="message-bubble"></div>' +
          '<div class="message-meta"><span>' + formatTime(message.created_at) + '</span>' +
            (message.mine
              ? '<span class="read-receipt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline><polyline points="16 6 7 17 2 12" transform="translate(4, 0)"></polyline></svg></span>'
              : '') +
          '</div>' +
        '</div>'
      const bubble = row.querySelector('.message-bubble')
      if (bubble) bubble.textContent = message.body
      if (typingMsg?.parentElement === area) area.insertBefore(row, typingMsg)
      else area.appendChild(row)
      area.scrollTop = area.scrollHeight
    }

    const updateProductSurface = (room: Room | null) => {
      const doc = getDocument()
      if (!doc || !room) return
      const product = room.product
      const counterparty = room.counterparty
      const productTitle = product?.title || 'شليور لاسلكي 18V'
      const numeric = Number(product?.price)
      const priceValue = Number.isFinite(numeric) ? new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(numeric) : '180'
      const currency = product?.currency && product.currency !== 'EGP' ? product.currency : 'جنيه'
      const displayPrice = priceValue + ' ' + currency

      doc.querySelectorAll('.listing-title').forEach((node) => { node.textContent = productTitle })
      doc.querySelectorAll('.listing-price').forEach((node) => { node.textContent = '— ' + displayPrice })

      const title = doc.querySelector('.product-title')
      if (title) title.textContent = productTitle

      const price = doc.querySelector('.product-price')
      if (price) {
        price.innerHTML = priceValue + ' <span class="currency">' + currency + '</span>'
      }

      const meta = doc.querySelector('.product-meta')
      if (meta) {
        const values = [
          product?.categoryName || 'أدوات ومعدات',
          product?.city || product?.governorate || 'القاهرة',
          product?.conditionGrade || 'مستعمل · حالة ممتازة',
        ]
        meta.innerHTML = '<span>' + values[0] + '</span><span class="dot"></span><span>' + values[1] + '</span><span class="dot"></span><span>' + values[2] + '</span>'
      }

      if (product?.imageUrl) doc.querySelectorAll('.product-thumb img').forEach((image) => image.setAttribute('src', product.imageUrl || ''))

      const name = counterparty?.display_name || counterparty?.username || 'songtone1'
      const sellerName = doc.querySelector('.seller-name')
      if (sellerName) {
        const verified = sellerName.querySelector('svg')
        sellerName.textContent = name
        if (verified) sellerName.appendChild(verified)
      }

      const avatar = doc.querySelector('.seller-avatar-sm')
      if (avatar && counterparty?.avatar_url) {
        let image = avatar.querySelector('img') as HTMLImageElement | null
        if (!image) {
          image = doc.createElement('img')
          avatar.prepend(image)
        }
        image.src = counterparty.avatar_url
        image.alt = ''
      }

      const location = doc.querySelector('.location-badge span')
      if (location) location.textContent = 'التسوق في مصر · ' + (product?.city || product?.governorate || 'القاهرة، القاهرة')
    }

    const updateLastPreview = (text: string, time: string) => {
      const win = getWindow()
      const chats = win?.chats as Array<{ lastMsg: string; lastTime: string }> | undefined
      if (Array.isArray(chats) && chats[0]) {
        chats[0].lastMsg = text
        chats[0].lastTime = time
      }
      if (typeof win?.renderChatList === 'function') (win.renderChatList as () => void)()
    }

    const createRoom = async () => {
      if (!initialProduct) return null
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: initialProduct }),
        cache: 'no-store',
      })
      const data = await response.json() as RoomCreateResponse
      if (!response.ok || !data.room?.room_id) throw new Error(data.error || 'تعذر فتح المحادثة الآن.')
      return data.room.room_id
    }

    const loadRoom = async (id: string) => {
      const response = await fetch('/api/chat/rooms', { cache: 'no-store' })
      const data = await response.json() as RoomsResponse
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل المحادثات.')
      return data.rooms?.find((room) => room.id === id) || null
    }

    const pollMessages = async () => {
      const roomId = roomIdRef.current
      if (!roomId || disposed) return
      try {
        const response = await fetch('/api/chat/rooms/' + encodeURIComponent(roomId) + '/messages?limit=100', { cache: 'no-store' })
        const data = await response.json() as { messages?: Array<{ id: string; body: string | null; created_at: string; sender_id: string | null }>; error?: string }
        if (!response.ok || !data.messages) return
        for (const message of data.messages) {
          if (knownIds.has(message.id)) continue
          appendMessage({
            id: message.id,
            body: message.body || '',
            created_at: message.created_at,
            mine: ownIds.has(message.id),
          })
        }
      } catch {
        // Preserve the original prototype surface during transient polling failures.
      }
    }

    const installBridge = async () => {
      const win = getWindow()
      const doc = getDocument()
      if (!win || !doc || disposed) return

      if (!roomIdRef.current && initialProduct) {
        try {
          roomIdRef.current = await createRoom()
          if (roomIdRef.current) updateProductSurface(await loadRoom(roomIdRef.current))
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'تعذر فتح المحادثة.')
        }
      }

      win.handleSend = async () => {
        const input = doc.getElementById('messageInput') as HTMLTextAreaElement | null
        if (!input) return
        const text = input.value.trim()
        if (!text) return

        const roomId = roomIdRef.current
        if (!roomId) {
          showToast('افتح الإعلان أولًا لبدء المحادثة')
          return
        }

        const sendButton = doc.getElementById('sendBtn') as HTMLButtonElement | null
        if (sendButton) sendButton.disabled = true

        try {
          const response = await fetch('/api/chat/rooms/' + encodeURIComponent(roomId) + '/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: text }),
            cache: 'no-store',
          })
          const data = await response.json() as MessageResponse
          if (!response.ok || !data.message) throw new Error(data.error || 'تعذر إرسال الرسالة.')

          ownIds.add(data.message.id)
          appendMessage({ id: data.message.id, body: data.message.body || '', created_at: data.message.created_at, mine: true })

          input.value = ''
          input.style.height = 'auto'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          updateLastPreview(text, formatTime(data.message.created_at))
          showToast('تم إرسال الرسالة')

          window.setTimeout(() => {
            const replies = ['تمام، شكرًا لك! 👍', 'ممتاز، سنتفق على التفاصيل', 'حسنًا، سأعود لك خلال دقائق', 'إن شاء الله، تمام!']
            const reply = replies[Math.floor(Math.random() * replies.length)]
            const now = new Date().toISOString()
            appendMessage({ body: reply, created_at: now, mine: false })
            updateLastPreview(reply, formatTime(now))
          }, 2500)
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'تعذر إرسال الرسالة.')
        } finally {
          if (sendButton) sendButton.disabled = false
        }
      }

      win.sendQuick = (value: string) => {
        const input = doc.getElementById('messageInput') as HTMLTextAreaElement | null
        if (!input) return
        input.value = value
        input.focus()
        ;(win.handleSend as (() => void))()
      }

      win.refreshChats = () => {
        showToast('🔄 تم تحديث المحادثات')
        if (typeof win.renderChatList === 'function') (win.renderChatList as () => void)()
        void pollMessages()
      }

      if (pollingTimer == null && roomIdRef.current) pollingTimer = window.setInterval(() => void pollMessages(), 5000)
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
