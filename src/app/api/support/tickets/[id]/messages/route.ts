import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type Body = { body?: string }

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id,user_id,status')
      .eq('id', id)
      .maybeSingle()

    if (ticketError || !ticket || ticket.user_id !== userData.user.id) {
      return NextResponse.json({ error: 'التذكرة غير موجودة.' }, { status: 404 })
    }

    const { data: messages, error } = await supabase
      .from('support_messages')
      .select('id,author_id,body,is_internal,created_at')
      .eq('ticket_id', id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('DEBA support message list failed', error)
      return NextResponse.json({ error: 'تعذر تحميل رسائل الدعم.' }, { status: 500 })
    }

    return NextResponse.json({ messages: messages || [], status: ticket.status })
  } catch (error) {
    console.error('DEBA support messages GET failed', error)
    return NextResponse.json({ error: 'تعذر تحميل رسائل الدعم.' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await request.json()) as Body
    const message = clean(body.body, 4000)

    if (!message) return NextResponse.json({ error: 'اكتب رسالة صالحة.' }, { status: 400 })

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id,user_id,status')
      .eq('id', id)
      .maybeSingle()

    if (ticketError || !ticket || ticket.user_id !== user.id) {
      return NextResponse.json({ error: 'التذكرة غير موجودة.' }, { status: 404 })
    }

    if (['closed','resolved'].includes(ticket.status)) {
      return NextResponse.json({ error: 'هذه التذكرة مغلقة أمام الرسائل الجديدة.' }, { status: 409 })
    }

    const { data: inserted, error } = await supabase
      .from('support_messages')
      .insert({
        ticket_id: id,
        author_id: user.id,
        body: message,
        is_internal: false,
      })
      .select('id,author_id,body,is_internal,created_at')
      .single()

    if (error || !inserted) {
      console.error('DEBA support message insert failed', error)
      return NextResponse.json({ error: 'تعذر إرسال الرسالة.' }, { status: 500 })
    }

    const admin = createAdminClient()
    await admin
      .from('support_tickets')
      .update({
        last_response_at: new Date().toISOString(),
        status: 'open',
      })
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ message: inserted })
  } catch (error) {
    console.error('DEBA support messages POST failed', error)
    return NextResponse.json({ error: 'تعذر إرسال الرسالة.' }, { status: 500 })
  }
}
