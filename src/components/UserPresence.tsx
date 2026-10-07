'use client'

import { useEffect, useMemo, useState } from 'react'
import { Circle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

type PresencePayload = {
  user_id?: string
  online_at?: string
}

type Props = {
  userId: string
  compact?: boolean
  label?: boolean
}

export default function UserPresence({ userId, compact = false, label = true }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<'online' | 'offline' | 'unavailable'>('unavailable')

  useEffect(() => {
    if (!userId) return

    let mounted = true
    const channel = supabase.channel('deba:presence:' + userId, { config: { private: true } })

    const sync = () => {
      if (!mounted) return
      const state = channel.presenceState<PresencePayload>()
      const entries = state[userId] || []
      setState(entries.length > 0 ? 'online' : 'offline')
    }

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe((status) => {
        if (!mounted) return
        if (status === 'SUBSCRIBED') {
          sync()
        } else {
          setState('unavailable')
        }
      })

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  const text =
    state === 'online'
      ? 'متصل الآن'
      : state === 'offline'
        ? 'غير متصل'
        : 'الحالة غير متاحة'

  return (
    <span
      className={
        'deba-presence-indicator ' +
        (compact ? 'is-compact ' : '') +
        (state === 'online' ? 'is-online' : state === 'offline' ? 'is-offline' : 'is-unavailable')
      }
      title={text}
      aria-label={label ? text : undefined}
    >
      <Circle size={compact ? 8 : 9} fill="currentColor" aria-hidden="true" />
      {label ? <span>{text}</span> : null}
    </span>
  )
}
