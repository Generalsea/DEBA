import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type OrderBody = {
  productId?: string
  quantity?: number
  deliveryMethod?: 'pickup' | 'seller_delivery' | 'platform_delivery'
  deliveryAddress?: {
    addressLine1?: string
    district?: string
    city?: string
    governorate?: string
  }
  notes?: string
  idempotencyKey?: string
}

const ALLOWED_DELIVERIES = new Set([
  'pickup',
  'seller_delivery',
  'platform_delivery',
])

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function mapOrderError(message: string) {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('authenticated buyer') ||
    normalized.includes('not allowed') ||
    normalized.includes('cannot buy your own product')
  ) {
    return { status: 403, error: 'هذا الطلب غير مسموح لهذا الحساب.' }
  }

  if (
    normalized.includes('product is not available') ||
    normalized.includes('insufficient stock') ||
    normalized.includes('stock changed')
  ) {
    return { status: 409, error: 'المنتج أو الكمية لم تعد متاحة. حدّث الصفحة وحاول مرة أخرى.' }
  }

  if (
    normalized.includes('invalid quantity') ||
    normalized.includes('invalid delivery method') ||
    normalized.includes('delivery method not available') ||
    normalized.includes('delivery address is required') ||
    normalized.includes('valid idempotency key') ||
    normalized.includes('product price is invalid')
  ) {
    return { status: 400, error: 'بيانات الطلب غير مكتملة أو غير صالحة.' }
  }

  return { status: 500, error: 'تعذر إنشاء طلب الشراء الآن.' }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    const requestOrigin = new URL(request.url).origin

    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
    }

    const body = (await request.json()) as OrderBody
    const productId = cleanText(body.productId, 64)

    if (!productId) {
      return NextResponse.json(
        { error: 'معرّف المنتج غير صالح.' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول لإتمام الطلب.' },
        { status: 401 },
      )
    }

    const requestedQuantity = Number.isInteger(body.quantity)
      ? Number(body.quantity)
      : 1

    if (requestedQuantity < 1 || requestedQuantity > 100) {
      return NextResponse.json(
        { error: 'الكمية المطلوبة غير صالحة.' },
        { status: 400 },
      )
    }

    const requestedDelivery = body.deliveryMethod || 'pickup'
    if (!ALLOWED_DELIVERIES.has(requestedDelivery)) {
      return NextResponse.json(
        { error: 'طريقة الاستلام غير صالحة.' },
        { status: 400 },
      )
    }

    const idempotencyKey =
      cleanText(request.headers.get('idempotency-key'), 128) ||
      cleanText(body.idempotencyKey, 128)

    if (idempotencyKey.length < 16) {
      return NextResponse.json(
        { error: 'تعذر تأمين الطلب. أعد المحاولة من الصفحة.' },
        { status: 400 },
      )
    }

    const deliveryAddress =
      requestedDelivery === 'pickup'
        ? {}
        : {
            address_line1: cleanText(body.deliveryAddress?.addressLine1, 180),
            district: cleanText(body.deliveryAddress?.district, 100),
            city: cleanText(body.deliveryAddress?.city, 100),
            governorate: cleanText(body.deliveryAddress?.governorate, 100),
          }

    const { data, error } = await supabase.rpc('create_fixed_price_order', {
      p_product_id: productId,
      p_quantity: requestedQuantity,
      p_delivery_method: requestedDelivery,
      p_delivery_address: deliveryAddress,
      p_notes: cleanText(body.notes, 500),
      p_idempotency_key: idempotencyKey,
    })

    if (error) {
      console.error('DEBA atomic order creation failed', error)
      const mapped = mapOrderError(error.message || '')
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'تعذر قراءة نتيجة إنشاء الطلب.' },
        { status: 500 },
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('DEBA checkout route failed', error)
    return NextResponse.json(
      { error: 'تعذر إتمام الطلب الآن.' },
      { status: 500 },
    )
  }
}
