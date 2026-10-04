'use client'

import { useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function PresenceSessionTracker() {
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const start = async () => {
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user?.id

      if (!mounted || !userId) return

      channel = supabase.channel('deba:presence', {
        config: {
          presence: {
            key: userId,
          },
        },
      })

      channel.subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        await channel?.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        })
      })
    }

    void start()

    return () => {
      mounted = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase])

  return null
}
