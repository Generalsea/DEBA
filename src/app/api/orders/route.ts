import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

type OrderBody = {
  productId?: string
  deliveryMethod?: 'pickup' | 'seller_delivery' | 'platform_delivery'
  deliveryAddress?: {
    addressLine1?: string
    district?: string
    city?: string
    governorate?: string
  }
  notes?: string
}

const ALLOWED_DELIVERIES = new Set([
  'pickup',
  'seller_delivery',
  'platform_delivery',
])

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function allowedDeliveryMethods(productMethod: string) {
  if (productMethod === 'both') return ['pickup', 'seller_delivery']
  if (productMethod === 'pickup') return ['pickup']
  if (productMethod === 'seller_delivery') return ['seller_delivery']
  if (productMethod === 'platform_delivery') return ['platform_delivery']
  return []
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
      return NextResponse.json({ error: 'معرّف المنتج غير صالح.' }, { status: 400 })
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

    const requestedDelivery = body.deliveryMethod || 'pickup'

    if (!ALLOWED_DELIVERIES.has(requestedDelivery)) {
      return NextResponse.json(
        { error: 'طريقة الاستلام غير صالحة.' },
        { status: 400 },
      )
    }

    const addressLine1 = cleanText(body.deliveryAddress?.addressLine1, 180)
    const district = cleanText(body.deliveryAddress?.district, 100)
    const city = cleanText(body.deliveryAddress?.city, 100)
    const governorate = cleanText(body.deliveryAddress?.governorate, 100)
    const notes = cleanText(body.notes, 500)

    const admin = createAdminClient()

    const { data: product, error: productError } = await admin
      .from('products')
      .select(
        'id,owner_id,title,listing_type,status,moderation_status,price,currency,quantity,delivery_method',
      )
      .eq('id', productId)
      .eq('status', 'published')
      .eq('moderation_status', 'approved')
      .in('listing_type', ['sale', 'free'])
      .maybeSingle()

    if (productError) {
      console.error('DEBA checkout product lookup failed', productError)
      return NextResponse.json(
        { error: 'تعذر التحقق من توفر المنتج.' },
        { status: 500 },
      )
    }

    if (!product) {
      return NextResponse.json(
        { error: 'المنتج لم يعد متاحًا للشراء.' },
        { status: 409 },
      )
    }

    if (!product.owner_id || product.owner_id === user.id) {
      return NextResponse.json(
        { error: 'لا يمكنك شراء إعلانك الخاص.' },
        { status: 403 },
      )
    }

    if (product.quantity < 1) {
      return NextResponse.json(
        { error: 'المنتج نفد حاليًا.' },
        { status: 409 },
      )
    }

    const allowed = allowedDeliveryMethods(product.delivery_method)
    if (!allowed.includes(requestedDelivery)) {
      return NextResponse.json(
        { error: 'طريقة الاستلام المختارة غير متاحة لهذا الإعلان.' },
        { status: 400 },
      )
    }

    const requiresAddress = requestedDelivery !== 'pickup'
    if (requiresAddress && (!addressLine1 || !city || !governorate)) {
      return NextResponse.json(
        { error: 'أكمل عنوان الاستلام قبل تأكيد الطلب.' },
        { status: 400 },
      )
    }

    const { data: existingOrder, error: existingOrderError } = await admin
      .from('orders')
      .select('id,status')
      .eq('product_id', product.id)
      .eq('buyer_id', user.id)
      .in('status', ['pending', 'confirmed', 'processing', 'ready'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingOrderError) {
      console.error('DEBA existing order lookup failed', existingOrderError)
      return NextResponse.json(
        { error: 'تعذر التحقق من الطلبات السابقة.' },
        { status: 500 },
      )
    }

    if (existingOrder) {
      return NextResponse.json({
        orderId: existingOrder.id,
        existing: true,
      })
    }

    const numericPrice =
      typeof product.price === 'number'
        ? product.price
        : Number(product.price ?? 0)

    const unitPrice =
      product.listing_type === 'free' || !Number.isFinite(numericPrice)
        ? 0
        : numericPrice

    const orderAddress =
      requestedDelivery === 'pickup'
        ? {}
        : {
            address_line1: addressLine1,
            district,
            city,
            governorate,
          }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: product.owner_id,
        product_id: product.id,
        status: 'pending',
        payment_status: 'unpaid',
        fulfillment_status: 'pending',
        subtotal: unitPrice,
        shipping_fee: 0,
        platform_fee: 0,
        total: unitPrice,
        currency: product.currency || 'EGP',
        delivery_method: requestedDelivery,
        delivery_address_snapshot: orderAddress,
        notes,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      console.error('DEBA order creation failed', orderError)
      return NextResponse.json(
        { error: 'تعذر إنشاء طلب الشراء.' },
        { status: 500 },
      )
    }

    const { error: itemError } = await admin.from('order_items').insert({
      order_id: order.id,
      product_id: product.id,
      seller_id: product.owner_id,
      quantity: 1,
      unit_price: unitPrice,
      line_total: unitPrice,
    })

    if (itemError) {
      console.error('DEBA order item creation failed', itemError)
      await admin.from('orders').delete().eq('id', order.id)
      return NextResponse.json(
        { error: 'تعذر حفظ تفاصيل الطلب.' },
        { status: 500 },
      )
    }

    const nextQuantity = product.quantity - 1
    const nextStatus = nextQuantity === 0 ? 'reserved' : 'published'

    const { data: updatedProduct, error: reserveError } = await admin
      .from('products')
      .update({
        quantity: nextQuantity,
        status: nextStatus,
      })
      .eq('id', product.id)
      .eq('status', 'published')
      .gte('quantity', 1)
      .select('id,quantity,status')
      .maybeSingle()

    if (reserveError || !updatedProduct) {
      console.error('DEBA product reservation failed', reserveError)
      await admin.from('order_items').delete().eq('order_id', order.id)
      await admin.from('orders').delete().eq('id', order.id)
      return NextResponse.json(
        { error: 'تغيّرت حالة المنتج أثناء الطلب. حدّث الصفحة وحاول مرة أخرى.' },
        { status: 409 },
      )
    }

    return NextResponse.json({
      orderId: order.id,
      existing: false,
    })
  } catch (error) {
    console.error('DEBA checkout route failed', error)
    return NextResponse.json(
      { error: 'تعذر إتمام الطلب الآن.' },
      { status: 500 },
    )
  }
}
