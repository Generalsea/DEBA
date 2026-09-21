import { NextResponse } from 'next/server'
import { getPaymentProvider } from '@/lib/payments'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type Body = {
  orderId?: string
  amount?: number
  reason?: string
  idempotencyKey?: string
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function numberValue(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const orderId = clean(body.orderId, 64)
    const reason = clean(body.reason, 500)
    const idempotencyKey =
      clean(request.headers.get('idempotency-key'), 128) ||
      clean(body.idempotencyKey, 128)

    if (!orderId || idempotencyKey.length < 16) {
      return NextResponse.json({ error: 'بيانات الاسترداد غير مكتملة.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin','moderator'])
      .limit(1)
      .maybeSingle()

    const isAdmin = Boolean(role)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,reference_code,buyer_id,status,payment_status,total,currency')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json({ error: 'الطلب غير موجود.' }, { status: 404 })
    }

    if (!isAdmin && order.buyer_id !== user.id) {
      return NextResponse.json({ error: 'لا تملك صلاحية طلب استرداد لهذا الطلب.' }, { status: 403 })
    }

    if (!['completed','disputed'].includes(order.status)) {
      return NextResponse.json(
        { error: 'الاسترداد متاح بعد اكتمال الطلب أو دخوله في مراجعة نزاع.' },
        { status: 409 },
      )
    }

    if (!['paid','partially_refunded'].includes(order.payment_status)) {
      return NextResponse.json({ error: 'لا يوجد مبلغ مدفوع قابل للاسترداد.' }, { status: 409 })
    }

    const requestedAmount = body.amount ? numberValue(body.amount) : 0
    const admin = createAdminClient()

    const { data: payment } = await admin
      .from('payments')
      .select('id,provider,status,amount,currency,provider_payment_id')
      .eq('order_id', order.id)
      .in('status', ['paid','partially_refunded'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!payment || !payment.provider_payment_id) {
      return NextResponse.json({ error: 'عملية الدفع المرتبطة بالطلب غير صالحة للاسترداد.' }, { status: 409 })
    }

    const { data: existing } = await admin
      .from('refunds')
      .select('id,status,amount,currency,provider_ref')
      .eq('payment_id', payment.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existing) return NextResponse.json({ refund: existing, existing: true })

    const { data: completedRefunds } = await admin
      .from('refunds')
      .select('amount,status')
      .eq('payment_id', payment.id)
      .in('status', ['processing','succeeded'])

    const refundedSoFar = (completedRefunds || []).reduce(
      (sum, item) => sum + numberValue(item.amount),
      0,
    )
    const remaining = Math.max(0, numberValue(payment.amount) - refundedSoFar)
    const amount = requestedAmount > 0 ? requestedAmount : remaining

    if (amount <= 0 || amount > remaining + 0.0001) {
      return NextResponse.json({ error: 'مبلغ الاسترداد يتجاوز الرصيد المتاح.' }, { status: 400 })
    }

    if (payment.provider !== 'paymob') {
      return NextResponse.json({ error: 'مزود الدفع الحالي لا يدعم الاسترداد من DEBA.' }, { status: 503 })
    }

    const { data: refund, error: refundInsertError } = await admin
      .from('refunds')
      .insert({
        payment_id: payment.id,
        order_id: order.id,
        amount,
        currency: payment.currency || order.currency || 'EGP',
        status: 'processing',
        reason: reason || 'Customer refund request',
        idempotency_key: idempotencyKey,
        created_by: user.id,
      })
      .select('id,status,amount,currency')
      .single()

    if (refundInsertError || !refund) {
      console.error('DEBA refund record creation failed', refundInsertError)
      return NextResponse.json({ error: 'تعذر إنشاء طلب الاسترداد.' }, { status: 500 })
    }

    try {
      const provider = getPaymentProvider()
      const result = await provider.refundPayment({
        transactionId: String(payment.provider_payment_id),
        amount,
      })

      const { error: updateError } = await admin
        .from('refunds')
        .update({
          status: 'processing',
          provider_ref: result.providerRefundId,
          provider_payload: result.raw,
        })
        .eq('id', refund.id)

      if (updateError) {
        console.error('DEBA refund persistence failed', updateError)
        return NextResponse.json(
          { error: 'تم إرسال طلب الاسترداد لكن تعذر حفظ مرجعه.' },
          { status: 500 },
        )
      }

      await admin.from('audit_logs').insert({
        actor_id: user.id,
        action: 'refund.requested',
        entity_type: 'refund',
        entity_id: refund.id,
        after_data: { amount, currency: payment.currency, status: 'processing' },
        metadata: { order_id: order.id, payment_id: payment.id },
      })

      await admin.from('notifications').insert({
        user_id: order.buyer_id,
        type: 'refund.updated',
        title: 'تم إرسال طلب الاسترداد',
        body: 'تم إرسال طلب استرداد المبلغ إلى مزود الدفع.',
        href: '/orders/' + order.id,
        metadata: { order_id: order.id, refund_id: refund.id },
      })

      return NextResponse.json({
        refundId: refund.id,
        status: 'processing',
        amount,
        currency: payment.currency || order.currency || 'EGP',
        referenceCode: order.reference_code,
      })
    } catch (providerError) {
      console.error('DEBA refund provider failed', providerError)
      await admin
        .from('refunds')
        .update({
          status: 'failed',
          provider_payload: {
            error:
              providerError instanceof Error
                ? providerError.message
                : 'provider_error',
          },
        })
        .eq('id', refund.id)

      return NextResponse.json(
        { error: 'تعذر إرسال الاسترداد إلى مزود الدفع.' },
        { status: 502 },
      )
    }
  } catch (error) {
    console.error('DEBA refund route failed', error)
    return NextResponse.json({ error: 'تعذر تنفيذ الاسترداد.' }, { status: 500 })
  }
}
