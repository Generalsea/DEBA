import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type Context = { params: Promise<{ id: string }> }
type MessageType = 'text' | 'image' | 'offer' | 'system'

const CHAT_MEDIA_BUCKET = 'deba-product-media'
const MAX_MESSAGE_LENGTH = 4000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_FILE_BYTES = 12 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

function safeFileName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'file'
}

async function getAuthenticatedRoom(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('chat_participants')
    .select('room_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    return { error: NextResponse.json({ error: 'المحادثة غير متاحة لك.' }, { status: 403 }) }
  }

  return { roomId }
}

async function insertMessage(
  request: Request,
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  userId: string,
  messageType: MessageType,
  body: string | null,
  metadata: Record<string, unknown>,
) {
  const riskFlags = [
    body && /(?:01|\+?20)\d[\d\s-]{8,}/.test(body) ? 'phone' : null,
    body && /[\w.+-]+@[\w-]+\.[\w.-]+/.test(body) ? 'email' : null,
    body && /https?:\/\//i.test(body) ? 'url' : null,
  ].filter((value): value is string => Boolean(value))

  const finalMetadata = { ...metadata, risk_flags: riskFlags }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: roomId,
      sender_id: userId,
      message_type: messageType,
      body,
      metadata: finalMetadata,
    })
    .select('id,room_id,sender_id,message_type,body,metadata,created_at')
    .single()

  if (error) {
    console.error('DEBA message send failed', error)
    return { error: NextResponse.json({ error: 'تعذر إرسال الرسالة.' }, { status: 403 }) }
  }

  await supabase
    .from('chat_rooms')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', roomId)

  try {
    const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    const clientIp = forwardedFor.split(',')[0]?.trim() || null
    const { data: privateProfile } = await supabase
      .from('profile_private')
      .select('phone')
      .eq('user_id', userId)
      .maybeSingle()

    await supabase.from('chat_security_events').insert({
      room_id: roomId,
      message_id: data?.id || null,
      user_id: userId,
      ip_address: clientIp,
      mac_address: null,
      email_snapshot: null,
      phone_snapshot: privateProfile?.phone || null,
      user_agent: request.headers.get('user-agent'),
      accept_language: request.headers.get('accept-language'),
      metadata: finalMetadata,
    })
  } catch (auditError) {
    console.error('DEBA chat security audit failed', auditError)
  }

  return { data }
}

async function handleMultipart(
  request: Request,
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  userId: string,
) {
  const form = await request.formData()
  const file = form.get('file')
  const kind = String(form.get('kind') || 'file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'الملف مطلوب.' }, { status: 400 })
  }

  const isImage = kind === 'image'
  const allowedTypes = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_FILE_TYPES
  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: isImage ? 'صيغة الصورة غير مدعومة.' : 'صيغة الملف غير مدعومة.' }, { status: 400 })
  }

  if (file.size <= 0 || file.size > maxBytes) {
    return NextResponse.json(
      { error: isImage ? 'حجم الصورة يجب ألا يتجاوز 8MB.' : 'حجم الملف يجب ألا يتجاوز 12MB.' },
      { status: 400 },
    )
  }

  const extension = safeFileName(file.name).split('.').pop() || (isImage ? 'jpg' : 'bin')
  const storagePath = 'chat/' + userId + '/' + roomId + '/' + crypto.randomUUID() + '-' + safeFileName(file.name).slice(0, 80) + (file.name.includes('.') ? '' : '.' + extension)

  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(storagePath, bytes, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  })

  if (uploadError) {
    console.error('DEBA chat media upload failed', uploadError)
    return NextResponse.json({ error: 'تعذر رفع الملف الآن.' }, { status: 403 })
  }

  const publicUrl = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl
  const messageType: MessageType = isImage ? 'image' : 'system'
  const metadata = {
    kind: isImage ? 'image' : 'file',
    url: publicUrl,
    storagePath,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  }

  const result = await insertMessage(
    request,
    supabase,
    roomId,
    userId,
    messageType,
    isImage ? '📷 صورة مرفقة' : '📎 ' + file.name,
    metadata,
  )

  if (result.error) {
    await supabase.storage.from(CHAT_MEDIA_BUCKET).remove([storagePath])
    return result.error
  }

  return NextResponse.json({ message: result.data, riskFlags: [] }, { status: 201 })
}

function validateLocation(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const location = value as Record<string, unknown>
  const latitude = Number(location.latitude)
  const longitude = Number(location.longitude)
  const accuracy = Number(location.accuracy)

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null

  return {
    latitude,
    longitude,
    ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracy } : {}),
  }
}

export async function GET(request: Request, context: Context) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { id: roomId } = await context.params
    if (!roomId) return NextResponse.json({ error: 'معرّف المحادثة مطلوب.' }, { status: 400 })

    const access = await getAuthenticatedRoom(supabase, roomId, userData.user.id)
    if ('error' in access) return access.error

    const url = new URL(request.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100)

    const { data, error } = await supabase
      .from('messages')
      .select('id,room_id,sender_id,message_type,body,metadata,created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('DEBA messages load failed', error)
      return NextResponse.json({ error: 'تعذر تحميل الرسائل.' }, { status: 403 })
    }

    await supabase.rpc('mark_chat_read', { p_room_id: roomId })

    return NextResponse.json({ messages: (data || []).reverse() })
  } catch (error) {
    console.error('DEBA messages GET failed', error)
    return NextResponse.json({ error: 'تعذر تحميل الرسائل.' }, { status: 500 })
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { id: roomId } = await context.params
    if (!roomId) return NextResponse.json({ error: 'معرّف المحادثة مطلوب.' }, { status: 400 })

    const access = await getAuthenticatedRoom(supabase, roomId, userData.user.id)
    if ('error' in access) return access.error

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      return handleMultipart(request, supabase, roomId, userData.user.id)
    }

    const payload = await request.json() as {
      body?: string
      messageType?: MessageType
      metadata?: Record<string, unknown>
    }

    const messageType = payload.messageType || 'text'

    if (!['text', 'image', 'offer', 'system'].includes(messageType)) {
      return NextResponse.json({ error: 'نوع الرسالة غير مدعوم.' }, { status: 400 })
    }

    if (messageType === 'offer') {
      const metadata = payload.metadata || {}
      const amount = Number(metadata.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'قيمة العرض غير صحيحة.' }, { status: 400 })
      }

      const note = typeof metadata.note === 'string' ? metadata.note.trim().slice(0, 1000) : ''
      const currency = typeof metadata.currency === 'string' && /^[A-Z]{3}$/.test(metadata.currency)
        ? metadata.currency
        : 'EGP'

      const result = await insertMessage(
        request,
        supabase,
        roomId,
        userData.user.id,
        'offer',
        note || 'عرض سعر',
        {
          kind: 'offer',
          amount,
          currency,
          note: note || 'عرض سعر مرتبط بالمحادثة',
          title: 'عرض سعر من البائع',
        },
      )

      if (result.error) return result.error
      return NextResponse.json({ message: result.data, riskFlags: [] }, { status: 201 })
    }

    if (messageType === 'system') {
      const metadata = payload.metadata || {}
      if (metadata.kind === 'location') {
        const location = validateLocation(metadata.location)
        if (!location) return NextResponse.json({ error: 'بيانات الموقع غير صحيحة.' }, { status: 400 })

        const result = await insertMessage(
          request,
          supabase,
          roomId,
          userData.user.id,
          'system',
          '📍 موقع مشترك',
          { kind: 'location', location },
        )
        if (result.error) return result.error
        return NextResponse.json({ message: result.data, riskFlags: [] }, { status: 201 })
      }

      if (metadata.kind === 'offer_action') {
        const action = ['accept', 'counter', 'decline'].includes(String(metadata.action))
          ? String(metadata.action)
          : ''
        if (!action) return NextResponse.json({ error: 'إجراء العرض غير صحيح.' }, { status: 400 })

        const result = await insertMessage(
          request,
          supabase,
          roomId,
          userData.user.id,
          'system',
          action === 'accept' ? '✅ تم قبول عرض السعر' : action === 'counter' ? '💰 تم طلب التفاوض' : '❌ تم رفض عرض السعر',
          {
            kind: 'offer_action',
            action,
            offerMessageId: typeof metadata.offerMessageId === 'string' ? metadata.offerMessageId : null,
          },
        )
        if (result.error) return result.error
        return NextResponse.json({ message: result.data, riskFlags: [] }, { status: 201 })
      }

      return NextResponse.json({ error: 'بيانات الرسالة النظامية غير مدعومة.' }, { status: 400 })
    }

    const message = payload.body?.trim() || ''
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'الرسالة مطلوبة وبحد أقصى 4000 حرف.' }, { status: 400 })
    }

    const result = await insertMessage(request, supabase, roomId, userData.user.id, messageType, message, payload.metadata || {})
    if (result.error) return result.error

    return NextResponse.json({ message: result.data, riskFlags: [] }, { status: 201 })
  } catch (error) {
    console.error('DEBA messages POST failed', error)
    return NextResponse.json({ error: 'تعذر إرسال الرسالة.' }, { status: 500 })
  }
}
