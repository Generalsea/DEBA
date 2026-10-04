'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'

export type AppNotification = {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  href: string | null
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
}

type NotificationsResponse = {
  notifications?: AppNotification[]
  unreadCount?: number
  error?: string
}

const supabase = createClient()

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const response = await fetch('/api/notifications', { cache: 'no-store' })
    const data = (await response.json()) as NotificationsResponse

    if (!response.ok) {
      throw new Error(data.error || 'تعذر تحميل الإشعارات.')
    }

    const nextNotifications = data.notifications || []
    setNotifications(nextNotifications)
    setUnreadCount(
      typeof data.unreadCount === 'number'
        ? data.unreadCount
        : nextNotifications.filter((item) => item.read_at === null).length,
    )
  }, [])

  const markRead = useCallback(async (id: string) => {
    const current = notifications.find((item) => item.id === id)
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      throw new Error(data.error || 'تعذر تحديث الإشعار.')
    }

    if (current?.read_at === null) {
      setNotifications((items) =>
        items.map((item) =>
          item.id === id ? { ...item, read_at: new Date().toISOString() } : item,
        ),
      )
      setUnreadCount((value) => Math.max(0, value - 1))
    }
  }, [notifications])

  const markAllRead = useCallback(async () => {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      throw new Error(data.error || 'تعذر تحديث الإشعارات.')
    }

    const timestamp = new Date().toISOString()
    setNotifications((items) =>
      items.map((item) =>
        item.read_at === null ? { ...item, read_at: timestamp } : item,
      ),
    )
    setUnreadCount(0)
  }, [])

  useEffect(() => {
    let mounted = true
    let channel: RealtimeChannel | null = null

    void refresh()
      .catch((error) => {
        if (mounted) {
          console.error('DEBA notifications refresh failed', error)
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!mounted || !user) return

      channel = supabase
        .channel('deba-notifications:' + user.id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: 'user_id=eq.' + user.id,
          },
          (payload) => {
            const incoming = payload.new as AppNotification

            setNotifications((current) => [
              incoming,
              ...current.filter((item) => item.id !== incoming.id),
            ].slice(0, 50))

            setUnreadCount((current) => current + 1)
            window.dispatchEvent(
              new CustomEvent('deba:notification', { detail: incoming }),
            )
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: 'user_id=eq.' + user.id,
          },
          () => {
            void refresh().catch((error) => {
              console.error('DEBA notification realtime refresh failed', error)
            })
          },
        )
        .subscribe((status, error) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('DEBA notifications Realtime channel failed', error || status)
          }
        })

      if (!mounted && channel) {
        await supabase.removeChannel(channel)
        channel = null
      }
    })()

    return () => {
      mounted = false
      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [refresh])

  return useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh,
      markRead,
      markAllRead,
    }),
    [loading, markAllRead, markRead, notifications, refresh, unreadCount],
  )
}
