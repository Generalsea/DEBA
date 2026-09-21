import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type Body = {
  orderId?: string
  category?: string
  subject?: string
  description?: string
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

const CATEGORIES = new Set([
  'not_received',
  'not_as_described',
  'damaged',
  'wrong_item',
  'seller_issue',
  'delivery_issue',
  'payment_issue',
  'other',
])

export async function GET(request: Request) {
  try {
    const orderId = clean(new URL(request.url).searchParams.get('orderId'), 64)
    if (!orderId) {
      return NextResponse.json({ error: 'معرّف الطلب غير صالح.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const { data: dispute, error } = await supabase
      .from('disputes')
      .select('id,order_id,raised_by,category,subject,description,status,priority,resolution_code,resolution_note,resolved_at,created_at,updated_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('DEBA disputes lookup failed', error)
      return NextResponse.json({ error: 'تعذر تحميل حالة المراجعة.' }, { status: 500 })
    }

    if (!dispute) return NextResponse.json({ dispute: null, messages: [] })

    const { data: messages, error: messagesError } = await supabase
      .from('dispute_messages')
      .select('id,author_id,body,is_internal,created_at')
      .eq('dispute_id', dispute.id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('DEBA dispute messages lookup failed', messagesError)
      return NextResponse.json({ error: 'تعذر تحميل رسائل المراجعة.' }, { status: 500 })
    }

    return NextResponse.json({
      dispute,
      messages: (messages || []).filter((message) => !message.is_internal),
    })
  } catch (error) {
    console.error('DEBA disputes GET failed', error)
    return NextResponse.json({ error: 'تعذر تحميل المراجعة.' }, { status: 500 })
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
    const orderId = clean(body.orderId, 64)
    const category = clean(body.category, 40)
    const subject = clean(body.subject, 180)
    const description = clean(body.description, 4000)

    if (
      !orderId ||
      !CATEGORIES.has(category) ||
      subject.length < 4 ||
      description.length < 10
    ) {
      return NextResponse.json({ error: 'بيانات المراجعة غير مكتملة.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('create_dispute', {
      p_order_id: orderId,
      p_category: category,
      p_subject: subject,
      p_description: description,
    })

    if (error) {
      console.error('DEBA dispute creation failed', error)
      const value = error.message.toLowerCase()
      if (value.includes('order not found')) {
        return NextResponse.json({ error: 'الطلب غير موجود.' }, { status: 404 })
      }
      if (value.includes('cannot be disputed') || value.includes('required')) {
        return NextResponse.json({ error: 'لا يمكن فتح مراجعة لهذا الطلب بالحالة الحالية.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'تعذر فتح المراجعة.' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('DEBA disputes POST failed', error)
    return NextResponse.json({ error: 'تعذر فتح المراجعة.' }, { status: 500 })
  }
}
