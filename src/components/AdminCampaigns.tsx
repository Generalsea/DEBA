'use client'

import {
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import styles from './AdminCampaigns.module.css'

type Campaign = {
  id: string
  title: string
  subtitle: string | null
  media_type: 'image' | 'video'
  media_url: string
  poster_url: string | null
  target_url: string
  cta_label: string
  alt_text: string
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

type FormState = {
  title: string
  subtitle: string
  targetUrl: string
  ctaLabel: string
  altText: string
  sortOrder: string
  isActive: boolean
  startsAt: string
  endsAt: string
}

const EMPTY_FORM: FormState = {
  title: '',
  subtitle: '',
  targetUrl: '',
  ctaLabel: 'اكتشف الآن',
  altText: '',
  sortOrder: '0',
  isActive: true,
  startsAt: '',
  endsAt: '',
}

function toLocalInputDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

function dateLabel(value: string | null) {
  if (!value) return 'دون نهاية'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'غير صالح'
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function campaignStatus(campaign: Campaign) {
  const now = Date.now()
  if (!campaign.is_active) return 'متوقفة'
  if (campaign.starts_at && new Date(campaign.starts_at).getTime() > now) return 'مجدولة'
  if (campaign.ends_at && new Date(campaign.ends_at).getTime() <= now) return 'منتهية'
  return 'نشطة'
}

function statusClass(status: string) {
  if (status === 'نشطة') return styles.statusActive
  if (status === 'مجدولة') return styles.statusScheduled
  if (status === 'منتهية') return styles.statusEnded
  return styles.statusPaused
}

function mapCampaign(campaign: Campaign): FormState {
  return {
    title: campaign.title,
    subtitle: campaign.subtitle || '',
    targetUrl: campaign.target_url,
    ctaLabel: campaign.cta_label,
    altText: campaign.alt_text,
    sortOrder: String(campaign.sort_order),
    isActive: campaign.is_active,
    startsAt: toLocalInputDate(campaign.starts_at),
    endsAt: toLocalInputDate(campaign.ends_at),
  }
}

export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [mediaKind, setMediaKind] = useState<'image' | 'video'>('image')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/campaigns', { cache: 'no-store' })
      const data = (await response.json()) as { campaigns?: Campaign[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل الحملات.')
      setCampaigns(data.campaigns || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل الحملات.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const activeCount = useMemo(
    () => campaigns.filter((campaign) => campaign.is_active).length,
    [campaigns],
  )

  function resetForm() {
    setForm(EMPTY_FORM)
    setMediaFile(null)
    setPosterFile(null)
    setMediaKind('image')
    setEditingId(null)
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function onMediaChange(file: File | null) {
    setMediaFile(file)
    if (file) {
      setMediaKind(file.type.startsWith('video/') ? 'video' : 'image')
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const body = new FormData()
      body.set('title', form.title)
      body.set('subtitle', form.subtitle)
      body.set('targetUrl', form.targetUrl)
      body.set('ctaLabel', form.ctaLabel)
      body.set('altText', form.altText || form.title)
      body.set('sortOrder', form.sortOrder)
      body.set('isActive', String(form.isActive))
      body.set('startsAt', form.startsAt)
      body.set('endsAt', form.endsAt)
      body.set('mediaType', mediaKind)
      if (mediaFile) body.set('media', mediaFile)
      if (posterFile) body.set('poster', posterFile)

      const url = editingId
        ? '/api/admin/campaigns?id=' + encodeURIComponent(editingId)
        : '/api/admin/campaigns'
      const response = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        body,
      })

      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر حفظ الحملة.')

      resetForm()
      setSuccess(editingId ? 'تم تحديث الحملة.' : 'تم إنشاء الحملة.')
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'تعذر حفظ الحملة.')
    } finally {
      setSaving(false)
    }
  }

  function edit(campaign: Campaign) {
    setEditingId(campaign.id)
    setForm(mapCampaign(campaign))
    setMediaFile(null)
    setPosterFile(null)
    setMediaKind(campaign.media_type)
    setSuccess(null)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function toggle(campaign: Campaign) {
    setBusyId(campaign.id)
    setError(null)
    setSuccess(null)

    try {
      const body = new FormData()
      body.set('title', campaign.title)
      body.set('subtitle', campaign.subtitle || '')
      body.set('targetUrl', campaign.target_url)
      body.set('ctaLabel', campaign.cta_label)
      body.set('altText', campaign.alt_text)
      body.set('sortOrder', String(campaign.sort_order))
      body.set('isActive', String(!campaign.is_active))
      body.set('startsAt', campaign.starts_at ? toLocalInputDate(campaign.starts_at) : '')
      body.set('endsAt', campaign.ends_at ? toLocalInputDate(campaign.ends_at) : '')
      body.set('mediaType', campaign.media_type)

      const response = await fetch(
        '/api/admin/campaigns?id=' + encodeURIComponent(campaign.id),
        { method: 'PATCH', body },
      )
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر تغيير حالة الحملة.')

      setSuccess(campaign.is_active ? 'تم إيقاف الحملة.' : 'تم تفعيل الحملة.')
      await load()
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'تعذر تغيير الحالة.')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(campaign: Campaign) {
    if (!window.confirm('سيتم حذف الحملة وملفاتها المرفوعة نهائيًا. هل تتابع؟')) return

    setBusyId(campaign.id)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(
        '/api/admin/campaigns?id=' + encodeURIComponent(campaign.id),
        { method: 'DELETE' },
      )
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر حذف الحملة.')

      if (editingId === campaign.id) resetForm()
      setSuccess('تم حذف الحملة وملفاتها.')
      await load()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'تعذر حذف الحملة.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className={styles.shell} aria-labelledby="admin-campaigns-title">
      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>DEBA ADS CONTROL</span>
          <h2 id="admin-campaigns-title">إدارة الحملات الإعلانية</h2>
          <p>
            أنشئ حملات للصور أو الفيديوهات الرأسية 9:16، حدّد الوجهة والجدول الزمني،
            ثم فعّلها لتظهر تلقائيًا في شريط الإعلانات أعلى المتجر.
          </p>
        </div>
        <div className={styles.heroStats}>
          <div><strong>{campaigns.length}</strong><span>كل الحملات</span></div>
          <div><strong>{activeCount}</strong><span>مفعلة</span></div>
        </div>
      </div>

      {error ? <div className={styles.alertError}>{error}</div> : null}
      {success ? <div className={styles.alertSuccess}><CheckCircle2 size={17} />{success}</div> : null}

      <div className={styles.grid}>
        <form className={styles.formCard} onSubmit={save}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.cardEyebrow}>{editingId ? 'EDIT CAMPAIGN' : 'NEW CAMPAIGN'}</span>
              <h3>{editingId ? 'تعديل الحملة' : 'إنشاء حملة جديدة'}</h3>
            </div>
            {editingId ? (
              <button type="button" className={styles.iconButton} onClick={resetForm} aria-label="إلغاء التعديل">
                <X size={18} />
              </button>
            ) : null}
          </div>

          <div className={styles.fields}>
            <label>
              <span>عنوان الحملة</span>
              <input
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                maxLength={120}
                required
                placeholder="مثال: عروض العودة للدراسة"
              />
            </label>

            <label>
              <span>الوصف القصير</span>
              <textarea
                value={form.subtitle}
                onChange={(event) => updateForm('subtitle', event.target.value)}
                maxLength={200}
                rows={3}
                placeholder="رسالة قصيرة تظهر فوق الـCTA"
              />
            </label>

            <label>
              <span>رابط الوجهة</span>
              <input
                value={form.targetUrl}
                onChange={(event) => updateForm('targetUrl', event.target.value)}
                maxLength={2048}
                required
                placeholder="/?category=electronics أو https://example.com"
              />
              <small>يسمح بروابط DEBA الداخلية أو HTTPS فقط.</small>
            </label>

            <div className={styles.twoColumns}>
              <label>
                <span>نص الزر</span>
                <input
                  value={form.ctaLabel}
                  onChange={(event) => updateForm('ctaLabel', event.target.value)}
                  maxLength={60}
                />
              </label>

              <label>
                <span>الترتيب</span>
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  value={form.sortOrder}
                  onChange={(event) => updateForm('sortOrder', event.target.value)}
                />
              </label>
            </div>

            <label>
              <span>النص البديل</span>
              <input
                value={form.altText}
                onChange={(event) => updateForm('altText', event.target.value)}
                maxLength={180}
                placeholder="وصف الوصول للمحتوى المرئي"
              />
            </label>

            <div className={styles.twoColumns}>
              <label>
                <span>بداية الحملة</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => updateForm('startsAt', event.target.value)}
                />
              </label>

              <label>
                <span>نهاية الحملة</span>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => updateForm('endsAt', event.target.value)}
                />
              </label>
            </div>

            <label className={styles.switchRow}>
              <span>
                <strong>تفعيل الحملة</strong>
                <small>الجدول الزمني يظل هو المتحكم النهائي في الظهور.</small>
              </span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => updateForm('isActive', event.target.checked)}
              />
            </label>

            <div className={styles.uploadBox}>
              <div className={styles.uploadIcon}><Upload size={20} /></div>
              <div>
                <strong>{editingId ? 'استبدال الوسائط (اختياري)' : 'وسائط الحملة'}</strong>
                <p>الصور: JPG/PNG/WebP/AVIF حتى 10MB — الفيديو: MP4/WebM حتى 50MB. التصميم المستهدف 9:16.</p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
                onChange={(event) => onMediaChange(event.target.files?.[0] || null)}
                required={!editingId}
              />
              {mediaFile ? <small>{mediaFile.name} · {(mediaFile.size / (1024 * 1024)).toFixed(1)}MB</small> : null}
            </div>

            <div className={styles.uploadBox}>
              <div className={styles.uploadIcon}><ImageIcon size={20} /></div>
              <div>
                <strong>صورة غلاف للفيديو (اختياري)</strong>
                <p>يمكن استخدامها كـposter قبل تحميل أول فريم.</p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => setPosterFile(event.target.files?.[0] || null)}
              />
              {posterFile ? <small>{posterFile.name} · {(posterFile.size / (1024 * 1024)).toFixed(1)}MB</small> : null}
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? <Loader2 size={17} className="deba-spin" /> : editingId ? <Save size={17} /> : <Plus size={17} />}
              {saving ? 'جارٍ الحفظ...' : editingId ? 'حفظ التعديلات' : 'إنشاء الحملة'}
            </button>
            {editingId ? (
              <button type="button" className={styles.secondaryButton} onClick={resetForm} disabled={saving}>
                إلغاء
              </button>
            ) : null}
          </div>
        </form>

        <div className={styles.listCard}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.cardEyebrow}>CAMPAIGNS</span>
              <h3>الحملات الحالية</h3>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={16} className="deba-spin" /> : <Megaphone size={16} />}
              تحديث
            </button>
          </div>

          {loading ? (
            <div className={styles.empty}><Loader2 size={22} className="deba-spin" />جارٍ تحميل الحملات...</div>
          ) : campaigns.length ? (
            <div className={styles.campaigns}>
              {campaigns.map((campaign) => {
                const status = campaignStatus(campaign)
                const busy = busyId === campaign.id

                return (
                  <article key={campaign.id} className={styles.campaign}>
                    <div className={styles.mediaPreview}>
                      {campaign.media_type === 'video' ? (
                        <video
                          src={campaign.media_url}
                          poster={campaign.poster_url || undefined}
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img src={campaign.media_url} alt={campaign.alt_text} loading="lazy" />
                      )}
                      <span className={styles.mediaType}>
                        {campaign.media_type === 'video' ? <Film size={12} /> : <ImageIcon size={12} />}
                        {campaign.media_type === 'video' ? 'فيديو' : 'صورة'}
                      </span>
                    </div>

                    <div className={styles.campaignBody}>
                      <div className={styles.campaignTop}>
                        <div>
                          <span className={styles.status + ' ' + statusClass(status)}>{status}</span>
                          <h4>{campaign.title}</h4>
                          <p>{campaign.subtitle || 'بدون وصف قصير'}</p>
                        </div>
                        <strong className={styles.order}>#{campaign.sort_order}</strong>
                      </div>

                      <div className={styles.meta}>
                        <span>من: {dateLabel(campaign.starts_at)}</span>
                        <span>إلى: {dateLabel(campaign.ends_at)}</span>
                        <span>CTA: {campaign.cta_label}</span>
                      </div>

                      <a
                        href={campaign.target_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={styles.destination}
                      >
                        <Eye size={14} />
                        معاينة الوجهة
                      </a>

                      <div className={styles.actions}>
                        <button type="button" className={styles.secondaryButton} onClick={() => edit(campaign)} disabled={busy}>
                          <Edit3 size={15} />
                          تعديل
                        </button>
                        <button type="button" className={campaign.is_active ? styles.warningButton : styles.primaryButton} onClick={() => void toggle(campaign)} disabled={busy}>
                          {busy ? <Loader2 size={15} className="deba-spin" /> : campaign.is_active ? <EyeOff size={15} /> : <CheckCircle2 size={15} />}
                          {campaign.is_active ? 'إيقاف' : 'تفعيل'}
                        </button>
                        <button type="button" className={styles.dangerButton} onClick={() => void remove(campaign)} disabled={busy}>
                          {busy ? <Loader2 size={15} className="deba-spin" /> : <Trash2 size={15} />}
                          حذف
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <Megaphone size={28} />
              <strong>لا توجد حملات بعد</strong>
              <span>أنشئ أول حملة وستظهر تلقائيًا في شريط الإعلانات عند تفعيلها.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
