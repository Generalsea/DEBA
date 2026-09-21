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

function mapError(message: string) {
  const value = message.toLowerCase()

  if (value.includes('not allowed') || value.includes('cannot') || value.includes('required')) {
    return { status: 403, error: 'لا تملك صلاحية تنفيذ هذه العملية.' }
  }

  if (value.includes('invalid order status') || value.includes('transition')) {
    return { status: 409, error: 'انتقال حالة الطلب غير مسموح في وضعه الحالي.' }
  }

  if (value.includes('order not found')) {
    return { status: 404, error: 'الطلب غير موجود.' }
  }

  if (value.includes('idempotency')) {
    return { status: 400, error: 'مرجعية العملية غير صالحة.' }
  }

  return { status: 500, error: 'تعذر تحديث حالة الطلب.' }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const origin = request.headers.get('origin')
    const requestOrigin = new URL(request.url).origin
    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
    }

    const { id } = await params
    const body = (await request.json()) as Body
    const status = clean(body.status, 32)
    const reason = clean(body.reason, 240)
    const idempotencyKey =
      clean(request.headers.get('idempotency-key'), 128) ||
      clean(body.idempotencyKey, 128)

    if (!id || !status || idempotencyKey.length < 16) {
      return NextResponse.json(
        { error: 'بيانات تحديث الطلب غير مكتملة.' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('transition_order_status', {
      p_order_id: id,
      p_new_status: status,
      p_reason: reason,
      p_idempotency_key: idempotencyKey,
    })

    if (error) {
      console.error('DEBA order transition failed', error)
      const mapped = mapError(error.message || '')
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('DEBA order status route failed', error)
    return NextResponse.json(
      { error: 'تعذر تحديث حالة الطلب.' },
      { status: 500 },
    )
  }
}
