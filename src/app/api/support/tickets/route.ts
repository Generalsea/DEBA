import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type Body = {
  orderId?: string
  category?: string
  subject?: string
  description?: string
}

const CATEGORIES = new Set([
  'order',
  'payment',
  'shipping',
  'account',
  'product',
  'security',
  'other',
])

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { data, error } = await supabase
      .from('support_tickets')
      .select(
        'id,order_id,category,subject,description,status,priority,last_response_at,resolved_at,created_at,updated_at',
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('DEBA support ticket list failed', error)
      return NextResponse.json({ error: 'تعذر تحميل تذاكر الدعم.' }, { status: 500 })
    }

    return NextResponse.json({ tickets: data || [] })
  } catch (error) {
    console.error('DEBA support GET failed', error)
    return NextResponse.json({ error: 'تعذر تحميل تذاكر الدعم.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    const requestOrigin = new URL(request.url).origin
    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
    }

    const body = (await request.json()) as Body
    const orderId = clean(body.orderId, 64) || null
    const category = clean(body.category, 30)
    const subject = clean(body.subject, 180)
    const description = clean(body.description, 4000)

    if (
      !CATEGORIES.has(category) ||
      subject.length < 4 ||
      description.length < 10
    ) {
      return NextResponse.json({ error: 'بيانات التذكرة غير مكتملة.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    if (orderId) {
      const { data: order, error } = await supabase
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .or('buyer_id.eq.' + user.id + ',seller_id.eq.' + user.id)
        .maybeSingle()

      if (error || !order) {
        return NextResponse.json({ error: 'الطلب المرتبط غير متاح لهذا الحساب.' }, { status: 403 })
      }
    }

    const admin = createAdminClient()
    const { data: ticket, error } = await admin
      .from('support_tickets')
      .insert({
        user_id: user.id,
        order_id: orderId,
        category,
        subject,
        description,
        status: 'open',
        priority: category === 'security' || category === 'payment' ? 'high' : 'normal',
      })
      .select('id,order_id,category,subject,description,status,priority,created_at,updated_at')
      .single()

    if (error || !ticket) {
      console.error('DEBA support ticket creation failed', error)
      return NextResponse.json({ error: 'تعذر إنشاء تذكرة الدعم.' }, { status: 500 })
    }

    await admin.from('support_messages').insert({
      ticket_id: ticket.id,
      author_id: user.id,
      body: description,
      is_internal: false,
    })

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'support.ticket_created',
      entity_type: 'support_ticket',
      entity_id: ticket.id,
      after_data: ticket,
      metadata: { order_id: orderId },
    })

    return NextResponse.json({ ticket })
  } catch (error) {
    console.error('DEBA support POST failed', error)
    return NextResponse.json({ error: 'تعذر إنشاء تذكرة الدعم.' }, { status: 500 })
  }
}
