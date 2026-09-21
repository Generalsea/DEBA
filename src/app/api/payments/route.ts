import { NextResponse } from 'next/server'
import { getPaymentProvider, PaymobProvider } from '@/lib/payments'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type PaymentBody = {
  orderId?: string
  idempotencyKey?: string
}

type OrderRow = {
  id: string
  reference_code: string
  buyer_id: string
  seller_id: string
  status: string
  payment_status: string
  total: number | string
  currency: string
  delivery_address_snapshot: Record<string, unknown>
  created_at: string
}

type ItemRow = {
  product_id: string
  quantity: number
  unit_price: number | string
  line_total: number | string
}

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function money(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  const firstName = parts.shift() || 'DEBA'
  const lastName = parts.join(' ') || 'Customer'
  return { firstName, lastName }
}

function configuredSiteUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured && /^https?:\/\//i.test(configured) && !configured.includes('your-vercel-domain')) {
    return configured.replace(/\/$/, '')
  }
  return new URL(request.url).origin
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    const requestOrigin = new URL(request.url).origin

    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
    }

    const body = (await request.json()) as PaymentBody
    const orderId = cleanText(body.orderId, 64)
    const idempotencyKey =
      cleanText(request.headers.get('idempotency-key'), 128) ||
      cleanText(body.idempotencyKey, 128)

    if (!orderId || idempotencyKey.length < 16) {
      return NextResponse.json(
        { error: 'بيانات الدفع غير مكتملة.' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول للدفع.' },
        { status: 401 },
      )
    }

    const admin = createAdminClient()

    const [{ data: order, error: orderError }, { data: items, error: itemsError }, { data: profile, error: profileError }, { data: privateProfile, error: privateError }] =
      await Promise.all([
        supabase
          .from('orders')
          .select(
            'id,reference_code,buyer_id,seller_id,status,payment_status,total,currency,delivery_address_snapshot,created_at',
          )
          .eq('id', orderId)
          .eq('buyer_id', user.id)
          .maybeSingle(),
        supabase
          .from('order_items')
          .select('product_id,quantity,unit_price,line_total')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('display_name,city,governorate')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('profile_private')
          .select('phone,address_line1,address_line2,district,postal_code')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])

    if (orderError || itemsError || profileError || privateError) {
      console.error('DEBA payment context lookup failed', {
        orderError,
        itemsError,
        profileError,
        privateError,
      })
      return NextResponse.json(
        { error: 'تعذر تحميل بيانات الدفع.' },
        { status: 500 },
      )
    }

    if (!order) {
      return NextResponse.json(
        { error: 'الطلب غير موجود أو غير متاح لحسابك.' },
        { status: 404 },
      )
    }

    const { data: risk } = await admin
      .from('risk_assessments')
      .select('id,score,level,status,reasons,model_version')
      .eq('order_id', order.id)
      .maybeSingle()

    if (risk?.status === 'blocked') {
      return NextResponse.json(
        { error: 'عملية الدفع موقوفة بعد مراجعة أمنية لهذا الطلب.' },
        { status: 403 },
      )
    }

    if (risk?.level === 'high' && risk.status === 'pending') {
      return NextResponse.json(
        {
          error:
            'هذا الطلب يحتاج مراجعة أمنية قبل بدء الدفع. يرجى الانتظار حتى اعتماد العملية.',
          riskReviewRequired: true,
        },
        { status: 409 },
      )
    }

    if (order.status === 'cancelled' || order.status === 'refunded') {
      return NextResponse.json(
        { error: 'لا يمكن الدفع لهذا الطلب في حالته الحالية.' },
        { status: 409 },
      )
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({
        status: 'paid',
        orderId: order.id,
        referenceCode: order.reference_code,
      })
    }

    const total = money(order.total)
    if (total <= 0) {
      return NextResponse.json(
        { error: 'إجمالي الطلب غير صالح للدفع.' },
        { status: 409 },
      )
    }

    const phone = cleanText(privateProfile?.phone, 30) || cleanText(user.phone, 30)
    if (!phone) {
      return NextResponse.json(
        {
          error:
            'أضف رقم الهاتف إلى بيانات الحساب أولًا حتى يمكن إنشاء عملية الدفع.',
        },
        { status: 400 },
      )
    }

    const name = splitName(
      cleanText(profile?.display_name, 100) || user.email?.split('@')[0] || 'DEBA',
    )

    const productIds = ((items || []) as ItemRow[]).map((item) => item.product_id)
    const { data: products } = productIds.length
      ? await supabase
          .from('products')
          .select('id,title')
          .in('id', productIds)
      : { data: [] as { id: string; title: string }[] }

    const productMap = new Map(
      (products || []).map((product) => [product.id, product.title]),
    )

    const provider = getPaymentProvider()
    if (provider instanceof PaymobProvider && !provider.isConfigured()) {
      return NextResponse.json(
        {
          error:
            'بوابة الدفع غير مفعّلة حاليًا. أضف مفاتيح Paymob إلى بيئة الخادم قبل تفعيل الدفع الإلكتروني.',
        },
        { status: 503 },
      )
    }

    const { data: existingPayment } = await admin
      .from('payments')
      .select('id,status,checkout_url,provider_payment_id,provider_order_id')
      .eq('order_id', order.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existingPayment) {
      if (existingPayment.checkout_url && existingPayment.status !== 'failed') {
        return NextResponse.json({
          paymentId: existingPayment.id,
          checkoutUrl: existingPayment.checkout_url,
          status: existingPayment.status,
        })
      }

      return NextResponse.json(
        { error: 'محاولة الدفع السابقة بهذه المرجعية لم تعد صالحة. أعد المحاولة.' },
        { status: 409 },
      )
    }

    const { data: payment, error: paymentInsertError } = await admin
      .from('payments')
      .insert({
        order_id: order.id,
        provider: provider.name,
        status: 'pending',
        amount: total,
        currency: order.currency || 'EGP',
        idempotency_key: idempotencyKey,
      })
      .select('id,status')
      .single()

    if (paymentInsertError || !payment) {
      if (paymentInsertError?.code === '23505') {
        const { data: duplicatePayment } = await admin
          .from('payments')
          .select('id,status,checkout_url')
          .eq('order_id', order.id)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle()

        if (duplicatePayment?.checkout_url) {
          return NextResponse.json({
            paymentId: duplicatePayment.id,
            checkoutUrl: duplicatePayment.checkout_url,
            status: duplicatePayment.status,
          })
        }
      }

      console.error('DEBA payment record creation failed', paymentInsertError)
      return NextResponse.json(
        { error: 'تعذر إنشاء سجل الدفع.' },
        { status: 500 },
      )
    }

    const { data: attempt, error: attemptError } = await admin
      .from('payment_attempts')
      .insert({
        payment_id: payment.id,
        provider: provider.name,
        status: 'processing',
        idempotency_key: idempotencyKey,
        request_payload: {
          order_id: order.id,
          amount: total,
          currency: order.currency || 'EGP',
        },
      })
      .select('id')
      .single()

    if (attemptError || !attempt) {
      await admin.from('payments').delete().eq('id', payment.id)
      console.error('DEBA payment attempt creation failed', attemptError)
      return NextResponse.json(
        { error: 'تعذر تجهيز محاولة الدفع.' },
        { status: 500 },
      )
    }

    try {
      const result = await provider.createPaymentIntent({
        orderId: order.id,
        referenceCode: order.reference_code,
        amount: total,
        currency: order.currency || 'EGP',
        items: ((items || []) as ItemRow[]).map((item) => ({
          name: productMap.get(item.product_id) || 'DEBA product',
          amount: money(item.unit_price),
          quantity: item.quantity,
        })),
        customer: {
          firstName: name.firstName,
          lastName: name.lastName,
          email: user.email || 'customer@deba.local',
          phone,
          city:
            cleanText(privateProfile?.district, 50) ||
            cleanText(privateProfile?.address_line1, 50) ||
            cleanText(profile?.city, 50) ||
            'Cairo',
          state: cleanText(profile?.governorate, 50) || 'Cairo',
          street:
            [privateProfile?.address_line1, privateProfile?.address_line2]
              .map((value) => cleanText(value, 120))
              .filter(Boolean)
              .join(', ') || 'DEBA marketplace',
          country: 'EG',
        },
        callbackBaseUrl: configuredSiteUrl(request),
      })

      const { error: paymentUpdateError } = await admin
        .from('payments')
        .update({
          status: 'requires_action',
          provider_payment_id: result.providerPaymentId,
          provider_order_id: result.providerOrderId,
          client_secret: result.clientSecret,
          checkout_url: result.checkoutUrl,
          provider_payload: result.raw,
        })
        .eq('id', payment.id)

      const { error: attemptUpdateError } = await admin
        .from('payment_attempts')
        .update({
          status: 'succeeded',
          provider_transaction_id: result.providerPaymentId,
          response_payload: result.raw,
        })
        .eq('id', attempt.id)

      if (paymentUpdateError || attemptUpdateError) {
        console.error('DEBA payment persistence failed', {
          paymentUpdateError,
          attemptUpdateError,
        })
        return NextResponse.json(
          { error: 'تم إنشاء عملية الدفع لكن تعذر حفظ تفاصيلها. أعد المحاولة.' },
          { status: 500 },
        )
      }

      return NextResponse.json({
        paymentId: payment.id,
        checkoutUrl: result.checkoutUrl,
        status: 'requires_action',
        referenceCode: order.reference_code,
      })
    } catch (providerError) {
      console.error('DEBA payment provider failed', providerError)

      await admin
        .from('payments')
        .update({ status: 'failed', failed_at: new Date().toISOString() })
        .eq('id', payment.id)

      await admin
        .from('payment_attempts')
        .update({
          status: 'failed',
          failure_message:
            providerError instanceof Error ? providerError.message : 'provider_error',
        })
        .eq('id', attempt.id)

      const message =
        providerError instanceof Error ? providerError.message : ''

      if (message === 'PAYMOB_NOT_CONFIGURED') {
        return NextResponse.json(
          { error: 'بوابة Paymob غير مهيأة على الخادم.' },
          { status: 503 },
        )
      }

      return NextResponse.json(
        { error: 'تعذر إنشاء جلسة الدفع الآن. لم يتم خصم أي مبلغ من الحساب.' },
        { status: 502 },
      )
    }
  } catch (error) {
    console.error('DEBA payment route failed', error)
    return NextResponse.json(
      { error: 'تعذر بدء عملية الدفع الآن.' },
      { status: 500 },
    )
  }
}
