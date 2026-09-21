'use client'

import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  href: string | null
  read_at: string | null
  created_at: string
}

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function NotificationBell({
  enabled,
}: {
  enabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!enabled) return
    setLoading(true)
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' })
      if (!response.ok) return
      const payload = (await response.json()) as {
        notifications?: NotificationItem[]
      }
      setItems(payload.notifications || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [enabled])

  const unread = items.filter((item) => !item.read_at).length

  async function markRead(id: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read_at: new Date().toISOString() } : item,
      ),
    )
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    })
  }

  async function markAllRead() {
    setItems((current) =>
      current.map((item) =>
        item.read_at ? item : { ...item, read_at: new Date().toISOString() },
      ),
    )
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
  }

  if (!enabled) return null

  return (
    <div className="deba-notification-wrap">
      <button
        type="button"
        className="deba-notification-trigger"
        aria-label={unread ? 'الإشعارات غير المقروءة' : 'الإشعارات'}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value)
          if (!open) void load()
        }}
      >
        <Bell size={19} />
        {unread ? <em>{unread > 99 ? '99+' : unread}</em> : null}
      </button>

      {open ? (
        <div className="deba-notification-popover" role="dialog" aria-label="الإشعارات">
          <div className="deba-notification-head">
            <div>
              <strong>الإشعارات</strong>
              <span>{unread ? unread + ' غير مقروءة' : 'كل الإشعارات مقروءة'}</span>
            </div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={!unread}
              title="تمييز الكل كمقروء"
            >
              <CheckCheck size={16} />
            </button>
          </div>

          <div className="deba-notification-list">
            {loading && !items.length ? (
              <div className="deba-notification-empty">
                <Loader2 size={18} className="deba-spin" />
                جارٍ تحميل الإشعارات...
              </div>
            ) : items.length ? (
              items.slice(0, 12).map((item) => {
                const content = (
                  <>
                    <div className="deba-notification-dot" data-unread={!item.read_at} />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                      <small>{timeLabel(item.created_at)}</small>
                    </div>
                  </>
                )

                return item.href ? (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={'deba-notification-item' + (!item.read_at ? ' unread' : '')}
                    onClick={() => void markRead(item.id)}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    className={'deba-notification-item' + (!item.read_at ? ' unread' : '')}
                    onClick={() => void markRead(item.id)}
                  >
                    {content}
                  </button>
                )
              })
            ) : (
              <div className="deba-notification-empty">
                لا توجد إشعارات جديدة.
              </div>
            )}
          </div>

          <Link
            href="/profile?tab=orders"
            className="deba-notification-footer"
            onClick={() => setOpen(false)}
          >
            عرض حساب الطلبات
          </Link>
        </div>
      ) : null}
    </div>
  )
}
