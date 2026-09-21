import { NextResponse } from 'next/server'
import { getPaymentProvider, PaymobProvider } from '@/lib/payments'
import { createAdminClient } from '@/utils/supabase/admin'

type PaymobWebhookBody = {
  type?: string
  obj?: Record<string, unknown>
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value)
}

export async function POST(request: Request) {
  try {
    const raw = await request.text()
    let body: PaymobWebhookBody

    try {
      body = JSON.parse(raw) as PaymobWebhookBody
    } catch {
      return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 })
    }

    const receivedHmac = new URL(request.url).searchParams.get('hmac') || ''
    const provider = getPaymentProvider()

    if (!(provider instanceof PaymobProvider)) {
      return NextResponse.json({ error: 'Unsupported provider.' }, { status: 503 })
    }

    const admin = createAdminClient()
    const obj = body.obj

    if (!obj) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const externalEventId = stringValue(obj.id)
    if (!externalEventId) {
      return NextResponse.json({ error: 'Missing event id.' }, { status: 400 })
    }

    const isValid = provider.verifyTransactionWebhook(body, receivedHmac)

    const eventType =
      typeof body.type === 'string' && body.type.trim()
        ? body.type.trim()
        : 'TRANSACTION'

    const { data: insertedWebhook, error: webhookInsertError } = await admin
      .from('payment_webhooks')
      .insert({
        provider: provider.name,
        external_event_id: externalEventId,
        event_type: eventType,
        signature_valid: isValid,
        processing_status: isValid ? 'received' : 'ignored',
        payload: body,
      })
      .select('id')
      .maybeSingle()

    if (webhookInsertError?.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
    }

    if (webhookInsertError || !insertedWebhook) {
      console.error('DEBA Paymob webhook persistence failed', webhookInsertError)
      return NextResponse.json({ error: 'Webhook could not be recorded.' }, { status: 500 })
    }

    if (!isValid) {
      await admin
        .from('payment_webhooks')
        .update({
          processing_status: 'ignored',
          error_message: 'Invalid HMAC signature',
        })
        .eq('id', insertedWebhook.id)

      return NextResponse.json({ received: true }, { status: 200 })
    }

    const transaction = obj as {
      order?: { id?: string | number; merchant_order_id?: string }
      amount_cents?: number | string
      refunded_amount_cents?: number | string
    }

    const providerOrderId = stringValue(transaction.order?.id)
    const merchantReference = stringValue(transaction.order?.merchant_order_id)

    let paymentQuery = admin
      .from('payments')
      .select('id,order_id,amount,status')
      .eq('provider', provider.name)

    if (providerOrderId) {
      paymentQuery = paymentQuery.eq('provider_order_id', providerOrderId)
    }

    let { data: payment } = await paymentQuery.maybeSingle()

    if (!payment && merchantReference) {
      const { data: referencePayment } = await admin
        .from('payments')
        .select('id,order_id,amount,status')
        .eq('provider', provider.name)
        .eq('order_id', (
          await admin
            .from('orders')
            .select('id')
            .eq('reference_code', merchantReference)
            .maybeSingle()
        ).data?.id || '')
        .maybeSingle()

      payment = referencePayment
    }

    if (!payment) {
      await admin
        .from('payment_webhooks')
        .update({
          processing_status: 'failed',
          error_message: 'Payment record not found for webhook',
        })
        .eq('id', insertedWebhook.id)

      return NextResponse.json({ error: 'Payment record not found.' }, { status: 404 })
    }

    const status = provider.mapWebhookStatus(body, Number(payment.amount))
    const { error: stateError } = await admin.rpc('apply_payment_state', {
      p_payment_id: payment.id,
      p_status: status,
      p_provider_payment_id: externalEventId,
      p_provider_order_id: providerOrderId || null,
      p_provider_payload: body,
    })

    if (stateError) {
      console.error('DEBA payment state application failed', stateError)
      await admin
        .from('payment_webhooks')
        .update({
          processing_status: 'failed',
          error_message: stateError.message,
        })
        .eq('id', insertedWebhook.id)

      return NextResponse.json({ error: 'Payment state update failed.' }, { status: 500 })
    }

    if (status === 'refunded' || status === 'partially_refunded') {
      const transactionData = obj as {
        refunded_amount_cents?: number | string
      }
      const refundedCents = Number(transactionData.refunded_amount_cents || 0)

      if (refundedCents > 0) {
        const { data: refundRows } = await admin
          .from('refunds')
          .select('id,amount,status,created_at')
          .eq('payment_id', payment.id)
          .in('status', ['processing','succeeded'])
          .order('created_at', { ascending: true })

        let covered = 0
        for (const refundRow of refundRows || []) {
          if (refundRow.status === 'succeeded') {
            covered += Number(refundRow.amount || 0)
            continue
          }

          const nextCovered = covered + Number(refundRow.amount || 0)
          if (refundedCents >= Math.round(nextCovered * 100)) {
            await admin
              .from('refunds')
              .update({
                status: 'succeeded',
                provider_ref: externalEventId,
              })
              .eq('id', refundRow.id)
            covered = nextCovered
          }
        }
      }
    }

    await admin
      .from('payment_webhooks')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', insertedWebhook.id)

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('DEBA Paymob webhook failed', error)
    return NextResponse.json({ error: 'Webhook handling failed.' }, { status: 500 })
  }
}
