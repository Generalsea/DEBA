import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type Body = {
  body?: string
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await request.json()) as Body
    const message = clean(body.body, 4000)

    if (!id || message.length < 2) {
      return NextResponse.json({ error: 'اكتب رسالة صالحة.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('id,order_id,raised_by,status')
      .eq('id', id)
      .maybeSingle()

    if (disputeError || !dispute) {
      return NextResponse.json({ error: 'المراجعة غير موجودة.' }, { status: 404 })
    }

    const { data: order } = await supabase
      .from('orders')
      .select('buyer_id,seller_id')
      .eq('id', dispute.order_id)
      .maybeSingle()

    if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
      return NextResponse.json({ error: 'لا تملك صلاحية الرد.' }, { status: 403 })
    }

    if (['closed','resolved_buyer','resolved_seller'].includes(dispute.status)) {
      return NextResponse.json({ error: 'هذه المراجعة مغلقة أمام الردود الجديدة.' }, { status: 409 })
    }

    const { data: inserted, error } = await supabase
      .from('dispute_messages')
      .insert({
        dispute_id: id,
        author_id: user.id,
        body: message,
        is_internal: false,
      })
      .select('id,author_id,body,is_internal,created_at')
      .single()

    if (error || !inserted) {
      console.error('DEBA dispute message insert failed', error)
      return NextResponse.json({ error: 'تعذر إرسال الرسالة.' }, { status: 500 })
    }

    if (dispute.status === 'open' && user.id !== dispute.raised_by) {
      const admin = createAdminClient()
      await admin
        .from('disputes')
        .update({ status: 'under_review' })
        .eq('id', id)
        .eq('status', 'open')
    }

    const admin = createAdminClient()
    const recipientId =
      user.id === order.buyer_id ? order.seller_id : order.buyer_id

    await admin.from('notifications').insert({
      user_id: recipientId,
      type: 'dispute.message',
      title: 'رسالة جديدة في مراجعة الطلب',
      body: 'تمت إضافة رسالة جديدة إلى المراجعة المرتبطة بطلبك.',
      href: '/orders/' + dispute.order_id,
      metadata: { dispute_id: id, order_id: dispute.order_id },
    })

    return NextResponse.json({ message: inserted })
  } catch (error) {
    console.error('DEBA dispute message route failed', error)
    return NextResponse.json({ error: 'تعذر إرسال الرسالة.' }, { status: 500 })
  }
}
