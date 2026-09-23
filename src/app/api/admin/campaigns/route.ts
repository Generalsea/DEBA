import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

const BUCKET = 'deba-header-ads'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_TITLE = 120
const MAX_SUBTITLE = 200
const MAX_CTA = 60
const MAX_ALT = 180

const ALLOWED_IMAGES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
])
const ALLOWED_VIDEOS = new Set([
  'video/mp4',
  'video/webm',
])

type CampaignRow = {
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
  media_storage_path: string | null
  poster_storage_path: string | null
  created_at: string
  updated_at: string
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return { user: null, allowed: false }

  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  return { user, allowed: Boolean(role) }
}

function textField(value: FormDataEntryValue | null, max: number, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback
}

function nullableText(value: FormDataEntryValue | null, max: number) {
  const text = textField(value, max)
  return text || null
}

function parseBoolean(value: FormDataEntryValue | null, fallback: boolean) {
  if (typeof value !== 'string') return fallback
  return value === 'true'
}

function parseDate(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function parseOrder(value: FormDataEntryValue | null, fallback = 0) {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, 1000000) : fallback
}

function validateTargetUrl(value: string) {
  if (/^\//.test(value) && !value.startsWith('//')) return true
  if (!/^https:\/\//i.test(value)) return false

  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

function validateSchedule(startsAt: string | null, endsAt: string | null) {
  if (!startsAt || !endsAt) return true
  return new Date(endsAt).getTime() > new Date(startsAt).getTime()
}

function getExtension(file: File) {
  switch (file.type) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/avif':
      return 'avif'
    case 'video/mp4':
      return 'mp4'
    case 'video/webm':
      return 'webm'
    default:
      return 'bin'
  }
}

function getPublicUrl(storagePath: string) {
  const admin = createAdminClient()
  return admin.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

async function uploadFile(file: File, mediaType: 'image' | 'video', role: 'media' | 'poster') {
  if (!file.size) throw new Error('الملف المرفوع فارغ.')
  if (role === 'poster') {
    if (!ALLOWED_IMAGES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      throw new Error('صورة الغلاف غير مدعومة أو تتجاوز 10MB.')
    }
  } else if (mediaType === 'image') {
    if (!ALLOWED_IMAGES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      throw new Error('صورة الإعلان غير مدعومة أو تتجاوز 10MB.')
    }
  } else if (!ALLOWED_VIDEOS.has(file.type) || file.size > MAX_VIDEO_BYTES) {
    throw new Error('فيديو الإعلان غير مدعوم أو يتجاوز 50MB.')
  }

  const path = `campaigns/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${getExtension(file)}`
  const admin = createAdminClient()
  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  })

  if (error) {
    console.error('DEBA campaign storage upload failed', error)
    throw new Error('تعذر رفع ملف الحملة.')
  }

  return {
    path,
    url: getPublicUrl(path),
  }
}

async function removeStoragePath(path: string | null) {
  if (!path) return
  const admin = createAdminClient()
  const { error } = await admin.storage.from(BUCKET).remove([path])
  if (error) console.error('DEBA campaign storage cleanup failed', error)
}

export async function GET() {
  try {
    const { user, allowed } = await requireAdmin()
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    if (!allowed) return NextResponse.json({ error: 'لا تملك صلاحية إدارة الحملات.' }, { status: 403 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('header_ad_promotions')
      .select(
        'id,title,subtitle,media_type,media_url,poster_url,target_url,cta_label,alt_text,is_active,starts_at,ends_at,sort_order,media_storage_path,poster_storage_path,created_at,updated_at',
      )
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('DEBA campaign list failed', error)
      return NextResponse.json({ error: 'تعذر تحميل الحملات الإعلانية.' }, { status: 500 })
    }

    return NextResponse.json({ campaigns: data || [] })
  } catch (error) {
    console.error('DEBA campaign GET failed', error)
    return NextResponse.json({ error: 'تعذر تحميل الحملات الإعلانية.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return mutateCampaign(request, null)
}

export async function PATCH(request: Request) {
  const id = new URL(request.url).searchParams.get('id')?.trim() || null
  return mutateCampaign(request, id)
}

export async function DELETE(request: Request) {
  try {
    const origin = request.headers.get('origin')
    const requestOrigin = new URL(request.url).origin
    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
    }

    const { user, allowed } = await requireAdmin()
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    if (!allowed) return NextResponse.json({ error: 'لا تملك صلاحية إدارة الحملات.' }, { status: 403 })

    const id = new URL(request.url).searchParams.get('id')?.trim()
    if (!id) return NextResponse.json({ error: 'معرّف الحملة مطلوب.' }, { status: 400 })

    const admin = createAdminClient()
    const { data: campaign, error: readError } = await admin
      .from('header_ad_promotions')
      .select('id,media_storage_path,poster_storage_path')
      .eq('id', id)
      .maybeSingle()

    if (readError || !campaign) {
      return NextResponse.json({ error: 'الحملة غير موجودة.' }, { status: 404 })
    }

    const { error } = await admin
      .from('header_ad_promotions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('DEBA campaign delete failed', error)
      return NextResponse.json({ error: 'تعذر حذف الحملة.' }, { status: 500 })
    }

    await Promise.all([
      removeStoragePath(campaign.media_storage_path),
      removeStoragePath(campaign.poster_storage_path),
    ])

    return NextResponse.json({ ok: true, id })
  } catch (error) {
    console.error('DEBA campaign DELETE failed', error)
    return NextResponse.json({ error: 'تعذر حذف الحملة.' }, { status: 500 })
  }
}

async function mutateCampaign(request: Request, id: string | null) {
  let uploadedMedia: { path: string; url: string } | null = null
  let uploadedPoster: { path: string; url: string } | null = null

  try {
    const origin = request.headers.get('origin')
    const requestOrigin = new URL(request.url).origin
    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
    }

    const { user, allowed } = await requireAdmin()
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    if (!allowed) return NextResponse.json({ error: 'لا تملك صلاحية إدارة الحملات.' }, { status: 403 })

    const form = await request.formData()
    const title = textField(form.get('title'), MAX_TITLE)
    const subtitle = nullableText(form.get('subtitle'), MAX_SUBTITLE)
    const targetUrl = textField(form.get('targetUrl'), 2048)
    const ctaLabel = textField(form.get('ctaLabel'), MAX_CTA, 'اكتشف الآن')
    const altText = textField(form.get('altText'), MAX_ALT, title || 'إعلان DEBA')
    const sortOrder = parseOrder(form.get('sortOrder'))
    const isActive = parseBoolean(form.get('isActive'), true)
    const startsAt = parseDate(form.get('startsAt'))
    const endsAt = parseDate(form.get('endsAt'))

    if (!title) return NextResponse.json({ error: 'عنوان الحملة مطلوب.' }, { status: 400 })
    if (!targetUrl || !validateTargetUrl(targetUrl)) {
      return NextResponse.json({ error: 'رابط الوجهة يجب أن يكون رابطًا داخليًا أو HTTPS.' }, { status: 400 })
    }
    if (!validateSchedule(startsAt, endsAt)) {
      return NextResponse.json({ error: 'وقت انتهاء الحملة يجب أن يكون بعد وقت البدء.' }, { status: 400 })
    }

    const media = form.get('media')
    const poster = form.get('poster')
    const requestedType = form.get('mediaType')
    const mediaType =
      requestedType === 'video' || requestedType === 'image'
        ? requestedType
        : media instanceof File && ALLOWED_VIDEOS.has(media.type)
          ? 'video'
          : 'image'

    if (media instanceof File && media.size > 0) {
      uploadedMedia = await uploadFile(media, mediaType, 'media')
    }

    if (poster instanceof File && poster.size > 0) {
      uploadedPoster = await uploadFile(poster, mediaType, 'poster')
    }

    const admin = createAdminClient()

    if (id) {
      const { data: current, error: currentError } = await admin
        .from('header_ad_promotions')
        .select(
          'id,title,subtitle,media_type,media_url,poster_url,target_url,cta_label,alt_text,is_active,starts_at,ends_at,sort_order,media_storage_path,poster_storage_path',
        )
        .eq('id', id)
        .maybeSingle()

      if (currentError || !current) {
        return NextResponse.json({ error: 'الحملة غير موجودة.' }, { status: 404 })
      }

      const update: Record<string, unknown> = {
        title,
        subtitle,
        target_url: targetUrl,
        cta_label: ctaLabel,
        alt_text: altText,
        sort_order: sortOrder,
        is_active: isActive,
        starts_at: startsAt,
        ends_at: endsAt,
        updated_at: new Date().toISOString(),
      }

      if (uploadedMedia) {
        update.media_type = mediaType
        update.media_url = uploadedMedia.url
        update.media_storage_path = uploadedMedia.path
      }

      if (uploadedPoster) {
        update.poster_url = uploadedPoster.url
        update.poster_storage_path = uploadedPoster.path
      }

      if (mediaType === 'image' && uploadedMedia) {
        update.poster_url = null
        update.poster_storage_path = null
      }

      const { data, error } = await admin
        .from('header_ad_promotions')
        .update(update)
        .eq('id', id)
        .select(
          'id,title,subtitle,media_type,media_url,poster_url,target_url,cta_label,alt_text,is_active,starts_at,ends_at,sort_order,media_storage_path,poster_storage_path,created_at,updated_at',
        )
        .single()

      if (error || !data) {
        await Promise.all([
          removeStoragePath(uploadedMedia?.path || null),
          removeStoragePath(uploadedPoster?.path || null),
        ])
        console.error('DEBA campaign update failed', error)
        return NextResponse.json({ error: 'تعذر تحديث الحملة.' }, { status: 500 })
      }

      await Promise.all([
        uploadedMedia ? removeStoragePath(current.media_storage_path) : Promise.resolve(),
        uploadedPoster || (mediaType === 'image' && uploadedMedia)
          ? removeStoragePath(current.poster_storage_path)
          : Promise.resolve(),
      ])

      return NextResponse.json({ campaign: data })
    }

    if (!(media instanceof File) || !media.size) {
      return NextResponse.json({ error: 'ملف الإعلان مطلوب.' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('header_ad_promotions')
      .insert({
        title,
        subtitle,
        media_type: mediaType,
        media_url: uploadedMedia?.url,
        poster_url: uploadedPoster?.url || null,
        target_url: targetUrl,
        cta_label: ctaLabel,
        alt_text: altText,
        is_active: isActive,
        starts_at: startsAt,
        ends_at: endsAt,
        sort_order: sortOrder,
        media_storage_path: uploadedMedia?.path,
        poster_storage_path: uploadedPoster?.path || null,
      })
      .select(
        'id,title,subtitle,media_type,media_url,poster_url,target_url,cta_label,alt_text,is_active,starts_at,ends_at,sort_order,media_storage_path,poster_storage_path,created_at,updated_at',
      )
      .single()

    if (error || !data) {
      await Promise.all([
        removeStoragePath(uploadedMedia?.path || null),
        removeStoragePath(uploadedPoster?.path || null),
      ])
      console.error('DEBA campaign create failed', error)
      return NextResponse.json({ error: 'تعذر إنشاء الحملة.' }, { status: 500 })
    }

    return NextResponse.json({ campaign: data }, { status: 201 })
  } catch (error) {
    await Promise.all([
      removeStoragePath(uploadedMedia?.path || null),
      removeStoragePath(uploadedPoster?.path || null),
    ])

    console.error('DEBA campaign mutation failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر حفظ الحملة.' },
      { status: 500 },
    )
  }
}
