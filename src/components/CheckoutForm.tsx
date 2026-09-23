'use client'

import {
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type DeliveryMethod = 'pickup' | 'seller_delivery' | 'platform_delivery'

type CheckoutFormProps = {
  productId: string
  productSlug: string
  productTitle: string
  price: number
  currency: string
  productDeliveryMethod: string
  isAuthenticated: boolean
  availableQuantity: number
}

function formatMoney(value: number, currency: string) {
  return (
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value) +
    ' ' +
    currency
  )
}

export default function CheckoutForm({
  productId,
  productSlug,
  productTitle,
  price,
  currency,
  productDeliveryMethod,
  isAuthenticated,
  availableQuantity,
}: CheckoutFormProps) {
  const [quantity, setQuantity] = useState(1)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    productDeliveryMethod === 'both'
      ? 'pickup'
      : (productDeliveryMethod as DeliveryMethod),
  )
  const [addressLine1, setAddressLine1] = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  )
  const [error, setError] = useState('')
  const [orderId, setOrderId] = useState('')
  const [referenceCode, setReferenceCode] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'loading'>('idle')
  const orderIdempotencyKeyRef = useRef<string | null>(null)
  const paymentIdempotencyKeyRef = useRef<string | null>(null)

  const requiresAddress = deliveryMethod !== 'pickup'

  useEffect(() => {
    if (!requiresAddress) return
    let active = true
    fetch('/api/location', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active || !data?.location) return
        setDistrict((current) => current || data.location.district || '')
        setCity((current) => current || data.location.city || '')
        setGovernorate((current) => current || data.location.governorate || '')
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [requiresAddress])

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isAuthenticated) {
      window.location.assign(
        '/login?next=' +
          encodeURIComponent('/products/' + productSlug + '/checkout'),
      )
      return
    }

    setStatus('loading')
    setError('')

    try {
      const idempotencyKey =
        orderIdempotencyKeyRef.current ||
        (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2))
      orderIdempotencyKeyRef.current = idempotencyKey

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          productId,
          quantity,
          deliveryMethod,
          deliveryAddress: {
            addressLine1,
            district,
            city,
            governorate,
          },
          notes,
          idempotencyKey,
        }),
      })

      const payload = (await response.json()) as {
        orderId?: string
        referenceCode?: string
        error?: string
      }

      if (!response.ok || !payload.orderId) {
        throw new Error(payload.error || 'تعذر إنشاء الطلب.')
      }

      setOrderId(payload.orderId)
      setReferenceCode(payload.referenceCode || '')
      setStatus('success')
    } catch (submitError) {
      setStatus('error')
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'تعذر إنشاء الطلب الآن.',
      )
    }
  }

  async function startPayment() {
    if (!orderId) return

    setPaymentStatus('loading')
    setError('')

    try {
      const idempotencyKey =
        paymentIdempotencyKeyRef.current ||
        (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2))
      paymentIdempotencyKeyRef.current = idempotencyKey

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ orderId, idempotencyKey }),
      })

      const payload = (await response.json()) as {
        checkoutUrl?: string
        error?: string
      }

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || 'تعذر بدء الدفع الإلكتروني.')
      }

      window.location.assign(payload.checkoutUrl)
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : 'تعذر بدء الدفع الإلكتروني.',
      )
      setPaymentStatus('idle')
    }
  }

  if (status === 'success') {
    return (
      <section className="deba-checkout-success">
        <div className="deba-checkout-success-icon">
          <CheckCircle2 size={28} />
        </div>
        <span>DEBA ORDER</span>
        <h2>تم تسجيل طلب الشراء</h2>
        <p>
          تم تسجيل طلب <strong>{productTitle}</strong> بالسعر الثابت داخل DEBA.
          رقم الطلب: <strong>{referenceCode || orderId.slice(0, 8).toUpperCase()}</strong>
        </p>
        <div className="deba-checkout-status-grid">
          <div>
            <span>الكمية</span>
            <strong>{quantity.toLocaleString('ar-EG')} وحدة</strong>
          </div>
          <div>
            <span>الإجمالي</span>
            <strong>{formatMoney(price * quantity, currency)}</strong>
          </div>
          <div>
            <span>حالة الطلب</span>
            <strong>قيد المتابعة</strong>
          </div>
        </div>
        <div className="deba-checkout-status-grid">
          <div>
            <span>الدفع</span>
            <strong>لم يبدأ بعد</strong>
          </div>
          <div className="deba-checkout-status-grid-delivery">
            <span>الاستلام</span>
            <strong>
              {deliveryMethod === 'pickup'
                ? 'استلام من البائع'
                : deliveryMethod === 'seller_delivery'
                  ? 'توصيل عبر البائع'
                  : 'توصيل عبر DEBA'}
            </strong>
          </div>
        </div>
        {error ? (
          <div className="deba-checkout-error" role="alert">
            <ShieldCheck size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="deba-checkout-success-actions">
          <button
            type="button"
            className="deba-checkout-primary"
            disabled={paymentStatus === 'loading'}
            onClick={() => void startPayment()}
          >
            {paymentStatus === 'loading' ? (
              <Loader2 size={18} className="deba-spin" />
            ) : (
              <CreditCard size={18} />
            )}
            ادفع إلكترونيًا عبر Paymob
          </button>
          <Link href="/profile?tab=orders" className="deba-checkout-secondary">
            فتح طلباتي
          </Link>
        </div>

        <div className="deba-checkout-success-actions">
          <Link href="/" className="deba-checkout-secondary">
            العودة للسوق
          </Link>
          <Link href={'/products/' + productSlug} className="deba-checkout-secondary">
            العودة للإعلان
          </Link>
        </div>
      </section>
    )
  }

  return (
    <form className="deba-checkout-form" onSubmit={submitOrder}>
      <div className="deba-checkout-summary">
        <div>
          <span>المنتج</span>
          <strong>{productTitle}</strong>
        </div>
        <div>
          <span>السعر الثابت</span>
          <strong>{formatMoney(price, currency)}</strong>
        </div>
        <div>
          <span>الإجمالي</span>
          <strong>{formatMoney(price * quantity, currency)}</strong>
        </div>
      </div>

      <fieldset className="deba-checkout-fieldset">
        <legend>الكمية</legend>
        <div className="deba-quantity-control" aria-label="اختيار الكمية">
          <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1}>−</button>
          <input
            type="number"
            min={1}
            max={availableQuantity}
            value={quantity}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (!Number.isFinite(next)) return
              setQuantity(Math.min(availableQuantity, Math.max(1, Math.floor(next))))
            }}
            aria-label="الكمية"
          />
          <button type="button" onClick={() => setQuantity((value) => Math.min(availableQuantity, value + 1))} disabled={quantity >= availableQuantity}>+</button>
          <span>متاح: {availableQuantity.toLocaleString('ar-EG')}</span>
        </div>
      </fieldset>

      <fieldset className="deba-checkout-fieldset">
        <legend>طريقة الاستلام</legend>

        <div className="deba-delivery-options">
          {(productDeliveryMethod === 'both' || productDeliveryMethod === 'pickup') && (
            <label className={deliveryMethod === 'pickup' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="deliveryMethod"
                value="pickup"
                checked={deliveryMethod === 'pickup'}
                onChange={() => setDeliveryMethod('pickup')}
              />
              <MapPin size={18} />
              <span>
                <strong>استلام من البائع</strong>
                <small>نسّق الموعد والمكان بعد تأكيد الطلب.</small>
              </span>
            </label>
          )}

          {(productDeliveryMethod === 'both' ||
            productDeliveryMethod === 'seller_delivery') && (
            <label className={deliveryMethod === 'seller_delivery' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="deliveryMethod"
                value="seller_delivery"
                checked={deliveryMethod === 'seller_delivery'}
                onChange={() => setDeliveryMethod('seller_delivery')}
              />
              <PackageCheck size={18} />
              <span>
                <strong>توصيل عبر البائع</strong>
                <small>أدخل عنوان الاستلام داخل مصر.</small>
              </span>
            </label>
          )}

          {productDeliveryMethod === 'platform_delivery' && (
            <label className="is-selected">
              <input
                type="radio"
                name="deliveryMethod"
                value="platform_delivery"
                checked={deliveryMethod === 'platform_delivery'}
                onChange={() => setDeliveryMethod('platform_delivery')}
              />
              <PackageCheck size={18} />
              <span>
                <strong>توصيل عبر DEBA</strong>
                <small>أدخل عنوان الاستلام لإكمال الطلب.</small>
              </span>
            </label>
          )}
        </div>
      </fieldset>

      {requiresAddress && (
        <fieldset className="deba-checkout-fieldset">
          <legend>عنوان الاستلام</legend>

          <div className="deba-checkout-grid">
            <label className="is-wide">
              <span>العنوان</span>
              <input
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
                placeholder="الشارع ورقم العقار"
                required
                maxLength={180}
              />
            </label>

            <label>
              <span>الحي / المنطقة</span>
              <input
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                placeholder="مثال: المعادي"
                maxLength={100}
              />
            </label>

            <label>
              <span>المدينة</span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="مثال: القاهرة"
                required
                maxLength={100}
              />
            </label>

            <label>
              <span>المحافظة</span>
              <input
                value={governorate}
                onChange={(event) => setGovernorate(event.target.value)}
                placeholder="مثال: القاهرة"
                required
                maxLength={100}
              />
            </label>
          </div>
        </fieldset>
      )}

      <fieldset className="deba-checkout-fieldset">
        <legend>ملاحظة للطلب</legend>
        <label>
          <span>ملاحظات إضافية</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="موعد مناسب للاستلام أو أي تفاصيل يحتاجها البائع..."
          />
        </label>
      </fieldset>

      {error && (
        <div className="deba-checkout-error" role="alert">
          <ShieldCheck size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="deba-checkout-total">
        <span>الإجمالي</span>
        <strong>
          {formatMoney(price * quantity, currency)}
        </strong>
      </div>

      <button
        type="submit"
        className="deba-checkout-confirm"
        disabled={status === 'loading'}
      >
        {status === 'loading' ? (
          <>
            <Loader2 size={18} className="deba-spin" />
            جارٍ تسجيل الطلب...
          </>
        ) : isAuthenticated ? (
          <>
            <CheckCircle2 size={18} />
            تأكيد الشراء بالسعر الثابت
          </>
        ) : (
          'تسجيل الدخول لإتمام الطلب'
        )}
      </button>

      <p className="deba-checkout-note">
        {isAuthenticated
          ? 'بعد تسجيل الطلب يمكنك بدء الدفع الإلكتروني. حالة الدفع النهائية تعتمد على إشعار بوابة الدفع الموثق.'
          : 'ستحتاج إلى تسجيل الدخول حتى يتم تسجيل طلب الشراء في حسابك.'}
      </p>
    </form>
  )
}
