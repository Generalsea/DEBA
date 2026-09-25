'use client'

import {
  Archive,
  BarChart3,
  CheckCircle2,
  Eye,
  Gavel,
  Loader2,
  MessageCircle,
  Package,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Tag,
  Truck,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { ProfileProduct } from '@/components/ProfileDashboard'
import styles from './SellerListingsPanel.module.css'

type DashboardProduct = ProfileProduct & {
  updatedAt: string
  publishedAt: string | null
  soldAt: string | null
  imageStoragePath: string | null
  viewsCount: number
  offersCount: number
  activeChatsCount: number
}

type Props = {
  initialProducts: ProfileProduct[]
  isSeller: boolean
}

type EditDraft = {
  title: string
  price: string
  quantity: string
}

function toPublicImageUrl(supabase: ReturnType<typeof createClient>, path: string | null) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return supabase.storage.from('deba-product-media').getPublicUrl(path).data.publicUrl
}

function fromRpcRow(row: Record<string, unknown>, supabase: ReturnType<typeof createClient>): DashboardProduct {
  return {
    id: String(row.id),
    title: String(row.title || ''),
    slug: String(row.slug || ''),
    price: Number(row.price || 0),
    currency: String(row.currency || 'EGP'),
    quantity: Number(row.quantity || 0),
    status: String(row.status || 'draft'),
    moderationStatus: String(row.moderation_status || 'pending'),
    conditionGrade: typeof row.condition_grade === 'string' ? row.condition_grade : null,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || row.created_at || ''),
    publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
    soldAt: typeof row.sold_at === 'string' ? row.sold_at : null,
    imageStoragePath: typeof row.image_storage_path === 'string' ? row.image_storage_path : null,
    imageUrl: toPublicImageUrl(
      supabase,
      typeof row.image_storage_path === 'string' ? row.image_storage_path : null,
    ),
    viewsCount: Number(row.views_count || 0),
    offersCount: Number(row.offers_count || 0),
    activeChatsCount: Number(row.active_chats_count || 0),
  }
}

function initialRow(product: ProfileProduct): DashboardProduct {
  return {
    ...product,
    updatedAt: product.createdAt,
    publishedAt: null,
    soldAt: null,
    imageStoragePath: null,
    viewsCount: 0,
    offersCount: 0,
    activeChatsCount: 0,
  }
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value) + ' ' + currency
}

function statusMeta(product: DashboardProduct) {
  if (product.moderationStatus === 'pending' && product.status === 'draft') {
    return { label: 'قيد المراجعة', tone: 'pending' }
  }

  switch (product.status) {
    case 'published':
      return { label: 'منشور', tone: 'published' }
    case 'paused':
      return { label: 'متوقف مؤقتًا', tone: 'paused' }
    case 'sold':
      return { label: 'مباع', tone: 'sold' }
    case 'archived':
      return { label: 'مؤرشف', tone: 'archived' }
    case 'reserved':
      return { label: 'محجوز', tone: 'reserved' }
    default:
      if (product.moderationStatus === 'rejected') return { label: 'مرفوض — يحتاج تعديل', tone: 'rejected' }
      if (product.moderationStatus === 'needs_changes') return { label: 'يحتاج تعديلات', tone: 'needsChanges' }
      return { label: 'مسودة', tone: 'draft' }
  }
}

function friendlyError(message: string) {
  if (/Authenticated seller is required|Seller account is required|42501/i.test(message)) {
    return 'لا يمكن تنفيذ العملية من هذا الحساب. يجب تفعيل وضع البائع أولًا.'
  }
  if (/not found or not owned/i.test(message)) return 'الإعلان غير موجود أو لا تملك صلاحية إدارته.'
  if (/Only draft listings/i.test(message)) return 'هذا الإعلان ليس في حالة تسمح بإرساله للمراجعة.'
  if (/Only approved published/i.test(message)) return 'الإعلان يجب أن يكون منشورًا ومعتمدًا لهذه العملية.'
  if (/Only approved paused/i.test(message)) return 'الإعلان يجب أن يكون متوقفًا مؤقتًا ومعتمدًا لاستئناف النشر.'
  if (/Sold or archived/i.test(message)) return 'الإعلان المباع أو المؤرشف لا يمكن تعديله بهذه الطريقة.'
  if (/Listing title must contain/i.test(message)) return 'عنوان الإعلان يجب أن يكون بين 10 و120 حرفًا.'
  if (/price must be greater/i.test(message)) return 'السعر يجب أن يكون أكبر من صفر.'
  if (/quantity cannot be negative/i.test(message)) return 'الكمية لا يمكن أن تكون سالبة.'
  return message || 'تعذر تنفيذ العملية.'
}

export default function SellerListingsPanel({ initialProducts, isSeller }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [products, setProducts] = useState<DashboardProduct[]>(() => initialProducts.map(initialRow))
  const [loading, setLoading] = useState(isSeller)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function loadDashboard() {
    if (!isSeller) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('get_seller_dashboard')
    if (rpcError) {
      setError(friendlyError(rpcError.message))
      setLoading(false)
      return
    }

    const rows = Array.isArray(data) ? data : []
    setProducts(
      rows.map((row) => fromRpcRow(row as Record<string, unknown>, supabase)),
    )
    setLoading(false)
  }

  useEffect(() => {
    void loadDashboard()
  }, [isSeller])

  const summary = useMemo(() => {
    const activeListings = products.filter(
      (product) => product.status === 'published' || product.status === 'paused',
    ).length
    const pendingReview = products.filter(
      (product) => product.moderationStatus === 'pending',
    ).length

    return {
      totalListings: products.length,
      activeListings,
      pendingReview,
      views: products.reduce((sum, product) => sum + product.viewsCount, 0),
      offers: products.reduce((sum, product) => sum + product.offersCount, 0),
      chats: products.reduce((sum, product) => sum + product.activeChatsCount, 0),
    }
  }, [products])

  async function runLifecycle(id: string, action: string) {
    setBusyId(id + ':' + action)
    setError(null)
    setNotice(null)

    const { error: rpcError } = await supabase.rpc('update_seller_listing_status', {
      p_product_id: id,
      p_action: action,
    })

    if (rpcError) {
      setError(friendlyError(rpcError.message))
    } else {
      const labels: Record<string, string> = {
        submit_for_review: 'تم إرسال الإعلان إلى المراجعة.',
        pause: 'تم إيقاف الإعلان مؤقتًا.',
        resume: 'تمت إعادة الإعلان إلى النشر.',
        mark_sold: 'تم تعليم الإعلان كمباع.',
        archive: 'تمت أرشفة الإعلان.',
        restore: 'تمت استعادة الإعلان كمسودة وإعادته إلى المراجعة.',
      }
      setNotice(labels[action] || 'تم تحديث الإعلان.')
      await loadDashboard()
    }

    setBusyId(null)
  }

  function beginEdit(product: DashboardProduct) {
    setError(null)
    setNotice(null)
    setEditingId(product.id)
    setEditDraft({
      title: product.title,
      price: String(product.price),
      quantity: String(product.quantity),
    })
  }

  async function saveEdit(id: string) {
    if (!editDraft) return

    setBusyId(id + ':edit')
    setError(null)
    setNotice(null)

    const { error: rpcError } = await supabase.rpc('update_seller_listing', {
      p_product_id: id,
      p_title: editDraft.title,
      p_description: null,
      p_price: Number(editDraft.price),
      p_quantity: Number(editDraft.quantity),
      p_city: null,
      p_governorate: null,
      p_district: null,
    })

    if (rpcError) {
      setError(friendlyError(rpcError.message))
    } else {
      setNotice('تم حفظ التعديلات. وبما أن الإعلان تغيّر، أُعيد إلى دورة المراجعة.')
      setEditingId(null)
      setEditDraft(null)
      await loadDashboard()
    }

    setBusyId(null)
  }

  if (!isSeller) {
    return (
      <div className={styles.accessState}>
        <div className={styles.accessIcon}><Tag size={24} /></div>
        <div>
          <strong>وضع البائع غير مفعّل</strong>
          <p>فعّل وضع البائع من صفحة حسابك حتى تتمكن من إنشاء وإدارة الإعلانات.</p>
        </div>
        <Link href="/profile?tab=overview" className={styles.primaryButton}>
          تفعيل وضع البائع
        </Link>
      </div>
    )
  }

  return (
    <section className={styles.panel} aria-label="إدارة إعلانات البائع">
      <div className={styles.hero}>
        <div>
          <span className={styles.kicker}>SELLER LISTINGS</span>
          <h2>إدارة الإعلانات ودورة النشر</h2>
          <p>كل انتقال في حالة الإعلان يمر عبر RPC آمن؛ الواجهة لا تمنح البائع صلاحية تعديل حالة الإعلان مباشرة.</p>
        </div>
        <Link href="/sell" className={styles.primaryButton}>
          <Package size={17} />
          إضافة إعلان
        </Link>
      </div>

      {notice ? <div className={styles.notice}><CheckCircle2 size={17} />{notice}</div> : null}
      {error ? <div className={styles.error}><Gavel size={17} />{error}</div> : null}

      <div className={styles.summaryGrid}>
        <article><Package size={18} /><span>كل الإعلانات</span><strong>{summary.totalListings}</strong></article>
        <article><CheckCircle2 size={18} /><span>نشطة الآن</span><strong>{summary.activeListings}</strong></article>
        <article><Send size={18} /><span>قيد المراجعة</span><strong>{summary.pendingReview}</strong></article>
        <article><Eye size={18} /><span>المشاهدات</span><strong>{summary.views.toLocaleString('ar-EG')}</strong></article>
        <article><Gavel size={18} /><span>العروض</span><strong>{summary.offers.toLocaleString('ar-EG')}</strong></article>
        <article><MessageCircle size={18} /><span>محادثات نشطة · 30 يومًا</span><strong>{summary.chats.toLocaleString('ar-EG')}</strong></article>
      </div>

      {loading ? (
        <div className={styles.loading}><Loader2 size={22} className="deba-spin" /> جارٍ تحميل إعلاناتك...</div>
      ) : products.length ? (
        <div className={styles.list}>
          {products.map((product) => {
            const state = statusMeta(product)
            const editing = editingId === product.id
            const canEdit = !['sold', 'archived'].includes(product.status) && product.moderationStatus !== 'pending'
            const busy = busyId?.startsWith(product.id + ':') || false

            return (
              <article key={product.id} className={styles.card}>
                <div className={styles.image}>
                  {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <Package size={24} />}
                </div>

                <div className={styles.main}>
                  <div className={styles.topline}>
                    <div>
                      <span className={styles.status + ' ' + styles[state.tone]}>{state.label}</span>
                      <h3>{product.title}</h3>
                      <p>{money(product.price, product.currency)} · {product.quantity} وحدة</p>
                    </div>
                    <div className={styles.actions}>
                      {product.status === 'draft' ? (
                        <button type="button" onClick={() => void runLifecycle(product.id, 'submit_for_review')} disabled={busy} className={styles.secondaryButton}>
                          <Send size={15} /> إرسال للمراجعة
                        </button>
                      ) : null}
                      {product.status === 'published' ? (
                        <>
                          <button type="button" onClick={() => void runLifecycle(product.id, 'pause')} disabled={busy} className={styles.secondaryButton}>
                            <Pause size={15} /> إيقاف مؤقت
                          </button>
                          <button type="button" onClick={() => void runLifecycle(product.id, 'mark_sold')} disabled={busy} className={styles.secondaryButton}>
                            <CheckCircle2 size={15} /> تعليم كمباع
                          </button>
                        </>
                      ) : null}
                      {product.status === 'paused' ? (
                        <>
                          <button type="button" onClick={() => void runLifecycle(product.id, 'resume')} disabled={busy} className={styles.secondaryButton}>
                            <Play size={15} /> إعادة النشر
                          </button>
                          <button type="button" onClick={() => void runLifecycle(product.id, 'mark_sold')} disabled={busy} className={styles.secondaryButton}>
                            <CheckCircle2 size={15} /> تعليم كمباع
                          </button>
                          <button type="button" onClick={() => void runLifecycle(product.id, 'archive')} disabled={busy} className={styles.secondaryButton}>
                            <Archive size={15} /> أرشفة
                          </button>
                        </>
                      ) : null}
                      {product.status === 'sold' ? (
                        <button type="button" onClick={() => void runLifecycle(product.id, 'archive')} disabled={busy} className={styles.secondaryButton}>
                          <Archive size={15} /> أرشفة
                        </button>
                      ) : null}
                      {product.status === 'archived' ? (
                        <button type="button" onClick={() => void runLifecycle(product.id, 'restore')} disabled={busy} className={styles.secondaryButton}>
                          <RotateCcw size={15} /> استعادة
                        </button>
                      ) : null}
                      {canEdit ? (
                        <button type="button" onClick={() => beginEdit(product)} disabled={busy} className={styles.editButton}>
                          <Pencil size={15} /> تعديل
                        </button>
                      ) : null}
                      {product.status === 'published' || product.status === 'paused' || product.status === 'sold' ? (
                        <Link href={'/products/' + encodeURIComponent(product.slug)} className={styles.viewButton}>
                          عرض
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.metrics}>
                    <span><Eye size={15} /> {product.viewsCount.toLocaleString('ar-EG')} مشاهدة</span>
                    <span><Gavel size={15} /> {product.offersCount.toLocaleString('ar-EG')} عرض</span>
                    <span><MessageCircle size={15} /> {product.activeChatsCount.toLocaleString('ar-EG')} محادثة نشطة</span>
                    <span><Truck size={15} /> {product.conditionGrade || 'الحالة غير محددة'}</span>
                  </div>

                  {editing && editDraft ? (
                    <div className={styles.editor}>
                      <label><span>العنوان</span><input value={editDraft.title} onChange={(event) => setEditDraft((current) => current ? { ...current, title: event.target.value } : current)} maxLength={120} /></label>
                      <label><span>السعر (جنيه)</span><input type="number" min="1" step="0.01" value={editDraft.price} onChange={(event) => setEditDraft((current) => current ? { ...current, price: event.target.value } : current)} /></label>
                      <label><span>الكمية</span><input type="number" min="0" step="1" value={editDraft.quantity} onChange={(event) => setEditDraft((current) => current ? { ...current, quantity: event.target.value } : current)} /></label>
                      <div className={styles.editorHint}>تعديل العنوان أو السعر أو الكمية يعيد الإعلان تلقائيًا إلى دورة المراجعة. بيانات الموقع والوصف غير المعروضة محفوظة كما هي.</div>
                      <div className={styles.editorActions}>
                        <button type="button" className={styles.primaryButton} onClick={() => void saveEdit(product.id)} disabled={busyId === product.id + ':edit'}>
                          {busyId === product.id + ':edit' ? <Loader2 size={15} className="deba-spin" /> : <CheckCircle2 size={15} />}
                          حفظ وإعادة المراجعة
                        </button>
                        <button type="button" className={styles.cancelButton} onClick={() => { setEditingId(null); setEditDraft(null) }}>
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <Tag size={28} />
          <strong>لا توجد إعلانات بعد</strong>
          <span>أنشئ إعلانك الأول من نموذج DEBA الإلزامي.</span>
          <Link href="/sell" className={styles.primaryButton}>إضافة أول إعلان</Link>
        </div>
      )}
    </section>
  )
}
