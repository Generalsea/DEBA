'use client'

import { LoaderCircle, LogIn, Plus, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type HomeIdentity = {
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

export default function HomeAuthActions() {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading')
  const [identity, setIdentity] = useState<HomeIdentity | null>(null)

  useEffect(() => {
    let mounted = true

    const loadIdentity = async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('username,display_name,avatar_url')
        .eq('id', userId)
        .maybeSingle()

      if (!mounted || !data) return

      let avatarUrl = data.avatar_url as string | null
      if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
        avatarUrl = supabase.storage.from('deba-profile-media').getPublicUrl(avatarUrl).data.publicUrl
      }

      setIdentity({
        username: data.username,
        displayName: data.display_name,
        avatarUrl,
      })
    }

    const syncAuth = async () => {
      try {
        const { data } = await supabase.auth.getClaims()
        const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
        if (!mounted) return
        setState(userId ? 'authenticated' : 'anonymous')
        if (userId) void loadIdentity(userId)
      } catch {
        if (mounted) setState('anonymous')
      }
    }

    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<HomeIdentity>).detail
      if (detail) setIdentity(detail)
    }

    void syncAuth()
    window.addEventListener('deba:profile-updated', handleProfileUpdated)

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        setState('authenticated')
        const userId = session?.user?.id
        if (userId) void loadIdentity(userId)
      } else if (event === 'SIGNED_OUT') {
        setState('anonymous')
        setIdentity(null)
      }
    })

    return () => {
      mounted = false
      window.removeEventListener('deba:profile-updated', handleProfileUpdated)
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  if (state === 'loading') {
    return (
      <div className="header-actions">
        <span className="header-btn btn-outline deba-home-auth-loading">
          <LoaderCircle size={16} className="deba-spin" />
          جاري التحقق…
        </span>
      </div>
    )
  }

  if (state === 'authenticated') {
    return (
      <div className="header-actions">
        <Link href="/profile" className="header-btn btn-outline">
          <span className="deba-home-auth-avatar">
            {identity?.avatarUrl ? <img src={identity.avatarUrl} alt="" /> : <UserRound size={16} />}
          </span>
          <span className="deba-home-auth-copy">
            <small>أهلاً يا {identity?.username || identity?.displayName || 'بك'}</small>
            <strong>حسابي</strong>
          </span>
        </Link>
        <Link href="/sell" className="header-btn btn-primary">
          <Plus size={16} />
          أضف إعلانك
        </Link>
      </div>
    )
  }

  return (
    <div className="header-actions">
      <Link href="/login?next=%2Fprofile" className="header-btn btn-outline">
        <LogIn size={16} />
        تسجيل الدخول
      </Link>
      <Link href="/login?next=%2Fsell" className="header-btn btn-primary">
        <Plus size={16} />
        ابدأ البيع
      </Link>
    </div>
  )
}
