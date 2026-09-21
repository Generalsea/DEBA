'use client'

import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Box,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Truck,
  UserRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export type ProfileOrder = {
  id: string
  referenceCode: string
  productId: string | null
  productTitle: string
  productSlug: string | null
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  total: number
  currency: string
  deliveryMethod: string
  createdAt: string
}

export type ProfileProduct = {
  id: string
  title: string
  slug: string
  price: number
  currency: string
  quantity: number
  status: string
  moderationStatus: string
  conditionGrade: string | null
  createdAt: string
  imageUrl: string | null
}

export type ProfileFavorite = {
  productId: string
  title: string
  slug: string
  price: number
  currency: string
  conditionGrade: string | null
  status: string
  createdAt: string
}

export type ProfileAccountData = {
  userId: string
  email: string | null
  emailConfirmed: boolean
  profile: {
    username: string | null
    displayName: string
    avatarUrl: string | null
    bio: string | null
    city: string | null
    governorate: string | null
    isPublic: boolean
    accountType: 'buyer' | 'seller'
    createdAt: string
    phone: string | null
    addressLine1: string | null
    addressLine2: string | null
    district: string | null
    postalCode: string | null
  }
  stats: {
    buyerOrders: number
    favorites: number
    sellerProducts: number
    sellerOrders: number
    activeSellerProducts: number
    pendingSellerProducts: number
  }
  buyerOrders: ProfileOrder[]
  sellerOrders: ProfileOrder[]
  sellerProducts: ProfileProduct[]
  favorites: ProfileFavorite[]
}

type TabId =
  | 'overview'
  | 'orders'
  | 'favorites'
  | 'reviews'
  | 'products'
  | 'seller-orders'
  | 'settings'
  | 'security'

type Props = {
  account: ProfileAccountData
  initialTab: string
}

const ORDER_LABELS: Record<string, string> = {
  pending: 'بانتظار المعالجة',
  confirmed: 'تم التأكيد',
  processing: 'قيد التجهيز',
  ready: 'جاهز للتسليم',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  refunded: 'مسترد',
}

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'غير مدفوع إلكترونيًا',
  pending: 'الدفع قيد المعالجة',
  paid: 'مدفوع',
  failed: 'فشل الدفع',
  refunded: 'مسترد',
}

const FULFILLMENT_LABELS: Record<string, string> = {
  pending: 'بانتظار التنفيذ',
  processing: 'قيد التنفيذ',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
}

const DELIVERY_LABELS: Record<string, string> = {
  pickup: 'استلام من البائع',
  seller_delivery: 'توصيل عبر البائع',
  platform_delivery: 'توصيل عبر DEBA',
  both: 'استلام أو توصيل',
}

const PROFILE_AVATAR_BUCKET = 'deba-profile-media'
const AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const TAB_MAP = new Set<TabId>([
  'overview',
  'orders',
  'favorites',
  'reviews',
  'products',
  'seller-orders',
  'settings',
  'security',
])

function safeTab(value: string, isSeller: boolean): TabId {
  if (value === 'products' || value === 'seller-orders') {
    return isSeller ? value : 'overview'
  }
  return TAB_MAP.has(value as TabId) ? (value as TabId) : 'overview'
}

function formatMoney(value: number, currency: string) {
  return (
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value) +
    ' ' +
    currency
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'D'
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = '',
}: {
  icon: LucideIcon
  label: string
  value: string | number
  tone?: string
}) {
  return (
    <div className={'deba-profile-stat ' + tone}>
      <div className="deba-profile-stat-icon">
        <Icon size={19} />
      </div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  body,
  href,
  action,
}: {
  icon: LucideIcon
  title: string
  body: string
  href?: string
  action?: string
}) {
  return (
    <div className="deba-profile-empty">
      <div className="deba-profile-empty-icon">
        <Icon size={27} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {href && action ? (
        <Link href={href} className="deba-profile-primary-action">
          {action}
          <ArrowLeft size={16} />
        </Link>
      ) : null}
    </div>
  )
}

function OrderStatus({ order }: { order: ProfileOrder }) {
  const key = ORDER_LABELS[order.status] ? order.status : 'pending'
  return (
    <div className="deba-profile-order-status">
      <span className={'deba-profile-status-dot status-' + key} />
      <span>{ORDER_LABELS[order.status] || order.status}</span>
    </div>
  )
}

function OrderCard({
  order,
  perspective,
}: {
  order: ProfileOrder
  perspective: 'buyer' | 'seller'
}) {
  return (
    <article className="deba-profile-order-card">
      <div className="deba-profile-order-icon">
        <ShoppingBag size={20} />
      </div>
      <div className="deba-profile-order-main">
        <div className="deba-profile-order-title-row">
          <div>
            <strong>{order.productTitle}</strong>
            <small>
              {order.referenceCode} · {formatDate(order.createdAt)}
            </small>
          </div>
          <span className="deba-profile-order-total">
            {formatMoney(order.total, order.currency)}
          </span>
        </div>
        <div className="deba-profile-order-meta">
          <OrderStatus order={order} />
          <span>{FULFILLMENT_LABELS[order.fulfillmentStatus] || order.fulfillmentStatus}</span>
          <span>{PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}</span>
          <span>{DELIVERY_LABELS[order.deliveryMethod] || order.deliveryMethod}</span>
        </div>
        <div className="deba-profile-order-actions">
          {order.productSlug ? (
            <Link href={'/products/' + encodeURIComponent(order.productSlug)}>
              عرض المنتج
              <ChevronLeft size={15} />
            </Link>
          ) : null}
          <Link href={'/orders/' + encodeURIComponent(order.id)}>
            إدارة الطلب
            <ChevronLeft size={15} />
          </Link>
          <span className="deba-profile-order-perspective">
            {perspective === 'seller' ? 'طلب وارد' : 'طلب شراء'}
          </span>
        </div>
      </div>
    </article>
  )
}

export default function ProfileDashboard({ account, initialTab }: Props) {
  const [isSeller, setIsSeller] = useState(account.profile.accountType === 'seller')
  const [activeTab, setActiveTab] = useState<TabId>(() => safeTab(initialTab, isSeller))
  const [profile, setProfile] = useState(account.profile)
  const [email] = useState(account.email || '')
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const tab = safeTab(new URLSearchParams(window.location.search).get('tab') || initialTab, isSeller)
    setActiveTab(tab)
  }, [initialTab, isSeller])

  function goTab(tab: TabId) {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState(null, '', url.toString())
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: profile.displayName,
          username: profile.username,
          bio: profile.bio,
          city: profile.city,
          governorate: profile.governorate,
          phone: profile.phone,
          accountType: isSeller ? 'seller' : 'buyer',
          addressLine1: profile.addressLine1,
          addressLine2: profile.addressLine2,
          district: profile.district,
          postalCode: profile.postalCode,
          isPublic: profile.isPublic,
        }),
      })

      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذر حفظ بيانات الحساب.')

      window.dispatchEvent(
        new CustomEvent('deba:profile-updated', {
          detail: {
            username: profile.username,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          },
        }),
      )
      setStatusMessage('تم حفظ بيانات الحساب بنجاح.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'تعذر حفظ بيانات الحساب.')
    } finally {
      setSaving(false)
    }
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setStatusMessage(null)
    setErrorMessage(null)

    if (!AVATAR_MIME_TYPES.has(file.type)) {
      setErrorMessage('صورة الملف الشخصي يجب أن تكون JPG أو PNG أو WebP.')
      return
    }

    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      setErrorMessage('حجم الصورة الأصلية كبير. اختر صورة لا تتجاوز 5 ميجابايت.')
      return
    }

    setUploadingAvatar(true)

    try {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      const size = 256
      canvas.width = size
      canvas.height = size

      const scale = Math.max(size / bitmap.width, size / bitmap.height)
      const drawWidth = bitmap.width * scale
      const drawHeight = bitmap.height * scale
      const offsetX = (size - drawWidth) / 2
      const offsetY = (size - drawHeight) / 2

      const context = canvas.getContext('2d')
      if (!context) throw new Error('تعذر تجهيز الصورة.')

      context.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight)
      bitmap.close()

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('تعذر ضغط الصورة.'))),
          'image/webp',
          0.82,
        )
      })

      const preparedFile = new File([blob], 'avatar.webp', {
        type: 'image/webp',
        lastModified: Date.now(),
      })
      const storagePath = account.userId + '/avatar.webp'

      const { error: uploadError } = await supabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .upload(storagePath, preparedFile, {
          upsert: true,
          contentType: 'image/webp',
          cacheControl: '3600',
        })

      if (uploadError) throw uploadError

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: storagePath }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذر حفظ الصورة الشخصية.')

      const publicUrl = supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(storagePath).data.publicUrl
      const nextAvatarUrl = publicUrl + '?v=' + Date.now()

      setProfile((current) => ({ ...current, avatarUrl: nextAvatarUrl }))
      window.dispatchEvent(
        new CustomEvent('deba:profile-updated', {
          detail: {
            username: profile.username,
            displayName: profile.displayName,
            avatarUrl: nextAvatarUrl,
          },
        }),
      )
      setStatusMessage('تم تحديث الصورة الشخصية بنجاح.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'تعذر رفع الصورة الشخصية.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatusMessage(null)
    setErrorMessage(null)

    if (newPassword.length < 8) {
      setErrorMessage('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('تأكيد كلمة المرور غير مطابق.')
      return
    }

    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setConfirmPassword('')
      setStatusMessage('تم تحديث كلمة المرور بنجاح.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'تعذر تحديث كلمة المرور.')
    } finally {
      setSavingPassword(false)
    }
  }

  async function signOut() {
    setErrorMessage(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setErrorMessage('تعذر تسجيل الخروج الآن. حاول مرة أخرى.')
      return
    }
    window.location.assign('/login')
  }

  const displayLocation = [profile.city, profile.governorate].filter(Boolean).join('، ')
  const completedFields = [
    Boolean(profile.displayName),
    Boolean(email),
    Boolean(profile.phone),
    Boolean(profile.city),
    Boolean(profile.governorate),
    Boolean(profile.bio),
    Boolean(profile.avatarUrl),
  ].filter(Boolean).length
  const profileCompletion = Math.round((completedFields / 7) * 100)

  return (
    <div className="deba-profile-shell">
      <section className="deba-profile-hero">
        <div className="deba-profile-hero-glow deba-profile-hero-glow-one" />
        <div className="deba-profile-hero-glow deba-profile-hero-glow-two" />
        <div className="deba-profile-hero-inner">
          <div className="deba-profile-identity">
            <button
              type="button"
              className="deba-profile-avatar-button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              title="تغيير الصورة الشخصية"
              aria-label="تغيير الصورة الشخصية"
            >
              <span className="deba-profile-avatar">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.displayName} />
                ) : (
                  initial(profile.displayName)
                )}
                <span className="deba-profile-avatar-check" title={account.emailConfirmed ? 'البريد الإلكتروني موثق' : 'الحساب يحتاج تأكيد البريد'}>
                  {account.emailConfirmed ? <CheckCircle2 size={15} /> : <Bell size={15} />}
                </span>
              </span>
              <span className="deba-profile-avatar-edit" aria-hidden="true">
                {uploadingAvatar ? <RefreshCw size={14} className="deba-spin" /> : <Pencil size={14} />}
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void uploadAvatar(event)}
              hidden
            />

            <div className="deba-profile-identity-copy">
              <span className="deba-profile-kicker">
                {isSeller ? 'DEBA SELLER ACCOUNT' : 'DEBA BUYER ACCOUNT'}
              </span>
              <h1>{profile.displayName}</h1>
              <div className="deba-profile-role-row">
                <span className={'deba-profile-role-badge ' + (isSeller ? 'seller' : 'buyer')}>
                  {isSeller ? <Store size={14} /> : <ShoppingBag size={14} />}
                  {isSeller ? 'حساب بائع' : 'حساب مشتري'}
                </span>
                <span className="deba-profile-trust-badge">
                  {account.emailConfirmed ? <ShieldCheck size={14} /> : <Bell size={14} />}
                  {account.emailConfirmed ? 'البريد الإلكتروني موثق' : 'البريد الإلكتروني غير مؤكد'}
                </span>
              </div>
              <div className="deba-profile-contact-line">
                <span>
                  <UserRound size={14} />
                  {email || 'بريد الحساب غير متاح'}
                </span>
                {displayLocation ? (
                  <span>
                    <MapPin size={14} />
                    {displayLocation}
                  </span>
                ) : null}
                <span>
                  <CalendarIcon />
                  عضو منذ {formatDate(profile.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="deba-profile-hero-actions">
            <div className="deba-profile-completion">
              <div>
                <span>اكتمال الملف</span>
                <strong>{profileCompletion}%</strong>
              </div>
              <div className="deba-profile-progress">
                <span style={{ width: profileCompletion + '%' }} />
              </div>
            </div>
            <button type="button" className="deba-profile-ghost-action" onClick={() => goTab('settings')}>
              <Pencil size={15} />
              تعديل الحساب
            </button>
          </div>
        </div>
      </section>

      <div className="deba-profile-role-notice">
        <div>
          {isSeller ? <Store size={19} /> : <ShoppingBag size={19} />}
          <div>
            <strong>
              {isSeller ? 'وضع البائع نشط — والشراء ما زال متاحًا لك' : 'حساب المشتري نشط'}
            </strong>
            <span>
              {isSeller
                ? 'يمكنك إدارة إعلاناتك واستقبال الطلبات، وفي الوقت نفسه شراء منتجات بائعين آخرين.'
                : 'يمكنك إدارة طلبات الشراء والمفضلة وبيانات الحساب. للبدء في البيع استخدم مسار إنشاء حساب بائع المعتمد في DEBA.'}
            </span>
          </div>
        </div>
        {isSeller ? (
          <Link href="/sell" className="deba-profile-primary-action">
            إضافة إعلان
            <Plus size={17} />
          </Link>
        ) : (
          <button
            type="button"
            className="deba-profile-primary-action"
            onClick={async () => {
              setErrorMessage(null)
              setStatusMessage(null)
              try {
                const response = await fetch('/api/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ displayName: profile.displayName, accountType: 'seller' }),
                })
                const result = (await response.json()) as { error?: string }
                if (!response.ok) throw new Error(result.error || 'تعذر تفعيل وضع البائع.')
                setIsSeller(true)
                setStatusMessage('تم تفعيل وضع البائع. يمكنك الآن إنشاء إعلانات.')
              } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : 'تعذر تفعيل وضع البائع.')
              }
            }}
          >
            تفعيل وضع البائع
            <Store size={17} />
          </button>
        )}
      </div>

      {statusMessage ? (
        <div className="deba-profile-flash success">
          <CheckCircle2 size={17} />
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} aria-label="إغلاق">
            <X size={15} />
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="deba-profile-flash error">
          <RefreshCw size={17} />
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="إغلاق">
            <X size={15} />
          </button>
        </div>
      ) : null}

      <section className="deba-profile-stat-grid">
        <StatCard icon={Package} label="طلباتي" value={account.stats.buyerOrders} />
        <StatCard icon={Heart} label="المفضلة" value={account.stats.favorites} tone="rose" />
        {isSeller ? (
          <>
            <StatCard icon={Store} label="إعلاناتي" value={account.stats.sellerProducts} tone="blue" />
            <StatCard icon={ShoppingBag} label="الطلبات الواردة" value={account.stats.sellerOrders} tone="green" />
          </>
        ) : (
          <>
            <StatCard icon={Truck} label="بيانات الاستلام" value={profile.phone ? 'جاهزة' : 'تحتاج استكمال'} tone="blue" />
            <StatCard icon={ShieldCheck} label="حالة الحساب" value={profile.isPublic ? 'عام' : 'خاص'} tone="green" />
          </>
        )}
      </section>

      <div className="deba-profile-layout">
        <aside className="deba-profile-sidebar">
          <div className="deba-profile-sidebar-section">
            <span className="deba-profile-sidebar-title">حسابي</span>
            <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => goTab('overview')}>
              <LayoutDashboard size={17} /> نظرة عامة
            </button>
            <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => goTab('orders')}>
              <Package size={17} /> طلباتي
              <em>{account.stats.buyerOrders}</em>
            </button>
            <button className={activeTab === 'favorites' ? 'active' : ''} onClick={() => goTab('favorites')}>
              <Heart size={17} /> المفضلة
              <em>{account.stats.favorites}</em>
            </button>
            <button className={activeTab === 'reviews' ? 'active' : ''} onClick={() => goTab('reviews')}>
              <Star size={17} /> تقييماتي
            </button>
          </div>

          {isSeller ? (
            <div className="deba-profile-sidebar-section">
              <span className="deba-profile-sidebar-title">البائع</span>
              <button className={activeTab === 'products' ? 'active' : ''} onClick={() => goTab('products')}>
                <Store size={17} /> إعلاناتي
                <em>{account.stats.sellerProducts}</em>
              </button>
              <button className={activeTab === 'seller-orders' ? 'active' : ''} onClick={() => goTab('seller-orders')}>
                <ShoppingBag size={17} /> طلبات العملاء
                <em>{account.stats.sellerOrders}</em>
              </button>
            </div>
          ) : null}

          <div className="deba-profile-sidebar-section">
            <span className="deba-profile-sidebar-title">الإعدادات</span>
            <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => goTab('settings')}>
              <Settings size={17} /> بيانات الحساب
            </button>
            <button className={activeTab === 'security' ? 'active' : ''} onClick={() => goTab('security')}>
              <ShieldCheck size={17} /> الأمان
            </button>
          </div>

          <div className="deba-profile-sidebar-support">
            <Bell size={17} />
            <strong>بياناتك ملكك</strong>
            <span>البيانات الخاصة لا تظهر في الملف العام للبائع.</span>
          </div>

          <button type="button" className="deba-profile-signout" onClick={() => void signOut()}>
            <LogOut size={17} />
            تسجيل الخروج
          </button>
        </aside>

        <main className="deba-profile-content">
          <div className="deba-profile-content-head">
            <div>
              <span className="deba-profile-content-kicker">
                {isSeller ? 'SELLER CENTER' : 'MY ACCOUNT'}
              </span>
              <h2>
                {activeTab === 'overview'
                  ? isSeller
                    ? 'لوحة حساب البائع'
                    : 'نظرة عامة على حسابك'
                  : activeTab === 'orders'
                    ? 'طلباتي'
                    : activeTab === 'favorites'
                      ? 'المفضلة'
                      : activeTab === 'reviews'
                        ? 'تقييماتي'
                        : activeTab === 'products'
                          ? 'إعلاناتي'
                          : activeTab === 'seller-orders'
                            ? 'طلبات العملاء'
                            : activeTab === 'settings'
                              ? 'بيانات الحساب'
                              : 'الأمان والحماية'}
              </h2>
              <p>
                {isSeller
                  ? 'إدارة تشغيلية مرتبطة مباشرة ببيانات DEBA الفعلية.'
                  : 'كل ما يتعلق بعمليات الشراء والبيانات الشخصية في مكان واحد.'}
              </p>
            </div>
            {isSeller && activeTab === 'products' ? (
              <Link href="/sell" className="deba-profile-primary-action">
                <Plus size={17} />
                إعلان جديد
              </Link>
            ) : null}
          </div>

          {activeTab === 'overview' ? (
            isSeller ? (
              <SellerOverview account={account} onTab={goTab} />
            ) : (
              <BuyerOverview account={account} onTab={goTab} />
            )
          ) : null}

          {activeTab === 'orders' ? (
            account.buyerOrders.length ? (
              <div className="deba-profile-orders-list">
                {account.buyerOrders.map((order) => (
                  <OrderCard key={order.id} order={order} perspective="buyer" />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Package}
                title="لا توجد طلبات شراء بعد"
                body="عندما تؤكد أول شراء سيظهر الطلب هنا ببياناته الفعلية."
                href="/"
                action="تصفح المنتجات"
              />
            )
          ) : null}

          {activeTab === 'favorites' ? (
            account.favorites.length ? (
              <div className="deba-profile-favorites-grid">
                {account.favorites.map((favorite) => (
                  <Link
                    key={favorite.productId}
                    href={'/products/' + encodeURIComponent(favorite.slug)}
                    className="deba-profile-favorite-card"
                  >
                    <div className="deba-profile-favorite-icon">
                      <Heart size={20} fill="currentColor" />
                    </div>
                    <div>
                      <strong>{favorite.title}</strong>
                      <span>
                        {favorite.price > 0
                          ? formatMoney(favorite.price, favorite.currency)
                          : 'السعر غير متاح'}
                      </span>
                      <small>
                        {favorite.conditionGrade || 'الحالة غير محددة'} · {formatDate(favorite.createdAt)}
                      </small>
                    </div>
                    <ChevronLeft size={18} />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Heart}
                title="قائمة المفضلة فارغة"
                body="احفظ المنتجات التي تريد العودة إليها لاحقًا من صفحات المنتجات."
                href="/"
                action="استكشف السوق"
              />
            )
          ) : null}

          {activeTab === 'reviews' ? (
            <EmptyState
              icon={Star}
              title="التقييمات قيد البناء"
              body="لا توجد جداول تقييمات مكتملة في النسخة الحالية، لذلك لن نعرض أرقامًا تجريبية أو تقييمات وهمية."
            />
          ) : null}

          {activeTab === 'products' && isSeller ? (
            account.sellerProducts.length ? (
              <div className="deba-profile-products-grid">
                {account.sellerProducts.map((product) => (
                  <article key={product.id} className="deba-profile-product-card">
                    <div className="deba-profile-product-placeholder">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.title} />
                      ) : (
                        <Store size={26} />
                      )}
                      <span>{product.conditionGrade || 'حالة غير محددة'}</span>
                    </div>
                    <div className="deba-profile-product-copy">
                      <strong>{product.title}</strong>
                      <span>{formatMoney(product.price, product.currency)}</span>
                      <small>
                        {product.quantity} وحدة · {product.moderationStatus === 'approved' ? 'معتمد' : 'قيد المراجعة'}
                      </small>
                    </div>
                    <div className="deba-profile-product-actions">
                      {product.status === 'published' && product.moderationStatus === 'approved' ? (
                        <Link href={'/products/' + encodeURIComponent(product.slug)}>
                          عرض
                        </Link>
                      ) : (
                        <span>
                          {product.moderationStatus === 'pending' ? 'قيد المراجعة' : product.status}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Store}
                title="لا توجد إعلانات بعد"
                body="أنشئ أول إعلان عبر عقد بيانات DEBA الإلزامي."
                href="/sell"
                action="إضافة أول إعلان"
              />
            )
          ) : null}

          {activeTab === 'seller-orders' && isSeller ? (
            account.sellerOrders.length ? (
              <div className="deba-profile-orders-list">
                {account.sellerOrders.map((order) => (
                  <OrderCard key={order.id} order={order} perspective="seller" />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ShoppingBag}
                title="لا توجد طلبات واردة بعد"
                body="ستظهر طلبات العملاء هنا فور تسجيل عمليات الشراء على منتجاتك."
                href="/sell"
                action="إدارة إعلاناتي"
              />
            )
          ) : null}

          {activeTab === 'settings' ? (
            <form className="deba-profile-form" onSubmit={saveProfile}>
              <div className="deba-profile-form-grid">
                <label>
                  <span>الاسم الظاهر *</span>
                  <input
                    value={profile.displayName}
                    onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </label>
                <label>
                  <span>اسم المستخدم</span>
                  <input
                    value={profile.username || ''}
                    onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))}
                    placeholder="username"
                    maxLength={40}
                  />
                </label>
                <label>
                  <span>البريد الإلكتروني</span>
                  <input value={email} readOnly />
                  <small>البريد مرتبط بمصادقة DEBA ولا يتغير من هذا النموذج.</small>
                </label>
                <label>
                  <span>الهاتف</span>
                  <input
                    value={profile.phone || ''}
                    onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                    inputMode="tel"
                    maxLength={30}
                  />
                </label>
                <label>
                  <span>المحافظة</span>
                  <input
                    value={profile.governorate || ''}
                    onChange={(event) => setProfile((current) => ({ ...current, governorate: event.target.value }))}
                    maxLength={100}
                  />
                </label>
                <label>
                  <span>المدينة</span>
                  <input
                    value={profile.city || ''}
                    onChange={(event) => setProfile((current) => ({ ...current, city: event.target.value }))}
                    maxLength={100}
                  />
                </label>
                <label className="wide">
                  <span>نبذة عن الحساب</span>
                  <textarea
                    value={profile.bio || ''}
                    onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                    maxLength={500}
                    placeholder="عرّف بنفسك باختصار ووضوح."
                  />
                </label>
                <label className="wide">
                  <span>العنوان الأساسي</span>
                  <input
                    value={profile.addressLine1 || ''}
                    onChange={(event) => setProfile((current) => ({ ...current, addressLine1: event.target.value }))}
                    maxLength={180}
                  />
                </label>
                <label>
                  <span>العنوان — تفاصيل إضافية</span>
                  <input
                    value={profile.addressLine2 || ''}
                    onChange={(event) => setProfile((current) => ({ ...current, addressLine2: event.target.value }))}
                    maxLength={180}
                  />
                </label>
                <label>
                  <span>الحي</span>
                  <input
                    value={profile.district || ''}
                    onChange={(event) => setProfile((current) => ({ ...current, district: event.target.value }))}
                    maxLength={100}
                  />
                </label>
                <label>
                  <span>الرمز البريدي</span>
                  <input
                    value={profile.postalCode || ''}
                    onChange={(event) => setProfile((current) => ({ ...current, postalCode: event.target.value }))}
                    maxLength={20}
                  />
                </label>
              </div>

              <label className="deba-profile-privacy-toggle">
                <input
                  type="checkbox"
                  checked={profile.isPublic}
                  onChange={(event) => setProfile((current) => ({ ...current, isPublic: event.target.checked }))}
                />
                <span>
                  <strong>إظهار الملف العام</strong>
                  <small>يمكن استخدام هذا الخيار لصفحة البائع العامة مستقبلًا. بيانات الاتصال الخاصة تبقى منفصلة.</small>
                </span>
              </label>

              <div className="deba-profile-form-actions">
                <button type="submit" className="deba-profile-primary-action" disabled={saving}>
                  <CheckCircle2 size={17} />
                  {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          ) : null}

          {activeTab === 'security' ? (
            <div className="deba-profile-security-grid">
              <section className="deba-profile-security-card">
                <div className="deba-profile-security-head">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>حماية الحساب</strong>
                    <span>إدارة كلمة المرور والجلسة الحالية.</span>
                  </div>
                </div>

                <form onSubmit={changePassword} className="deba-profile-security-form">
                  <label>
                    <span>كلمة المرور الجديدة</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                    />
                  </label>
                  <label>
                    <span>تأكيد كلمة المرور</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                    />
                  </label>
                  <button type="submit" className="deba-profile-primary-action" disabled={savingPassword}>
                    <ShieldCheck size={17} />
                    {savingPassword ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
                  </button>
                </form>
              </section>

              <section className="deba-profile-security-card">
                <div className="deba-profile-security-head">
                  <WalletCards size={20} />
                  <div>
                    <strong>المدفوعات الإلكترونية</strong>
                    <span>غير مفعلة بعد في البنية الحالية.</span>
                  </div>
                </div>
                <p>
                  DEBA حاليًا يسجل طلب الشراء ويترك حالة الدفع «غير مدفوع إلكترونيًا».
                  لن نعرض بطاقات أو محافظ وهمية قبل ربط بوابة دفع فعلية.
                </p>
              </section>

              <section className="deba-profile-security-card danger">
                <div className="deba-profile-security-head">
                  <LogOut size={20} />
                  <div>
                    <strong>تسجيل الخروج</strong>
                    <span>إنهاء الجلسة الحالية على هذا الجهاز.</span>
                  </div>
                </div>
                <button type="button" className="deba-profile-danger-action" onClick={() => void signOut()}>
                  تسجيل الخروج من DEBA
                </button>
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}

function CalendarIcon() {
  return <span className="deba-calendar-icon" aria-hidden="true">◷</span>
}

function BuyerOverview({
  account,
  onTab,
}: {
  account: ProfileAccountData
  onTab: (tab: TabId) => void
}) {
  return (
    <div className="deba-profile-overview-grid">
      <section className="deba-profile-panel deba-profile-panel-wide">
        <div className="deba-profile-panel-head">
          <div>
            <span>RECENT ACTIVITY</span>
            <h3>آخر الطلبات</h3>
          </div>
          <button type="button" onClick={() => onTab('orders')}>عرض الكل</button>
        </div>
        {account.buyerOrders.length ? (
          <div className="deba-profile-orders-list compact">
            {account.buyerOrders.slice(0, 4).map((order) => (
              <OrderCard key={order.id} order={order} perspective="buyer" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ShoppingBag}
            title="لم تسجل أي عملية شراء"
            body="تصفح السوق، وعندما تؤكد شراءً سيظهر هنا."
            href="/"
            action="ابدأ التسوق"
          />
        )}
      </section>

      <section className="deba-profile-panel">
        <div className="deba-profile-panel-head">
          <div>
            <span>FAVORITES</span>
            <h3>المفضلة</h3>
          </div>
          <button type="button" onClick={() => onTab('favorites')}>فتح</button>
        </div>
        {account.favorites.length ? (
          <div className="deba-profile-mini-list">
            {account.favorites.slice(0, 5).map((item) => (
              <Link key={item.productId} href={'/products/' + encodeURIComponent(item.slug)}>
                <Heart size={15} fill="currentColor" />
                <span>{item.title}</span>
                <ChevronLeft size={15} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="deba-profile-panel-note">لا توجد منتجات محفوظة في المفضلة حتى الآن.</p>
        )}
      </section>

      <section className="deba-profile-panel">
        <div className="deba-profile-panel-head">
          <div>
            <span>ACCOUNT HEALTH</span>
            <h3>حالة الحساب</h3>
          </div>
        </div>
        <div className="deba-profile-health-list">
          <div><CheckCircle2 size={16} /><span>المصادقة عبر البريد</span><strong>مفعلة</strong></div>
          <div>
            {account.profile.phone ? <CheckCircle2 size={16} /> : <Bell size={16} />}
            <span>رقم الهاتف</span>
            <strong>{account.profile.phone ? 'مكتمل' : 'يحتاج إضافة'}</strong>
          </div>
          <div>
            {account.profile.city && account.profile.governorate ? <CheckCircle2 size={16} /> : <MapPin size={16} />}
            <span>موقع الحساب</span>
            <strong>
              {account.profile.city && account.profile.governorate ? 'مكتمل' : 'يحتاج إضافة'}
            </strong>
          </div>
        </div>
      </section>
    </div>
  )
}

function SellerOverview({
  account,
  onTab,
}: {
  account: ProfileAccountData
  onTab: (tab: TabId) => void
}) {
  return (
    <div className="deba-profile-overview-grid">
      <section className="deba-profile-panel deba-profile-panel-wide">
        <div className="deba-profile-panel-head">
          <div>
            <span>SELLER OPERATIONS</span>
            <h3>ملخص نشاط البيع</h3>
          </div>
          <Link href="/sell">إضافة إعلان</Link>
        </div>

        <div className="deba-profile-seller-health-grid">
          <div>
            <Store size={19} />
            <strong>{account.stats.sellerProducts}</strong>
            <span>إجمالي الإعلانات</span>
          </div>
          <div>
            <CheckCircle2 size={19} />
            <strong>{account.stats.activeSellerProducts}</strong>
            <span>إعلانات منشورة ومعتمدة</span>
          </div>
          <div>
            <RefreshCw size={19} />
            <strong>{account.stats.pendingSellerProducts}</strong>
            <span>قيد المراجعة/الإكمال</span>
          </div>
          <div>
            <ShoppingBag size={19} />
            <strong>{account.stats.sellerOrders}</strong>
            <span>طلبات العملاء</span>
          </div>
        </div>
      </section>

      <section className="deba-profile-panel">
        <div className="deba-profile-panel-head">
          <div>
            <span>LISTINGS</span>
            <h3>أحدث الإعلانات</h3>
          </div>
          <button type="button" onClick={() => onTab('products')}>عرض الكل</button>
        </div>
        {account.sellerProducts.length ? (
          <div className="deba-profile-mini-list">
            {account.sellerProducts.slice(0, 5).map((item) => (
              <Link key={item.id} href={'/products/' + encodeURIComponent(item.slug)}>
                <Store size={15} />
                <span>{item.title}</span>
                <b>{item.quantity}</b>
              </Link>
            ))}
          </div>
        ) : (
          <p className="deba-profile-panel-note">لم تنشئ إعلانات بعد.</p>
        )}
      </section>

      <section className="deba-profile-panel">
        <div className="deba-profile-panel-head">
          <div>
            <span>ORDERS</span>
            <h3>آخر طلبات العملاء</h3>
          </div>
          <button type="button" onClick={() => onTab('seller-orders')}>فتح</button>
        </div>
        {account.sellerOrders.length ? (
          <div className="deba-profile-mini-list">
            {account.sellerOrders.slice(0, 5).map((item) => (
              <div key={item.id}>
                <ShoppingBag size={15} />
                <span>{item.productTitle}</span>
                <b>{formatMoney(item.total, item.currency)}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="deba-profile-panel-note">لا توجد طلبات واردة حتى الآن.</p>
        )}
      </section>
    </div>
  )
}
