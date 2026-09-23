'use client'

import {
  ChevronDown,
  ClipboardList,
  Heart,
  LoaderCircle,
  MapPin,
  Menu,
  Plus,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import NotificationBell from '@/components/NotificationBell'
import ThemeToggle from '@/components/ThemeToggle'
import { createClient } from '@/utils/supabase/client'
import { useCartStore } from '@/lib/cart-store'
import HeaderReelsRail, { type HeaderPromo } from '@/components/HeaderReelsRail'

export type HeaderCategory = {
  id: string
  nameAr: string
  slug: string
}

type HeaderProps = {
  categories?: HeaderCategory[]
  initialSearch?: string
  initialCategory?: string
  favoriteCount?: number
  negotiationCount?: number
  cartCount?: number
  promotions?: HeaderPromo[]
}

type HeaderIdentity = {
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  city: string | null
  governorate: string | null
}

function badge(value: number) {
  return value > 99 ? '99+' : new Intl.NumberFormat('ar-EG').format(Math.max(0, value))
}

export default function Header({
  categories = [],
  initialSearch = '',
  initialCategory = 'all',
  favoriteCount = 0,
  cartCount = 0,
  promotions = [],
}: HeaderProps) {
  const [query, setQuery] = useState(initialSearch)
  const [category, setCategory] = useState(initialCategory || 'all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading')
  const [identity, setIdentity] = useState<HeaderIdentity | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const cart = useCartStore()

  useEffect(() => {
    setQuery(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setCategory(initialCategory || 'all')
  }, [initialCategory])

  useEffect(() => {
    let mounted = true

    const loadIdentity = async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('username,display_name,avatar_url,city,governorate')
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
        city: data.city,
        governorate: data.governorate,
      })
    }

    const syncAuth = async () => {
      try {
        const { data } = await supabase.auth.getClaims()
        const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
        if (!mounted) return

        setAuthState(userId ? 'authenticated' : 'anonymous')
        if (userId) void loadIdentity(userId)
        else setIdentity(null)
      } catch {
        if (mounted) {
          setAuthState('anonymous')
          setIdentity(null)
        }
      }
    }

    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<HeaderIdentity>).detail
      if (!detail) return
      setIdentity(detail)
    }

    void syncAuth()
    window.addEventListener('deba:profile-updated', handleProfileUpdated)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        setAuthState('authenticated')
        const userId = session?.user?.id
        if (userId) void loadIdentity(userId)
      } else if (event === 'SIGNED_OUT') {
        setAuthState('anonymous')
        setIdentity(null)
      }
    })

    return () => {
      mounted = false
      window.removeEventListener('deba:profile-updated', handleProfileUpdated)
      subscription.unsubscribe()
    }
  }, [supabase])

  const accountHref = authState === 'authenticated' ? '/profile' : '/login?next=%2Fprofile'
  const favoritesHref =
    authState === 'authenticated' ? '/profile?tab=favorites' : '/login?next=%2Fprofile%3Ftab%3Dfavorites'
  const cartHref = '/cart'
  const sellHref = authState === 'authenticated' ? '/sell' : '/login?next=%2Fsell'

  return (
    <>
      <header className="deba-site-header">
        <div className="deba-utility-bar">
          <div className="deba-utility-inner">
            <span className="deba-utility-location">
              <MapPin size={14} aria-hidden="true" />
              <span>التسوق في مصر</span>
              {identity?.city || identity?.governorate ? (
                <strong> · {identity.city || identity.governorate}</strong>
              ) : null}
            </span>
            <div className="deba-utility-links">
              <Link href="/support">مركز المساعدة</Link>
              <Link href="/sell">بع على DEBA</Link>
            </div>
          </div>
        </div>
        <div className="deba-header-main">
          <div className="deba-header-inner">
            <button
              type="button"
              className="deba-mobile-trigger"
              aria-label={menuOpen ? 'إغلاق قائمة الأقسام' : 'فتح قائمة الأقسام'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Link href="/" className="deba-brand" aria-label="DEBA - الرئيسية">
              <span className="deba-brand-mark">D</span>
              <span className="deba-brand-copy">
                <strong>DEBA</strong>
                <small>سوق التبادل المصري</small>
              </span>
            </Link>

            <form action="/" method="get" className="deba-search" role="search">
              <div className="deba-search-category">
                <select
                  name="category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  aria-label="اختيار قسم البحث"
                >
                  <option value="all">كل الأقسام</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.nameAr}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </div>

              <input
                name="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="search"
                inputMode="search"
                autoComplete="off"
                placeholder="ابحث عن سلعة، بائع، أو قسم..."
                aria-label="البحث في DEBA"
              />

              {query && (
                <button
                  type="button"
                  className="deba-search-clear"
                  aria-label="مسح البحث"
                  onClick={() => setQuery('')}
                >
                  <X size={16} />
                </button>
              )}

              <button type="submit" className="deba-search-submit" aria-label="بحث">
                <Search size={21} strokeWidth={2.2} />
              </button>
            </form>

            <nav className="deba-header-actions" aria-label="الحساب والتسوق">
              <Link href={accountHref} className="deba-action">
                <span className={'deba-action-icon' + (authState === 'authenticated' ? ' deba-account-avatar' : '')}>
                  {authState === 'loading' ? (
                    <LoaderCircle size={18} className="deba-spin" />
                  ) : identity?.avatarUrl ? (
                    <img src={identity.avatarUrl} alt="" />
                  ) : (
                    <UserRound size={19} />
                  )}
                </span>
                <span className="deba-action-text">
                  <small className="deba-account-greeting">
                    {authState === 'authenticated'
                      ? 'أهلاً يا ' + (identity?.username || identity?.displayName || 'بك')
                      : 'مرحبًا'}
                  </small>
                  <strong>حسابي</strong>
                </span>
              </Link>

              <Link href="/profile?tab=orders" className="deba-action">
                <span className="deba-action-icon">
                  <ClipboardList size={19} />
                </span>
                <span className="deba-action-text">
                  <small>متابعتك</small>
                  <strong>الطلبات</strong>
                </span>
              </Link>

              <Link href={favoritesHref} className="deba-action">
                <span className="deba-action-icon">
                  <Heart size={19} />
                  <em>{badge(favoriteCount)}</em>
                </span>
                <span className="deba-action-text">
                  <small>المختارة</small>
                  <strong>المفضلة</strong>
                </span>
              </Link>

              <Link href={cartHref} className="deba-action">
                <span className="deba-action-icon">
                  <ShoppingCart size={19} />
                  <em>{badge(cart.hydrated ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : cartCount)}</em>
                </span>
                <span className="deba-action-text">
                  <small>مشترياتك</small>
                  <strong>السلة</strong>
                </span>
              </Link>

              <ThemeToggle />
              <NotificationBell enabled={authState === 'authenticated'} />

              <Link href={sellHref} className="deba-sell-button">
                <Plus size={18} />
                <span>أضف إعلانك</span>
              </Link>
            </nav>
          </div>
        </div>

        <form action="/" method="get" className="deba-mobile-search" role="search">
          <div className="deba-mobile-search-wrap">
            <Search size={18} aria-hidden="true" />
            <input
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="ابحث في DEBA..."
              aria-label="البحث في DEBA"
            />
            <input type="hidden" name="category" value={category} />
            <button type="submit" aria-label="بحث">
              <Search size={18} aria-hidden="true" />
            </button>
          </div>
        </form>

        <div className={'deba-category-bar' + (menuOpen ? ' is-open' : '')}>
          <div className="deba-category-inner">
            <button
              type="button"
              className="deba-category-all"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="deba-mega-menu"
            >
              <Menu size={16} />
              تصفح جميع الأقسام
            </button>

            {categories.slice(0, 9).map((item) => (
              <Link
                key={item.id}
                href={'/?category=' + encodeURIComponent(item.slug)}
                className={initialCategory === item.slug ? 'is-active' : ''}
              >
                {item.nameAr}
              </Link>
            ))}

            {menuOpen ? (
              <div id="deba-mega-menu" className="deba-mega-menu" role="dialog" aria-label="كل أقسام DEBA">
                <div className="deba-mega-menu-head">
                  <div>
                    <span>DEBA DEPARTMENTS</span>
                    <strong>اختر القسم الذي تريد استكشافه</strong>
                  </div>
                  <Link href="/?category=all#featured" onClick={() => setMenuOpen(false)}>
                    كل المنتجات
                  </Link>
                </div>
                <div className="deba-mega-grid">
                  {categories.map((item) => (
                    <Link
                      key={item.id}
                      href={'/?category=' + encodeURIComponent(item.slug) + '#featured'}
                      onClick={() => setMenuOpen(false)}
                    >
                      <span>{item.nameAr}</span>
                      <small>تصفح المنتجات</small>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <HeaderReelsRail items={promotions} />
    </>
  )
}
