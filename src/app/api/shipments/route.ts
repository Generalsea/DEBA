import { NextResponse } from 'next/server'
import { getShippingProvider } from '@/lib/shipping'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type Body = {
  orderId?: string
  serviceLevel?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
    if (!orderId) {
      return NextResponse.json({ error: 'معرّف الطلب غير صالح.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,seller_id,status,delivery_method,delivery_address_snapshot,shipping_fee')
      .eq('id', orderId)
      .eq('seller_id', user.id)
      .maybeSingle()

    if (orderError) {
      console.error('DEBA shipment order lookup failed', orderError)
      return NextResponse.json({ error: 'تعذر التحقق من الطلب.' }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'الطلب غير موجود أو لا تملك صلاحية إدارته.' }, { status: 404 })
    }

    if (order.delivery_method === 'pickup') {
      return NextResponse.json({ error: 'هذا الطلب مخصص للاستلام من البائع ولا يحتاج شحنة.' }, { status: 400 })
    }

    if (!['confirmed','processing','ready'].includes(order.status)) {
      return NextResponse.json({ error: 'لا يمكن إنشاء الشحنة في حالة الطلب الحالية.' }, { status: 409 })
    }

    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('shipments')
      .select('id,status,tracking_number,provider')
      .eq('order_id', order.id)
      .maybeSingle()

    if (existing) return NextResponse.json({ shipment: existing, existing: true })

    const provider = getShippingProvider()
    const serviceLevel =
      typeof body.serviceLevel === 'string' && body.serviceLevel.trim()
        ? body.serviceLevel.trim().slice(0, 40)
        : 'standard'

    const { data: shipment, error: shipmentError } = await admin
      .from('shipments')
      .insert({
        order_id: order.id,
        provider: provider.name,
        service_level: serviceLevel,
        status: 'pending',
        shipping_fee: Number(order.shipping_fee || 0),
        delivery_address_snapshot: order.delivery_address_snapshot || {},
      })
      .select('id,status,provider,service_level,tracking_number,created_at')
      .single()

    if (shipmentError || !shipment) {
      if (shipmentError?.code === '23505') {
        const { data: duplicate } = await admin
          .from('shipments')
          .select('id,status,tracking_number,provider')
          .eq('order_id', order.id)
          .maybeSingle()
        if (duplicate) return NextResponse.json({ shipment: duplicate, existing: true })
      }

      console.error('DEBA shipment creation failed', shipmentError)
      return NextResponse.json({ error: 'تعذر إنشاء الشحنة.' }, { status: 500 })
    }

    await admin.from('shipment_events').insert({
      shipment_id: shipment.id,
      event_code: 'created',
      status: 'pending',
      description: 'تم إنشاء الشحنة داخل DEBA.',
      payload: { provider: provider.name, source: 'deba' },
    })

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'shipment.created',
      entity_type: 'shipment',
      entity_id: shipment.id,
      after_data: shipment,
      metadata: { order_id: order.id },
    })

    await admin.from('notifications').insert({
      user_id: (
        await admin.from('orders').select('buyer_id').eq('id', order.id).single()
      ).data?.buyer_id,
      type: 'shipment.created',
      title: 'تم إنشاء الشحنة',
      body: 'تم تجهيز الشحنة الخاصة بطلبك.',
      href: '/orders/' + order.id,
      metadata: { order_id: order.id, shipment_id: shipment.id },
    })

    return NextResponse.json({ shipment, existing: false })
  } catch (error) {
    console.error('DEBA shipment route failed', error)
    return NextResponse.json({ error: 'تعذر إنشاء الشحنة الآن.' }, { status: 500 })
  }
}
