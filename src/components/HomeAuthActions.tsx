'use client'

import { LoaderCircle, LogIn, Plus, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function HomeAuthActions() {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading')

  useEffect(() => {
    let mounted = true

    void supabase.auth.getClaims().then(({ data }) => {
      if (mounted) setState(data?.claims?.sub ? 'authenticated' : 'anonymous')
    }).catch(() => {
      if (mounted) setState('anonymous')
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        setState('authenticated')
      } else if (event === 'SIGNED_OUT') {
        setState('anonymous')
      }
    })

    return () => {
      mounted = false
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
          <UserRound size={16} />
          حسابي
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
