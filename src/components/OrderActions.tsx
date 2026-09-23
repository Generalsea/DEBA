'use client'

import { CheckCircle2, CreditCard, Loader2, PackagePlus, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'

const ORDER_ACTIONS: Record<string, Array<{ status: string; label: string }>> = {
  seller_pending: [{ status: 'confirmed', label: 'تأكيد الطلب' }],
  seller_confirmed: [{ status: 'processing', label: 'بدء التجهيز' }],
  seller_processing: [{ status: 'ready', label: 'تجهيز الطلب للتسليم' }],
  buyer_pending: [{ status: 'cancelled', label: 'إلغاء الطلب' }],
  buyer_ready: [{ status: 'completed', label: 'تأكيد الاستلام' }],
}

const SHIPMENT_ACTIONS: Record<string, Array<{ status: string; label: string }>> = {
  pending: [
    { status: 'label_created', label: 'إنشاء بوليصة' },
    { status: 'ready', label: 'جاهز للتسليم' },
    { status: 'cancelled', label: 'إلغاء الشحنة' },
  ],
  label_created: [
    { status: 'ready', label: 'جاهز للتسليم' },
    { status: 'cancelled', label: 'إلغاء الشحنة' },
  ],
  ready: [
    { status: 'picked_up', label: 'تم الاستلام' },
    { status: 'cancelled', label: 'إلغاء الشحنة' },
  ],
  picked_up: [
    { status: 'in_transit', label: 'بدء النقل' },
    { status: 'cancelled', label: 'إلغاء الشحنة' },
  ],
  in_transit: [
    { status: 'out_for_delivery', label: 'خرج للتسليم' },
    { status: 'delivered', label: 'تم التسليم' },
    { status: 'failed', label: 'تعثر التسليم' },
    { status: 'returned', label: 'مرتجع' },
  ],
  out_for_delivery: [
    { status: 'delivered', label: 'تم التسليم' },
    { status: 'failed', label: 'تعثر التسليم' },
    { status: 'returned', label: 'مرتجع' },
  ],
  failed: [
    { status: 'in_transit', label: 'إعادة النقل' },
    { status: 'cancelled', label: 'إلغاء الشحنة' },
  ],
  cancelled: [{ status: 'pending', label: 'إعادة فتح الشحنة' }],
}

function makeKey() {
  return crypto.randomUUID()
}

type Props = {
  orderId: string
  orderStatus: string
  paymentStatus: string
  deliveryMethod: string
  isBuyer: boolean
  isSeller: boolean
  shipment: { id: string; status: string; trackingNumber: string | null } | null
}

export default function OrderActions({
  orderId,
  orderStatus,
  paymentStatus,
  deliveryMethod,
  isBuyer,
  isSeller,
  shipment,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const actions = useMemo(() => {
    const key = isSeller
      ? 'seller_' + orderStatus
      : isBuyer
        ? 'buyer_' + orderStatus
        : ''
    return ORDER_ACTIONS[key] || []
  }, [isBuyer, isSeller, orderStatus])

  async function transitionOrder(status: string) {
    setLoading(status)
    setError(null)
    try {
      const response = await fetch('/api/orders/' + orderId + '/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': makeKey(),
        },
        body: JSON.stringify({ status }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذر تحديث الطلب.')
      window.location.reload()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'تعذر تحديث الطلب.')
      setLoading(null)
    }
  }

  async function startPayment() {
    setLoading('payment')
    setError(null)
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': makeKey(),
        },
        body: JSON.stringify({ orderId }),
      })
      const result = (await response.json()) as { checkoutUrl?: string; error?: string }
      if (!response.ok || !result.checkoutUrl) {
        throw new Error(result.error || 'تعذر بدء الدفع الإلكتروني.')
      }
      window.location.assign(result.checkoutUrl)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'تعذر بدء الدفع الإلكتروني.')
      setLoading(null)
    }
  }

  async function createShipment() {
    setLoading('shipment')
    setError(null)
    try {
      const response = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذر إنشاء الشحنة.')
      window.location.reload()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'تعذر إنشاء الشحنة.')
      setLoading(null)
    }
  }

  async function transitionShipment(status: string) {
    if (!shipment) return
    setLoading('shipment:' + status)
    setError(null)
    try {
      const response = await fetch('/api/shipments/' + shipment.id + '/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': makeKey(),
        },
        body: JSON.stringify({ status }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذر تحديث الشحنة.')
      window.location.reload()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'تعذر تحديث الشحنة.')
      setLoading(null)
    }
  }

  const shipmentActions = isSeller && shipment ? SHIPMENT_ACTIONS[shipment.status] || [] : []
  const canCompleteOrder =
    isBuyer &&
    orderStatus === 'ready' &&
    paymentStatus === 'paid' &&
    (deliveryMethod === 'pickup' || shipment?.status === 'delivered')

  return (
    <div className="deba-order-actions">
      {isBuyer && paymentStatus !== 'paid' && orderStatus !== 'cancelled' ? (
        <button
          type="button"
          className="deba-checkout-confirm"
          disabled={loading !== null}
          onClick={() => void startPayment()}
        >
          {loading === 'payment' ? <Loader2 size={18} className="deba-spin" /> : <CreditCard size={18} />}
          دفع إلكتروني آمن
        </button>
      ) : null}

      {actions
        .filter((action) => action.status !== 'completed' || canCompleteOrder)
        .map((action) => (
          <button
            key={action.status}
            type="button"
            className={
              action.status === 'cancelled'
                ? 'deba-order-action danger'
                : 'deba-order-action'
            }
            disabled={loading !== null}
            onClick={() => void transitionOrder(action.status)}
          >
            {loading === action.status ? (
              <Loader2 size={17} className="deba-spin" />
            ) : action.status === 'cancelled' ? (
              <XCircle size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}
            {action.label}
          </button>
        ))}
      
      {isSeller && deliveryMethod !== 'pickup' && !shipment && ['confirmed','processing','ready'].includes(orderStatus) ? (
        <button
          type="button"
          className="deba-order-action"
          disabled={loading !== null}
          onClick={() => void createShipment()}
        >
          {loading === 'shipment' ? <Loader2 size={17} className="deba-spin" /> : <PackagePlus size={17} />}
          إنشاء الشحنة
        </button>
      ) : null}

      {shipmentActions.map((action) => (
        <button
          key={action.status}
          type="button"
          className="deba-order-action"
          disabled={loading !== null}
          onClick={() => void transitionShipment(action.status)}
        >
          {loading === 'shipment:' + action.status ? (
            <Loader2 size={17} className="deba-spin" />
          ) : (
            <PackagePlus size={17} />
          )}
          {action.label}
        </button>
      ))}

      {error ? <p className="deba-checkout-error" role="alert">{error}</p> : null}
    </div>
  )
}
