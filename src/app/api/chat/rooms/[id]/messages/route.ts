import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const { id: roomId } = await context.params
    if (!roomId) {
      return NextResponse.json({ error: 'معرّف المحادثة مطلوب.' }, { status: 400 })
    }

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

    return NextResponse.json({
      messages: (data || []).reverse(),
    })
  } catch (error) {
    console.error('DEBA messages GET failed', error)
    return NextResponse.json({ error: 'تعذر تحميل الرسائل.' }, { status: 500 })
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const { id: roomId } = await context.params
    const body = (await request.json()) as { body?: string; messageType?: string }
    const message = body.body?.trim() || ''

    if (!message || message.length > 4000) {
      return NextResponse.json(
        { error: 'الرسالة مطلوبة وبحد أقصى 4000 حرف.' },
        { status: 400 },
      )
    }

    const messageType = body.messageType?.trim() || 'text'
    if (!['text'].includes(messageType)) {
      return NextResponse.json({ error: 'نوع الرسالة غير مدعوم.' }, { status: 400 })
    }

    const riskFlags = [
      /(?:01|\+?20)\d[\d\s-]{8,}/.test(message) ? 'phone' : null,
      /[\w.+-]+@[\w-]+\.[\w.-]+/.test(message) ? 'email' : null,
      /https?:\/\//i.test(message) ? 'url' : null,
    ].filter(Boolean)

    const { data, error } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        sender_id: userData.user.id,
        message_type: messageType,
        body: message,
        metadata: { risk_flags: riskFlags },
      })
      .select('id,room_id,sender_id,message_type,body,metadata,created_at')
      .single()

    if (error) {
      console.error('DEBA message send failed', error)
      return NextResponse.json({ error: 'تعذر إرسال الرسالة.' }, { status: 403 })
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
        .eq('user_id', userData.user.id)
        .maybeSingle()
      await supabase.from('chat_security_events').insert({
        room_id: roomId,
        message_id: data?.id || null,
        user_id: userData.user.id,
        ip_address: clientIp,
        mac_address: null,
        email_snapshot: userData.user.email || null,
        phone_snapshot: privateProfile?.phone || null,
        user_agent: request.headers.get('user-agent'),
        accept_language: request.headers.get('accept-language'),
        metadata: { risk_flags: riskFlags },
      })
    } catch (auditError) {
      console.error('DEBA chat security audit failed', auditError)
    }

    return NextResponse.json({ message: data, riskFlags }, { status: 201 })
  } catch (error) {
    console.error('DEBA messages POST failed', error)
    return NextResponse.json({ error: 'تعذر إرسال الرسالة.' }, { status: 500 })
  }
}
