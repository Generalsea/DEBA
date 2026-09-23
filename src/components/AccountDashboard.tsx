'use client'

import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MapPin,
  MessageCircle,
  Moon,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  UserRound,
  Sun,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import EgyptLocationPicker from '@/components/EgyptLocationPicker'
import DebaLogo from '@/components/DebaLogo'
import type { ProfileAccountData } from '@/components/ProfileDashboard'

type NotificationRow = NonNullable<ProfileAccountData['notifications']>[number]

type Props = {
  account: ProfileAccountData
  initialSection?: string
}

type SectionId = 'dashboard' | 'listings' | 'favorites' | 'messages' | 'notifications' | 'profile' | 'settings' | 'help'

const TITLES: Record<SectionId, { title: string; subtitle: string }> = {
  dashboard: { title: 'نظرة عامة', subtitle: 'مرحبًا بك، إليك ملخص نشاطك اليوم' },
  listings: { title: 'إعلاناتي', subtitle: 'إدارة إعلاناتك ومتابعة أدائها' },
  favorites: { title: 'المفضلة', subtitle: 'الإعلانات التي حفظتها لاحقًا' },
  messages: { title: 'الرسائل', subtitle: 'تواصل مع البائعين والمشترين داخل DEBA' },
  notifications: { title: 'الإشعارات', subtitle: 'آخر التحديثات والنشاطات في حسابك' },
  profile: { title: 'الملف الشخصي', subtitle: 'معلومات حسابك الشخصي وموقعك في مصر' },
  settings: { title: 'الإعدادات', subtitle: 'تخصيص تجربة استخدامك' },
  help: { title: 'المساعدة والدعم', subtitle: 'نحن هنا لمساعدتك' },
}

function safeSection(value: string | undefined): SectionId {
  return Object.prototype.hasOwnProperty.call(TITLES, value || '') ? value as SectionId : 'dashboard'
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value) + ' ' + (currency === 'EGP' ? 'جنيه' : currency)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return 'الآن'
  if (minutes < 60) return 'منذ ' + minutes + ' دقيقة'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return 'منذ ' + hours + ' ساعة'
  const days = Math.floor(hours / 24)
  return 'منذ ' + days + ' يوم'
}

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'D'
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Bell; label: string; value: string | number; tone: string }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <div className={'stat-icon ' + tone}><Icon size={21} /></div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function statusLabel(status: string, moderation: string) {
  if (moderation === 'pending') return { text: 'قيد المراجعة', cls: 'pending' }
  if (status === 'draft') return { text: 'مسودة', cls: 'draft' }
  if (status === 'published') return { text: 'نشط', cls: 'active' }
  return { text: status || 'غير معروف', cls: 'sold' }
}

function DashboardMessages() {
  type Room = {
    id: string
    unreadCount?: number
    updated_at: string
    product: { id: string; title: string; slug: string; price: number; currency: string } | null
    counterparty: { id: string; display_name: string; username: string | null; avatar_url: string | null } | null
  }
  type Message = {
    id: string
    sender_id: string | null
    body: string | null
    created_at: string
  }

  const [rooms, setRooms] = useState<Room[]>([])
  const [roomId, setRoomId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function loadRooms() {
    const response = await fetch('/api/chat/rooms', { cache: 'no-store' })
    const data = await response.json() as { rooms?: Room[]; error?: string }
    if (!response.ok) throw new Error(data.error || 'تعذر تحميل المحادثات.')
    setRooms(data.rooms || [])
    return data.rooms || []
  }

  async function loadMessages(nextRoomId: string) {
    setRoomId(nextRoomId)
    const response = await fetch('/api/chat/rooms/' + encodeURIComponent(nextRoomId) + '/messages?limit=100', { cache: 'no-store' })
    const data = await response.json() as { messages?: Message[]; error?: string }
    if (!response.ok) throw new Error(data.error || 'تعذر تحميل الرسائل.')
    setMessages(data.messages || [])
  }

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getClaims()
        const currentId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
        if (active) setUserId(currentId)
        const loaded = await loadRooms()
        if (active && loaded[0]) await loadMessages(loaded[0].id)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'تعذر تحميل المحادثات.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!roomId) return
    const interval = window.setInterval(() => {
      void loadMessages(roomId).catch((e) => setError(e instanceof Error ? e.message : 'تعذر تحديث الرسائل.'))
    }, 8000)
    return () => window.clearInterval(interval)
  }, [roomId])

  async function send() {
    if (!roomId || !draft.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/chat/rooms/' + encodeURIComponent(roomId) + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft.trim() }),
      })
      const data = await response.json() as { message?: Message; error?: string }
      if (!response.ok || !data.message) throw new Error(data.error || 'تعذر إرسال الرسالة.')
      setMessages((current) => [...current, data.message as Message])
      setDraft('')
      void loadRooms()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إرسال الرسالة.')
    } finally {
      setSending(false)
    }
  }

  const selected = rooms.find((room) => room.id === roomId) || null

  return (
    <div className="chat-container dashboard-chat-container">
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div className="chat-sidebar-title">الرسائل</div>
          <div className="chat-search">
            <Search size={16} />
            <input placeholder="ابحث في المحادثات..." aria-label="ابحث في المحادثات" />
          </div>
        </div>
        <div className="chat-tabs">
          <div className="chat-tab active">الكل</div>
          <div className="chat-tab">غير مقروءة</div>
          <div className="chat-tab">مؤرشفة</div>
        </div>
        <div className="chat-list">
          {loading ? <div className="empty-state">جارٍ تحميل المحادثات...</div> : null}
          {!loading && !rooms.length ? (
            <div className="empty-state">
              <div className="empty-state-icon"><MessageCircle size={30} /></div>
              <h3>لا توجد محادثات بعد</h3>
              <p>افتح «تواصل مع البائع» من أي إعلان متاح لبدء محادثة حقيقية.</p>
            </div>
          ) : null}
          {rooms.map((room) => {
            const name = room.counterparty?.display_name || 'عضو DEBA'
            return (
              <button
                key={room.id}
                type="button"
                className={'chat-item' + (room.id === roomId ? ' active' : '') + ((room.unreadCount || 0) > 0 ? ' unread' : '')}
                onClick={() => void loadMessages(room.id).catch((e) => setError(e instanceof Error ? e.message : 'تعذر تحميل الرسائل.'))}
              >
                <span className={'chat-avatar' + ((room.unreadCount || 0) > 0 ? ' online' : '')}>
                  {room.counterparty?.avatar_url ? <img src={room.counterparty.avatar_url} alt="" /> : initials(name)}
                </span>
                <span className="chat-item-info">
                  <span className="chat-item-header">
                    <span className="chat-item-name">{name}</span>
                    <span className="chat-item-time">{relativeTime(room.updated_at)}</span>
                  </span>
                  <span className="chat-item-preview">{room.product?.title || 'محادثة DEBA'}</span>
                </span>
                {(room.unreadCount || 0) > 0 ? <span className="unread-badge">{room.unreadCount}</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="chat-main">
        {selected ? (
          <>
            <div className="chat-main-header">
              <div className="chat-main-avatar">
                {selected.counterparty?.avatar_url ? <img src={selected.counterparty.avatar_url} alt="" /> : initials(selected.counterparty?.display_name || 'D')}
              </div>
              <div className="chat-main-info">
                <div className="chat-main-name">{selected.counterparty?.display_name || 'عضو DEBA'}</div>
                <div className="chat-main-status"><span className="status-dot" /> محادثة نشطة</div>
              </div>
              <div className="chat-main-actions">
                <Link className="icon-btn" href={'/chat?room=' + encodeURIComponent(selected.id)} title="فتح مركز المحادثات">
                  <ExternalLink size={18} />
                </Link>
              </div>
            </div>
            <div className="chat-messages">
              <div className="message-date-divider">المحادثة الحالية</div>
              {messages.map((message) => {
                const mine = Boolean(userId && message.sender_id === userId)
                return (
                  <div key={message.id} className={'message ' + (mine ? 'received' : 'sent')}>
                    <div className="message-avatar">{mine ? initials('أنا') : initials(selected.counterparty?.display_name || 'D')}</div>
                    <div className="message-content">
                      <div className="message-bubble">{message.body}</div>
                      <div className="message-time">{new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at))}</div>
                    </div>
                  </div>
                )
              })}
              {!messages.length ? <div className="empty-state">ابدأ المحادثة بإرسال أول رسالة.</div> : null}
            </div>
            {error ? <div className="deba-account-error">{error}</div> : null}
            <div className="chat-input-container">
              <form className="chat-input-wrapper" onSubmit={(event) => { event.preventDefault(); void send() }}>
                <textarea className="chat-input" rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="اكتب رسالتك هنا..." maxLength={4000} />
                <button className="chat-send-btn" type="submit" disabled={sending || !draft.trim()} title="إرسال">
                  <MessageCircle size={19} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><MessageCircle size={35} /></div>
            <h3>التواصل داخل DEBA</h3>
            <p>محادثاتك الحقيقية تظهر هنا بمجرد بدء التواصل مع بائع أو مشترٍ.</p>
            <Link className="btn btn-primary" href="/"><Search size={16} /> تصفح الإعلانات</Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AccountDashboard({ account, initialSection }: Props) {
  const [active, setActive] = useState<SectionId>(safeSection(initialSection))
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [profile, setProfile] = useState(() => ({
    displayName: account.profile.displayName,
    username: account.profile.username || '',
    phone: account.profile.phone || '',
    governorate: account.profile.governorate || '',
    city: account.profile.city || '',
    district: account.profile.district || '',
    addressLine1: account.profile.addressLine1 || '',
    addressLine2: account.profile.addressLine2 || '',
    postalCode: account.profile.postalCode || '',
    bio: account.profile.bio || '',
    isPublic: account.profile.isPublic,
  }))
  const [saving, setSaving] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [status, setStatus] = useState('')
  const themeToggleRef = useRef<HTMLButtonElement | null>(null)

  const notifications = account.notifications || []
  const unreadNotifications = notifications.filter((item) => !item.readAt).length
  const activeListings = account.stats.activeSellerProducts
  const favorites = account.stats.favorites
  const unreadMessages = account.unreadMessages || 0

  useEffect(() => {
    const saved = localStorage.getItem('deba-theme')
    const next = saved === 'dark' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.dataset.theme = next
    document.documentElement.style.colorScheme = next
  }, [])

  function switchSection(next: SectionId) {
    setActive(next)
    setStatus('')
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('deba-theme', next)
    document.documentElement.dataset.theme = next
    document.documentElement.style.colorScheme = next
  }

  async function markAllNotificationsRead() {
    const supabase = createClient()
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    setStatus(error ? 'تعذر تحديث الإشعارات.' : 'تم تحديد كل الإشعارات كمقروءة.')
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setStatus('')
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: profile.displayName,
          username: profile.username || null,
          phone: profile.phone || null,
          governorate: profile.governorate || null,
          city: profile.city || null,
          district: profile.district || null,
          addressLine1: profile.addressLine1 || null,
          addressLine2: profile.addressLine2 || null,
          postalCode: profile.postalCode || null,
          bio: profile.bio || null,
          isPublic: profile.isPublic,
          accountType: account.profile.accountType,
        }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر حفظ التغييرات.')
      setStatus('تم حفظ بيانات الحساب بنجاح.')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'تعذر حفظ التغييرات.')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setStatus('كلمة المرور يجب ألا تقل عن 8 أحرف.')
      return
    }
    if (password !== passwordConfirm) {
      setStatus('تأكيد كلمة المرور غير مطابق.')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setStatus(error ? error.message : 'تم تحديث كلمة المرور.')
    if (!error) {
      setPassword('')
      setPasswordConfirm('')
    }
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const title = TITLES[active]

  return (
    <div className="deba-account-dashboard" dir="rtl">
      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <DebaLogo href="/" compact />
              <span className="badge">لوحة التحكم</span>
            </div>
            <div className="user-profile-card">
              <div className="user-avatar">{account.profile.avatarUrl ? <img src={account.profile.avatarUrl} alt="" /> : initials(account.profile.displayName)}</div>
              <div className="user-info">
                <div className="user-name">{account.profile.displayName}</div>
                <div className="user-email">{account.email || account.profile.username || 'حساب DEBA'}</div>
                <div className="user-status"><span className="status-dot" /> متصل الآن</div>
              </div>
            </div>
          </div>

          <nav>
            <div className="nav-section">
              <div className="nav-section-title">الرئيسية</div>
              <button type="button" className={'nav-item' + (active === 'dashboard' ? ' active' : '')} onClick={() => switchSection('dashboard')}><LayoutDashboard /><span>نظرة عامة</span></button>
              <button type="button" className={'nav-item' + (active === 'listings' ? ' active' : '')} onClick={() => switchSection('listings')}><Tag /><span>إعلاناتي</span>{activeListings > 0 ? <span className="nav-badge">{activeListings}</span> : null}</button>
              <button type="button" className={'nav-item' + (active === 'favorites' ? ' active' : '')} onClick={() => switchSection('favorites')}><Heart /><span>المفضلة</span>{favorites > 0 ? <span className="nav-badge">{favorites}</span> : null}</button>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">التواصل</div>
              <button type="button" className={'nav-item' + (active === 'messages' ? ' active' : '')} onClick={() => switchSection('messages')}><MessageCircle /><span>الرسائل</span>{unreadMessages > 0 ? <span className="nav-badge warning">{unreadMessages}</span> : null}</button>
              <button type="button" className={'nav-item' + (active === 'notifications' ? ' active' : '')} onClick={() => switchSection('notifications')}><Bell /><span>الإشعارات</span>{unreadNotifications > 0 ? <span className="nav-badge">{unreadNotifications}</span> : null}</button>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">الحساب</div>
              <button type="button" className={'nav-item' + (active === 'profile' ? ' active' : '')} onClick={() => switchSection('profile')}><UserRound /><span>الملف الشخصي</span></button>
              <button type="button" className={'nav-item' + (active === 'settings' ? ' active' : '')} onClick={() => switchSection('settings')}><Settings /><span>الإعدادات</span></button>
              <button type="button" className={'nav-item' + (active === 'help' ? ' active' : '')} onClick={() => switchSection('help')}><ShieldCheck /><span>المساعدة والدعم</span></button>
            </div>

            <div className="nav-section dashboard-signout">
              <button type="button" className="nav-item danger-text" onClick={() => void signOut()}><LogOut /><span>تسجيل الخروج</span></button>
            </div>
          </nav>
        </aside>

        <main className="main-content">
          <div className="top-bar">
            <div>
              <h1 className="page-title">{title.title}</h1>
              <p className="page-subtitle">{title.subtitle}</p>
            </div>
            <div className="top-actions">
              <Link className="icon-btn" href="/"><Search size={20} /></Link>
              <button type="button" className="icon-btn" title="الإشعارات" onClick={() => switchSection('notifications')}>
                <Bell size={20} />
                {unreadNotifications > 0 ? <span className="notification-dot" /> : null}
              </button>
              <button ref={themeToggleRef} type="button" className="theme-toggle" title="تبديل الوضع" onClick={toggleTheme}>
                {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
            </div>
          </div>

          {status ? <div className="deba-account-notice">{status}</div> : null}

          <section className={'content-section ' + (active === 'dashboard' ? 'active' : '')}>
            <div className="stats-grid">
              <StatCard icon={Package} tone="primary" value={activeListings} label="إعلاناتي النشطة" />
              <StatCard icon={MessageCircle} tone="success" value={unreadMessages} label="رسائل جديدة" />
              <StatCard icon={Heart} tone="warning" value={favorites} label="إعلانات مفضلة" />
              <StatCard icon={Eye} tone="info" value="—" label="مشاهدة إعلاناتي" />
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">إعلاناتي الأخيرة</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => switchSection('listings')}>عرض الكل</button>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="dashboard-table-scroll">
                  <table className="listings-table">
                    <thead><tr><th>الإعلان</th><th>الحالة</th><th>السعر</th><th>الكمية</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
                    <tbody>
                      {account.sellerProducts.slice(0, 5).map((item) => {
                        const state = statusLabel(item.status, item.moderationStatus)
                        return (
                          <tr key={item.id}>
                            <td><div className="listing-item"><div className="listing-thumb">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}</div><div className="listing-details"><h4>{item.title}</h4><p>{item.conditionGrade || 'حالة غير محددة'}</p></div></div></td>
                            <td><span className={'status-badge ' + state.cls}><span className="status-dot-small" />{state.text}</span></td>
                            <td><strong>{formatMoney(item.price, item.currency)}</strong></td>
                            <td>{item.quantity}</td>
                            <td>{formatDate(item.createdAt)}</td>
                            <td><Link className="btn btn-ghost btn-sm" href={'/products/' + encodeURIComponent(item.slug)}>عرض</Link></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {!account.sellerProducts.length ? <div className="card-body"><div className="empty-state"><div className="empty-state-icon"><Package size={32} /></div><h3>لا توجد إعلانات</h3><p>ابدأ بإضافة أول إعلان حقيقي على DEBA.</p><Link className="btn btn-primary" href="/sell"><Plus size={16} /> إعلان جديد</Link></div></div> : null}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3 className="card-title">النشاط الأخير</h3><button type="button" className="btn btn-ghost btn-sm" onClick={() => switchSection('notifications')}>كل الإشعارات</button></div>
              <div className="card-body" style={{ padding: 0 }}>
                {notifications.slice(0, 6).map((item) => (
                  <div key={item.id} className={'notification-item' + (!item.readAt ? ' unread' : '')}>
                    <div className={'notification-icon ' + (item.type === 'message' ? 'message' : item.type === 'listing' ? 'listing' : 'system')}>
                      {item.type === 'message' ? '💬' : item.type === 'listing' ? '📦' : '🔔'}
                    </div>
                    <div className="notification-content">
                      <div className="notification-title">{item.title}</div>
                      <div className="notification-text">{item.body}</div>
                      <div className="notification-time">{relativeTime(item.createdAt)}</div>
                    </div>
                  </div>
                ))}
                {!notifications.length ? <div className="card-body"><div className="empty-state"><div className="empty-state-icon"><Bell size={30} /></div><h3>لا توجد إشعارات</h3><p>ستظهر هنا تحديثات الحساب والطلبات والمحادثات عند حدوثها.</p></div></div> : null}
              </div>
            </div>
          </section>

          <section className={'content-section ' + (active === 'listings' ? 'active' : '')}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">إعلاناتي ({account.stats.sellerProducts})</h3>
                <Link className="btn btn-primary btn-sm" href="/sell"><Plus size={16} /> إعلان جديد</Link>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="dashboard-table-scroll">
                  <table className="listings-table">
                    <thead><tr><th>الإعلان</th><th>السعر</th><th>الحالة</th><th>الكمية</th><th>النشر</th><th>إجراءات</th></tr></thead>
                    <tbody>
                      {account.sellerProducts.map((item) => {
                        const state = statusLabel(item.status, item.moderationStatus)
                        return <tr key={item.id}><td><div className="listing-item"><div className="listing-thumb">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}</div><div className="listing-details"><h4>{item.title}</h4><p>{item.conditionGrade || 'حالة غير محددة'}</p></div></div></td><td><strong>{formatMoney(item.price,item.currency)}</strong></td><td><span className={'status-badge ' + state.cls}><span className="status-dot-small" />{state.text}</span></td><td>{item.quantity}</td><td>{formatDate(item.createdAt)}</td><td><Link href={'/products/' + encodeURIComponent(item.slug)} className="btn btn-ghost btn-sm">عرض</Link></td></tr>
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section className={'content-section ' + (active === 'favorites' ? 'active' : '')}>
            <div className="card">
              <div className="card-header"><h3 className="card-title">إعلاناتي المفضلة ({favorites})</h3></div>
              <div className="card-body">
                <div className="favorites-grid">
                  {account.favorites.map((item) => (
                    <article className="favorite-card" key={item.productId}>
                      <div className="favorite-image" />
                      <div className="favorite-info">
                        <h4 className="favorite-title">{item.title}</h4>
                        <div className="favorite-price">{formatMoney(item.price, item.currency)}</div>
                        <div className="favorite-meta">{item.conditionGrade || 'حالة غير محددة'} • {relativeTime(item.createdAt)}</div>
                        <div className="favorite-actions"><Link className="btn btn-primary btn-sm" href={'/products/' + encodeURIComponent(item.slug)}>عرض الإعلان</Link><Link className="btn btn-secondary btn-sm" href={'/chat?product=' + encodeURIComponent(item.productId)}>تواصل</Link></div>
                      </div>
                    </article>
                  ))}
                </div>
                {!account.favorites.length ? <div className="empty-state"><div className="empty-state-icon"><Heart size={32} /></div><h3>المفضلة فارغة</h3><p>اضغط على القلب من أي إعلان لحفظه هنا.</p><Link className="btn btn-primary" href="/">استكشف السوق</Link></div> : null}
              </div>
            </div>
          </section>

          <section className={'content-section ' + (active === 'messages' ? 'active' : '')}>
            <DashboardMessages />
          </section>

          <section className={'content-section ' + (active === 'notifications' ? 'active' : '')}>
            <div className="card">
              <div className="card-header"><h3 className="card-title">الإشعارات ({notifications.length})</h3><button type="button" className="btn btn-ghost btn-sm" onClick={() => void markAllNotificationsRead()}>تحديد الكل كمقروء</button></div>
              <div className="card-body" style={{ padding: 0 }}>
                {notifications.map((item: NotificationRow) => (
                  <div key={item.id} className={'notification-item' + (!item.readAt ? ' unread' : '')}>
                    <div className={'notification-icon ' + (item.type === 'message' ? 'message' : item.type === 'listing' ? 'listing' : 'system')}>
                      {item.type === 'message' ? '💬' : item.type === 'listing' ? '📦' : '🔔'}
                    </div>
                    <div className="notification-content">
                      {item.href ? <Link href={item.href} className="notification-title">{item.title}</Link> : <div className="notification-title">{item.title}</div>}
                      <div className="notification-text">{item.body}</div>
                      <div className="notification-time">{relativeTime(item.createdAt)}</div>
                    </div>
                  </div>
                ))}
                {!notifications.length ? <div className="empty-state"><div className="empty-state-icon"><Bell size={30} /></div><h3>لا توجد إشعارات بعد</h3><p>ستظهر التحديثات المهمة هنا.</p></div> : null}
              </div>
            </div>
          </section>

          <section className={'content-section ' + (active === 'profile' ? 'active' : '')}>
            <div className="profile-header">
              <div className="profile-avatar-large">{account.profile.avatarUrl ? <img src={account.profile.avatarUrl} alt="" /> : initials(account.profile.displayName)}<div className="edit-avatar" title="تعديل الصورة"><Pencil size={15} /></div></div>
              <div className="profile-info">
                <h2>{account.profile.displayName}</h2>
                <p>{account.email || account.profile.username || 'حساب DEBA'}</p>
                <div className="profile-meta">
                  <div className="profile-meta-item"><MapPin size={16} /><span>{[account.profile.city, account.profile.governorate].filter(Boolean).join('، ') || 'الموقع غير مكتمل'}</span></div>
                  <div className="profile-meta-item"><MessageCircle size={16} /><span>{unreadMessages} رسائل غير مقروءة</span></div>
                  <div className="profile-meta-item"><Package size={16} /><span>عضو منذ {formatDate(account.profile.createdAt)}</span></div>
                </div>
              </div>
              <div className="profile-stats">
                <div className="profile-stat"><div className="profile-stat-value">{account.stats.sellerProducts}</div><div className="profile-stat-label">إعلانات</div></div>
                <div className="profile-stat"><div className="profile-stat-value">—</div><div className="profile-stat-label">التقييم</div></div>
                <div className="profile-stat"><div className="profile-stat-value">{account.stats.sellerOrders}</div><div className="profile-stat-label">طلبات</div></div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3 className="card-title">معلومات الحساب</h3></div>
              <div className="card-body">
                <form onSubmit={saveProfile}>
                  <div className="form-grid">
                    <div className="form-group"><label className="form-label">الاسم الظاهر</label><input className="form-input" value={profile.displayName} onChange={(e) => setProfile((s) => ({...s,displayName:e.target.value}))} required /></div>
                    <div className="form-group"><label className="form-label">اسم المستخدم</label><input className="form-input" value={profile.username} onChange={(e) => setProfile((s) => ({...s,username:e.target.value}))} maxLength={40} /></div>
                    <div className="form-group"><label className="form-label">البريد الإلكتروني</label><input className="form-input" value={account.email || ''} readOnly /></div>
                    <div className="form-group"><label className="form-label">رقم الهاتف</label><input className="form-input" value={profile.phone} onChange={(e) => setProfile((s) => ({...s,phone:e.target.value}))} inputMode="tel" /></div>
                    <div className="form-group full-width"><EgyptLocationPicker governorate={profile.governorate} city={profile.city} district={profile.district} onGovernorateChange={(value) => setProfile((s) => ({...s,governorate:value}))} onCityChange={(value) => setProfile((s) => ({...s,city:value}))} onDistrictChange={(value) => setProfile((s) => ({...s,district:value}))} required /></div>
                    <div className="form-group"><label className="form-label">العنوان الأساسي</label><input className="form-input" value={profile.addressLine1} onChange={(e) => setProfile((s) => ({...s,addressLine1:e.target.value}))} maxLength={180} /></div>
                    <div className="form-group"><label className="form-label">تفاصيل إضافية للعنوان</label><input className="form-input" value={profile.addressLine2} onChange={(e) => setProfile((s) => ({...s,addressLine2:e.target.value}))} maxLength={180} /></div>
                    <div className="form-group"><label className="form-label">الرمز البريدي</label><input className="form-input" value={profile.postalCode} onChange={(e) => setProfile((s) => ({...s,postalCode:e.target.value}))} maxLength={20} /></div>
                    <div className="form-group full-width"><label className="form-label">نبذة عنك</label><textarea className="form-textarea" value={profile.bio} onChange={(e) => setProfile((s) => ({...s,bio:e.target.value}))} maxLength={500} placeholder="اكتب نبذة قصيرة عنك..." /><div className="form-hint">ستظهر هذه النبذة في ملفك الشخصي العام.</div></div>
                  </div>
                  <label className="profile-public-toggle"><input type="checkbox" checked={profile.isPublic} onChange={(e) => setProfile((s) => ({...s,isPublic:e.target.checked}))} /><span>إظهار الملف العام</span></label>
                  <div style={{ marginTop: 16 }}><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}<CheckCircle2 size={16} /></button></div>
                </form>
              </div>
            </div>
          </section>

          <section className={'content-section ' + (active === 'settings' ? 'active' : '')}>
            <div className="card">
              <div className="card-header"><h3 className="card-title">إعدادات الحساب</h3></div>
              <div className="card-body">
                <div className="form-group"><label className="form-label">اللغة</label><select className="form-select" defaultValue="ar"><option value="ar">العربية</option><option value="en">English</option></select></div>
                <div className="form-group"><label className="form-label">المنطقة الزمنية</label><select className="form-select" defaultValue="cairo"><option value="cairo">(UTC+02:00) القاهرة</option><option value="riyadh">(UTC+03:00) الرياض</option></select></div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3 className="card-title">إعدادات الإشعارات</h3></div>
              <div className="card-body">
                <div className="dashboard-toggle-row"><div><strong>إشعارات الرسائل</strong><span>استلم إشعار عند وصول رسالة جديدة</span></div><span className="dashboard-toggle on" /></div>
                <div className="dashboard-toggle-row"><div><strong>إشعارات المشاهدات</strong><span>استلم إشعار عند مشاهدة إعلانك</span></div><span className="dashboard-toggle on" /></div>
                <div className="dashboard-toggle-row"><div><strong>إشعارات النظام</strong><span>تحديثات وإعلانات من DEBA</span></div><span className="dashboard-toggle" /></div>
              </div>
            </div>

            <div className="card danger-card">
              <div className="card-header"><h3 className="card-title">منطقة الخطر</h3></div>
              <div className="card-body">
                <p>حذف الحساب نهائيًا ليس جزءًا من لوحة الواجهة الحالية؛ يتم تنفيذ عمليات الحساب الحساسة خارج واجهة العميل لمنع الحذف العرضي.</p>
                <button type="button" className="btn btn-danger" onClick={() => void signOut()}>تسجيل الخروج</button>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3 className="card-title">تغيير كلمة المرور</h3></div>
              <div className="card-body">
                <form onSubmit={changePassword}>
                  <div className="form-grid">
                    <div className="form-group"><label className="form-label">كلمة المرور الجديدة</label><input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={128} required /></div>
                    <div className="form-group"><label className="form-label">تأكيد كلمة المرور</label><input className="form-input" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} minLength={8} maxLength={128} required /></div>
                  </div>
                  <button type="submit" className="btn btn-secondary">تحديث كلمة المرور</button>
                </form>
              </div>
            </div>
          </section>

          <section className={'content-section ' + (active === 'help' ? 'active' : '')}>
            <div className="card">
              <div className="card-header"><h3 className="card-title">المساعدة والدعم</h3></div>
              <div className="card-body">
                <div className="empty-state">
                  <div className="empty-state-icon"><MessageCircle size={34} /></div>
                  <h3>كيف يمكننا مساعدتك؟</h3>
                  <p>فريق الدعم متاح لمساعدتك في استفسارات الحساب والنشر والتواصل والسلامة.</p>
                  <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Link className="btn btn-primary" href="/chat"><MessageCircle size={16} /> تواصل مع الدعم</Link>
                    <Link className="btn btn-secondary" href="/legal"><ShieldCheck size={16} /> الأمان والسياسات</Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <button type="button" className="mobile-menu-toggle" aria-label="فتح قائمة لوحة التحكم" onClick={(event) => {
          const sidebar = (event.currentTarget.parentElement?.querySelector('.sidebar') as HTMLElement | null)
          sidebar?.classList.toggle('open')
        }}>
          <Menu size={24} />
        </button>
      </div>
    </div>
  )
}
