'use client'

import {
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

type DeliveryMethod = 'pickup' | 'seller_delivery' | 'platform_delivery'

type CheckoutFormProps = {
  productId: string
  productSlug: string
  productTitle: string
  listingType: 'sale' | 'free'
  price: number
  currency: string
  productDeliveryMethod: string
  isAuthenticated: boolean
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
  listingType,
  price,
  currency,
  productDeliveryMethod,
  isAuthenticated,
}: CheckoutFormProps) {
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

  const requiresAddress = deliveryMethod !== 'pickup'

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
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          deliveryMethod,
          deliveryAddress: {
            addressLine1,
            district,
            city,
            governorate,
          },
          notes,
        }),
      })

      const payload = (await response.json()) as {
        orderId?: string
        error?: string
      }

      if (!response.ok || !payload.orderId) {
        throw new Error(payload.error || 'تعذر إنشاء الطلب.')
      }

      setOrderId(payload.orderId)
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

  if (status === 'success') {
    return (
      <section className="deba-checkout-success">
        <div className="deba-checkout-success-icon">
          <CheckCircle2 size={28} />
        </div>
        <span>DEBA ORDER</span>
        <h2>تم تسجيل طلب الشراء</h2>
        <p>
          الطلب الخاص بـ <strong>{productTitle}</strong> أصبح مسجلًا داخل DEBA.
          رقم الطلب: <strong>{orderId.slice(0, 8).toUpperCase()}</strong>
        </p>
        <div className="deba-checkout-status-grid">
          <div>
            <span>حالة الطلب</span>
            <strong>قيد المتابعة</strong>
          </div>
          <div>
            <span>الدفع</span>
            <strong>غير مدفوع إلكترونيًا</strong>
          </div>
          <div>
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
        <div className="deba-checkout-success-actions">
          <Link href="/" className="deba-checkout-secondary">
            العودة للسوق
          </Link>
          <Link href={'/products/' + productSlug} className="deba-checkout-primary">
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
          <span>الإجمالي الحالي</span>
          <strong>{listingType === 'free' ? 'مجاني' : formatMoney(price, currency)}</strong>
        </div>
      </div>

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
          {listingType === 'free' ? 'مجاني' : formatMoney(price, currency)}
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
            تأكيد طلب الشراء
          </>
        ) : (
          'تسجيل الدخول لإتمام الطلب'
        )}
      </button>

      <p className="deba-checkout-note">
        {isAuthenticated
          ? 'هذه الخطوة تسجل طلبك داخل DEBA ولا تخصم مبلغًا إلكترونيًا في النسخة الحالية.'
          : 'ستحتاج إلى تسجيل الدخول حتى يرتبط الطلب بحسابك داخل DEBA.'}
      </p>
    </form>
  )
}
