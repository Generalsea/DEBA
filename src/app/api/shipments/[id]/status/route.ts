import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type Body = {
  status?: string
  reason?: string
  idempotencyKey?: string
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
    const status = clean(body.status, 40)
    const reason = clean(body.reason, 240)
    const idempotencyKey =
      clean(request.headers.get('idempotency-key'), 128) ||
      clean(body.idempotencyKey, 128)

    if (!id || !status || idempotencyKey.length < 16) {
      return NextResponse.json({ error: 'بيانات تحديث الشحنة غير مكتملة.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('transition_shipment_status', {
      p_shipment_id: id,
      p_new_status: status,
      p_reason: reason,
      p_idempotency_key: idempotencyKey,
    })

    if (error) {
      console.error('DEBA shipment status transition failed', error)
      if (error.message.toLowerCase().includes('not allowed')) {
        return NextResponse.json({ error: 'لا تملك صلاحية تحديث هذه الشحنة.' }, { status: 403 })
      }
      if (error.message.toLowerCase().includes('transition')) {
        return NextResponse.json({ error: 'انتقال حالة الشحنة غير مسموح.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'تعذر تحديث حالة الشحنة.' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('DEBA shipment status route failed', error)
    return NextResponse.json({ error: 'تعذر تحديث الشحنة.' }, { status: 500 })
  }
}
