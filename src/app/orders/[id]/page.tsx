import { ArrowRight, CheckCircle2, Clock3, CreditCard, Package, ShieldCheck, Truck } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Header from '@/components/Header'
import OrderActions from '@/components/OrderActions'
import { createClient } from '@/utils/supabase/server'

type CategoryRow = { id: string; name_ar: string; slug: string }

type OrderRow = {
  id: string
  reference_code: string
  buyer_id: string
  seller_id: string
  product_id: string | null
  status: string
  payment_status: string
  fulfillment_status: string
  subtotal: number | string
  shipping_fee: number | string
  platform_fee: number | string
  total: number | string
  currency: string
  delivery_method: string
  delivery_address_snapshot: Record<string, unknown>
  notes: string | null
  created_at: string
  updated_at: string
}

type ItemRow = {
  id: string
  product_id: string
  quantity: number
  unit_price: number | string
  line_total: number | string
}

type HistoryRow = {
  id: string
  from_status: string | null
  to_status: string
  reason: string | null
  created_at: string
}

type PaymentRow = {
  id: string
  provider: string
  status: string
  amount: number | string
  currency: string
  provider_payment_id: string | null
  created_at: string
}

type ShipmentRow = {
  id: string
  provider: string | null
  service_level: string | null
  status: string
  tracking_number: string | null
  external_shipment_id: string | null
  created_at: string
}

type ShipmentEventRow = {
  id: string
  event_code: string
  status: string | null
  description: string | null
  occurred_at: string
}

const ORDER_LABELS: Record<string, string> = {
  pending: 'بانتظار المعالجة',
  confirmed: 'تم التأكيد',
  processing: 'قيد التجهيز',
  ready: 'جاهز للتسليم',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  refunded: 'مسترد',
  disputed: 'موضع مراجعة',
}

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'غير مدفوع',
  pending: 'قيد المعالجة',
  paid: 'مدفوع',
  failed: 'فشل الدفع',
  refunded: 'مسترد',
  partially_refunded: 'مسترد جزئيًا',
}

const FULFILLMENT_LABELS: Record<string, string> = {
  pending: 'بانتظار التنفيذ',
  preparing: 'قيد التجهيز',
  ready: 'جاهز',
  in_transit: 'قيد النقل',
  delivered: 'تم التسليم',
  confirmed: 'تم التأكيد',
  cancelled: 'ملغي',
}

const SHIPMENT_LABELS: Record<string, string> = {
  pending: 'بانتظار التجهيز',
  label_created: 'تم إنشاء البوليصة',
  ready: 'جاهز للتسليم',
  picked_up: 'تم الاستلام',
  in_transit: 'قيد النقل',
  out_for_delivery: 'خرج للتسليم',
  delivered: 'تم التسليم',
  failed: 'تعثر التسليم',
  cancelled: 'ملغي',
  returned: 'مرتجع',
}

const DELIVERY_LABELS: Record<string, string> = {
  pickup: 'استلام من البائع',
  seller_delivery: 'توصيل عبر البائع',
  platform_delivery: 'توصيل عبر DEBA',
}

function money(value: number | string, currency: string) {
  const amount = typeof value === 'number' ? value : Number(value)
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(amount) + ' ' + currency
}

function date(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub

  if (typeof userId !== 'string') {
    redirect('/login?next=' + encodeURIComponent('/orders/' + id))
  }

  const [
    { data: order, error: orderError },
    { data: categories },
    { data: items },
    { data: history },
    { data: payments },
    { data: shipment },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id,reference_code,buyer_id,seller_id,product_id,status,payment_status,fulfillment_status,subtotal,shipping_fee,platform_fee,total,currency,delivery_method,delivery_address_snapshot,notes,created_at,updated_at',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.from('categories').select('id,name_ar,slug').eq('is_active', true).order('sort_order'),
    supabase
      .from('order_items')
      .select('id,product_id,quantity,unit_price,line_total')
      .eq('order_id', id),
    supabase
      .from('order_status_history')
      .select('id,from_status,to_status,reason,created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('payments')
      .select('id,provider,status,amount,currency,provider_payment_id,created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('shipments')
      .select('id,provider,service_level,status,tracking_number,external_shipment_id,created_at')
      .eq('order_id', id)
      .maybeSingle(),
  ])

  if (orderError) {
    console.error('DEBA order page lookup failed', orderError)
    throw new Error('تعذر تحميل الطلب.')
  }

  if (!order) notFound()

  const itemRows = (items || []) as ItemRow[]
  const productIds = itemRows.map((item) => item.product_id)
  const { data: productRows } = productIds.length
    ? await supabase.from('products').select('id,title,slug').in('id', productIds)
    : { data: [] as { id: string; title: string; slug: string }[] }

  const productMap = new Map((productRows || []).map((product) => [product.id, product]))
  const shipmentRow = shipment as ShipmentRow | null
  const { data: shipmentEvents } = shipmentRow
    ? await supabase
        .from('shipment_events')
        .select('id,event_code,status,description,occurred_at')
        .eq('shipment_id', shipmentRow.id)
        .order('occurred_at', { ascending: true })
    : { data: [] as ShipmentEventRow[] }

  const categoriesForHeader = ((categories || []) as CategoryRow[]).map((category) => ({
    id: category.id,
    nameAr: category.name_ar,
    slug: category.slug,
  }))

  const isBuyer = order.buyer_id === userId
  const isSeller = order.seller_id === userId

  return (
    <>
      <Header categories={categoriesForHeader} />
      <main className="deba-order-page" dir="rtl">
        <div className="deba-order-breadcrumbs">
          <Link href="/profile?tab=orders"><ArrowRight size={15} /> طلباتي</Link>
          <span>/</span>
          <strong>{order.reference_code}</strong>
        </div>

        <section className="deba-order-hero">
          <div>
            <span>DEBA ORDER</span>
            <h1>طلب {order.reference_code}</h1>
            <p>أنشئ الطلب في {date(order.created_at)} — الحالة الحالية: <strong>{ORDER_LABELS[order.status] || order.status}</strong></p>
          </div>
          <div className="deba-order-hero-total">
            <span>الإجمالي</span>
            <strong>{money(order.total, order.currency)}</strong>
          </div>
        </section>

        <div className="deba-order-grid">
          <section className="deba-order-panel">
            <div className="deba-order-panel-head">
              <div>
                <span>ORDER TIMELINE</span>
                <h2>مسار الطلب</h2>
              </div>
              <ShieldCheck size={20} />
            </div>

            <div className="deba-order-timeline">
              {((history || []) as HistoryRow[]).map((entry) => (
                <div key={entry.id} className="deba-order-timeline-item">
                  <div className="deba-order-timeline-dot"><CheckCircle2 size={13} /></div>
                  <div>
                    <strong>{ORDER_LABELS[entry.to_status] || entry.to_status}</strong>
                    <span>{entry.reason || 'تحديث حالة الطلب'}</span>
                    <small>{date(entry.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="deba-order-panel">
            <div className="deba-order-panel-head">
              <div>
                <span>ORDER DETAILS</span>
                <h2>تفاصيل الطلب</h2>
              </div>
              <Package size={20} />
            </div>

            <div className="deba-order-metrics">
              <div><span>الحالة</span><strong>{ORDER_LABELS[order.status] || order.status}</strong></div>
              <div><span>الدفع</span><strong>{PAYMENT_LABELS[order.payment_status] || order.payment_status}</strong></div>
              <div><span>التنفيذ</span><strong>{FULFILLMENT_LABELS[order.fulfillment_status] || order.fulfillment_status}</strong></div>
              <div><span>الاستلام</span><strong>{DELIVERY_LABELS[order.delivery_method] || order.delivery_method}</strong></div>
            </div>

            <div className="deba-order-items">
              {itemRows.map((item) => {
                const product = productMap.get(item.product_id)
                return (
                  <div key={item.id} className="deba-order-item">
                    <div>
                      <strong>{product?.title || 'منتج DEBA'}</strong>
                      <span>{item.quantity.toLocaleString('ar-EG')} × {money(item.unit_price, order.currency)}</span>
                    </div>
                    <strong>{money(item.line_total, order.currency)}</strong>
                  </div>
                )
              })}
            </div>

            <div className="deba-order-totals">
              <div><span>الإجمالي الفرعي</span><strong>{money(order.subtotal, order.currency)}</strong></div>
              <div><span>الشحن</span><strong>{money(order.shipping_fee, order.currency)}</strong></div>
              <div><span>رسوم المنصة</span><strong>{money(order.platform_fee, order.currency)}</strong></div>
              <div className="total"><span>الإجمالي</span><strong>{money(order.total, order.currency)}</strong></div>
            </div>
          </section>

          <section className="deba-order-panel">
            <div className="deba-order-panel-head">
              <div>
                <span>PAYMENT</span>
                <h2>الدفع</h2>
              </div>
              <CreditCard size={20} />
            </div>
            <div className="deba-order-list">
              {((payments || []) as PaymentRow[]).length ? (
                ((payments || []) as PaymentRow[]).map((payment) => (
                  <div key={payment.id} className="deba-order-list-row">
                    <div><strong>{payment.provider.toUpperCase()}</strong><span>{date(payment.created_at)}</span></div>
                    <div><strong>{money(payment.amount, payment.currency)}</strong><span>{PAYMENT_LABELS[payment.status] || payment.status}</span></div>
                  </div>
                ))
              ) : (
                <div className="deba-order-empty">لم تبدأ عملية دفع إلكترونية لهذا الطلب بعد.</div>
              )}
            </div>
          </section>

          <section className="deba-order-panel">
            <div className="deba-order-panel-head">
              <div>
                <span>FULFILLMENT</span>
                <h2>الشحن والتسليم</h2>
              </div>
              <Truck size={20} />
            </div>
            {shipmentRow ? (
              <>
                <div className="deba-order-metrics">
                  <div><span>الحالة</span><strong>{SHIPMENT_LABELS[shipmentRow.status] || shipmentRow.status}</strong></div>
                  <div><span>المزود</span><strong>{shipmentRow.provider || '—'}</strong></div>
                  <div><span>الخدمة</span><strong>{shipmentRow.service_level || '—'}</strong></div>
                  <div><span>رقم التتبع</span><strong>{shipmentRow.tracking_number || shipmentRow.external_shipment_id || 'لم يُسجل بعد'}</strong></div>
                </div>
                <div className="deba-order-timeline">
                  {((shipmentEvents || []) as ShipmentEventRow[]).map((event) => (
                    <div key={event.id} className="deba-order-timeline-item">
                      <div className="deba-order-timeline-dot"><Truck size={13} /></div>
                      <div>
                        <strong>{SHIPMENT_LABELS[event.status || ''] || event.event_code}</strong>
                        <span>{event.description || 'تحديث شحنة'}</span>
                        <small>{date(event.occurred_at)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="deba-order-empty">لم يتم إنشاء شحنة لهذا الطلب بعد.</div>
            )}
          </section>
        </div>

        <section className="deba-order-actions-panel">
          <div>
            <span>ORDER OPERATIONS</span>
            <h2>إجراءات الطلب</h2>
            <p>الإجراءات المتاحة تعتمد على دورك وحالة الطلب الحالية.</p>
          </div>
          <OrderActions
            orderId={order.id}
            orderStatus={order.status}
            paymentStatus={order.payment_status}
            deliveryMethod={order.delivery_method}
            isBuyer={isBuyer}
            isSeller={isSeller}
            shipment={
              shipmentRow
                ? {
                    id: shipmentRow.id,
                    status: shipmentRow.status,
                    trackingNumber: shipmentRow.tracking_number,
                  }
                : null
            }
          />
        </section>

        <div className="deba-order-back">
          <Link href={isSeller ? '/profile?tab=seller-orders' : '/profile?tab=orders'}>
            <ArrowRight size={15} />
            العودة إلى {isSeller ? 'طلبات العملاء' : 'طلباتي'}
          </Link>
        </div>
      </main>
    </>
  )
}
