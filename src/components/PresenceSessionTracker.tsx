'use client'

import { useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function PresenceSessionTracker() {
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const stop = async () => {
      if (!channel) return
      await supabase.removeChannel(channel)
      channel = null
    }

    const start = async (userId: string | null) => {
      await stop()
      if (!mounted || !userId) return

      channel = supabase.channel('deba:presence:' + userId, {
        config: {
          private: true,
          presence: {
            key: userId,
          },
        },
      })

      channel.subscribe(async (status) => {
        if (!mounted || status !== 'SUBSCRIBED') return

        const tracked = await channel?.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        })

        if (tracked !== 'ok') {
          await stop()
        }
      })
    }

    void supabase.auth.getSession().then(({ data }) => {
      void start(data.session?.user?.id || null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void start(session?.user?.id || null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
      void stop()
    }
  }, [supabase])

  return null
}
