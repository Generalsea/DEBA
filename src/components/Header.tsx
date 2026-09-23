'use client'

import {
  ChevronDown,
  ClipboardList,
  Grid2X2,
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
import MobileNavigation from '@/components/MobileNavigation'
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
  cartCount?: number
  negotiationCount?: number
  promotions?: HeaderPromo[]
}

type HeaderIdentity = {
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  city: string | null
  governorate: string | null
}

const RECENT_SEARCHES_KEY = 'deba-recent-searches'

function badge(value: number) {
  return value > 99 ? '99+' : new Intl.NumberFormat('ar-EG').format(Math.max(0, value))
}

function readRecentSearches() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 6)
      : []
  } catch {
    return []
  }
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
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
    setRecentSearches(readRecentSearches())
  }, [])

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
    authState === 'authenticated'
      ? '/profile?tab=favorites'
      : '/login?next=%2Fprofile%3Ftab%3Dfavorites'
  const sellHref =
    authState === 'authenticated'
      ? '/sell'
      : '/login?next=%2Fsell'
  const currentCartCount = cart.hydrated
    ? cart.items.reduce((sum, item) => sum + item.quantity, 0)
    : cartCount

  const categoryMatches = query.trim()
    ? categories.filter((item) =>
        item.nameAr.toLocaleLowerCase('ar-EG').includes(query.trim().toLocaleLowerCase('ar-EG')),
      ).slice(0, 5)
    : categories.slice(0, 5)

  function saveRecentSearch(value: string) {
    const cleaned = value.trim().slice(0, 80)
    if (!cleaned) return
    const next = [cleaned, ...recentSearches.filter((item) => item !== cleaned)].slice(0, 6)
    setRecentSearches(next)
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
    } catch {}
  }

  function submitSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    saveRecentSearch(query)
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (category !== 'all') params.set('category', category)
    window.location.assign('/' + (params.toString() ? '?' + params.toString() : ''))
  }

  function clearRecentSearches() {
    setRecentSearches([])
    try {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch {}
  }

  function useSuggestion(value: string) {
    setQuery(value)
    saveRecentSearch(value)
    setSearchOpen(false)
    const params = new URLSearchParams()
    params.set('q', value)
    if (category !== 'all') params.set('category', category)
    window.location.assign('/?' + params.toString())
  }

  return (
    <>
      <header className="deba-site-header">
        <div className="deba-utility-bar">
          <div className="deba-header-container deba-utility-inner">
            <span className="deba-utility-location">
              <MapPin size={14} aria-hidden="true" />
              <span>التسوق في مصر</span>
              {identity?.city || identity?.governorate ? (
                <strong>· {identity.city || identity.governorate}</strong>
              ) : null}
            </span>

            <div className="deba-utility-links">
              <Link href="/support">مركز المساعدة</Link>
              <Link href="/sell">بع على DEBA</Link>
              <Link href="/legal">السياسات</Link>
            </div>
          </div>
        </div>

        <div className="deba-header-main">
          <div className="deba-header-container deba-header-inner">
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
                <small>سوق مصري للبيع والشراء والتبادل</small>
              </span>
            </Link>

            <div className="deba-search-wrap">
              <form onSubmit={submitSearch} className="deba-search" role="search">
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
                  <ChevronDown size={15} aria-hidden="true" />
                </div>

                <input
                  name="q"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setSearchOpen(true)
                  }}
                  onFocus={() => setSearchOpen(true)}
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="ابحث عن منتج، بائع، أو قسم..."
                  aria-label="البحث في DEBA"
                  aria-expanded={searchOpen}
                  aria-controls="deba-search-panel"
                />

                {query ? (
                  <button
                    type="button"
                    className="deba-search-clear"
                    aria-label="مسح البحث"
                    onClick={() => setQuery('')}
                  >
                    <X size={16} />
                  </button>
                ) : null}

                <button type="submit" className="deba-search-submit" aria-label="بحث">
                  <Search size={20} strokeWidth={2.2} />
                </button>
              </form>

              {searchOpen ? (
                <div
                  id="deba-search-panel"
                  className="deba-search-panel"
                  role="dialog"
                  aria-label="اقتراحات البحث"
                >
                  <div className="deba-search-panel-head">
                    <strong>{query.trim() ? 'اكتشاف حسب بحثك' : 'ابدأ البحث'}</strong>
                    {recentSearches.length ? (
                      <button type="button" onClick={clearRecentSearches}>
                        مسح السجل
                      </button>
                    ) : null}
                  </div>

                  {recentSearches.length && !query.trim() ? (
                    <div className="deba-search-section">
                      <span>عمليات البحث الأخيرة</span>
                      <div className="deba-search-chips">
                        {recentSearches.map((item) => (
                          <button key={item} type="button" onClick={() => useSuggestion(item)}>
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {categoryMatches.length ? (
                    <div className="deba-search-section">
                      <span>الأقسام</span>
                      <div className="deba-search-suggestions">
                        {categoryMatches.map((item) => (
                          <Link
                            key={item.id}
                            href={'/?category=' + encodeURIComponent(item.slug)}
                            onClick={() => setSearchOpen(false)}
                          >
                            <Grid2X2 size={15} aria-hidden="true" />
                            <span>{item.nameAr}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {query.trim() ? (
                    <button
                      type="button"
                      className="deba-search-submit-suggestion"
                      onClick={() => submitSearch()}
                    >
                      <Search size={15} aria-hidden="true" />
                      البحث عن «{query.trim()}»
                    </button>
                  ) : (
                    <p className="deba-search-hint">
                      اكتب اسم المنتج أو الفئة، ثم اضغط Enter لعرض النتائج.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

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
                  <small>{authState === 'authenticated' ? 'أهلاً بك' : 'مرحبًا'}</small>
                  <strong>حسابي</strong>
                </span>
              </Link>

              <Link href="/profile?tab=orders" className="deba-action">
                <span className="deba-action-icon"><ClipboardList size={19} /></span>
                <span className="deba-action-text"><small>متابعة</small><strong>الطلبات</strong></span>
              </Link>

              <Link href={favoritesHref} className="deba-action">
                <span className="deba-action-icon">
                  <Heart size={19} />
                  {favoriteCount > 0 ? <em>{badge(favoriteCount)}</em> : null}
                </span>
                <span className="deba-action-text"><small>محفوظ</small><strong>المفضلة</strong></span>
              </Link>

              <Link href="/cart" className="deba-action">
                <span className="deba-action-icon">
                  <ShoppingCart size={19} />
                  {currentCartCount > 0 ? <em>{badge(currentCartCount)}</em> : null}
                </span>
                <span className="deba-action-text"><small>مشترياتك</small><strong>السلة</strong></span>
              </Link>

              <ThemeToggle />
              <NotificationBell enabled={authState === 'authenticated'} />

              <Link href={sellHref} className="deba-sell-button">
                <Plus size={17} />
                <span>أضف إعلانك</span>
              </Link>
            </nav>
          </div>
        </div>

        <div className={'deba-category-bar' + (menuOpen ? ' is-open' : '')}>
          <div className="deba-header-container deba-category-inner">
            <button
              type="button"
              className="deba-category-all"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="deba-mega-menu"
            >
              <Menu size={16} />
              <span>تصفح جميع الأقسام</span>
            </button>

            {categories.slice(0, 10).map((item) => (
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
                    <strong>استكشف السوق حسب القسم</strong>
                  </div>
                  <button type="button" onClick={() => setMenuOpen(false)} aria-label="إغلاق">
                    <X size={17} />
                  </button>
                </div>

                <div className="deba-mega-grid">
                  {categories.map((item) => (
                    <Link
                      key={item.id}
                      href={'/?category=' + encodeURIComponent(item.slug)}
                      onClick={() => setMenuOpen(false)}
                    >
                      <span>{item.nameAr}</span>
                      <small>استكشف القسم</small>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <HeaderReelsRail items={promotions} />
      <MobileNavigation
        categories={categories}
        favoriteCount={favoriteCount}
        authenticated={authState === 'authenticated'}
      />
    </>
  )
}
