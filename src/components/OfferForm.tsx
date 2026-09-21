'use client'

import { ArrowLeft, CheckCircle2, Loader2, Repeat2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type OfferFormProps = {
  productId: string
  ownerId: string | null
  listingType: 'sale' | 'free'
  currency: string
  price: number | null
  minimumOfferAmount: number | null
  productTitle: string
  autoFocus?: boolean
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) return 'غير محدد'
  return (
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value) +
    ' ' +
    currency
  )
}

export default function OfferForm({
  productId,
  ownerId,
  listingType,
  currency,
  price,
  minimumOfferAmount,
  productTitle,
  autoFocus = false,
}: OfferFormProps) {
  const isSale = listingType === 'sale'
  const [amount, setAmount] = useState(price !== null ? String(Math.round(price)) : '')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (!autoFocus) return
    const timer = window.setTimeout(() => {
      document.getElementById('deba-offer-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [autoFocus])

  async function submitOffer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'loading') return

    setStatus('loading')
    setFeedback('')

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        const next =
          typeof window !== 'undefined'
            ? window.location.pathname + window.location.search
            : '/'
        window.location.assign('/login?next=' + encodeURIComponent(next))
        return
      }

      if (ownerId && ownerId === user.id) {
        setStatus('error')
        setFeedback('لا يمكنك التفاوض على سلعتك الخاصة.')
        return
      }

      const cleanMessage = message.trim().slice(0, 500)
      let normalizedAmount = 0

      if (isSale) {
        normalizedAmount = Number(amount)
        if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
          setStatus('error')
          setFeedback('أدخل قيمة عرض صحيحة.')
          return
        }

        if (
          minimumOfferAmount !== null &&
          normalizedAmount < minimumOfferAmount
        ) {
          setStatus('error')
          setFeedback(
            'أقل عرض مسموح هو ' +
              formatMoney(minimumOfferAmount, currency) +
              '.',
          )
          return
        }
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id,owner_id,listing_type,status,moderation_status')
        .eq('id', productId)
        .eq('status', 'published')
        .eq('moderation_status', 'approved')
        .in('listing_type', ['sale', 'free'])
        .maybeSingle()

      if (productError || !product) {
        setStatus('error')
        setFeedback('هذه السلعة لم تعد متاحة للطلبات أو العروض.')
        return
      }

      const expectedType = isSale ? 'sale' : 'free'
      if (product.listing_type !== expectedType) {
        setStatus('error')
        setFeedback('تغيّرت حالة السلعة، أعد تحميل الصفحة وحاول مرة أخرى.')
        return
      }

      if (isSale && !product.owner_id) {
        setStatus('error')
        setFeedback('لا يمكن إنشاء عرض لسلعة لا يملكها بائع معرّف.')
        return
      }

      if (!isSale) {
        setStatus('error')
        setFeedback('الطلب المجاني لا يحتاج عرض سعر. استخدم زر طلب المنتج مجانًا.')
        return
      }

      const { error } = await supabase.from('offers').insert({
        product_id: productId,
        buyer_id: user.id,
        amount: normalizedAmount,
        currency,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        message:
          cleanMessage ||
          'أرغب في التفاوض على المنتج: ' + productTitle,
      })

      if (error) throw error

      setStatus('success')
      setFeedback('تم إرسال عرضك للبائع. ستظهر أي استجابة ضمن المفاوضات.')
      setMessage('')
    } catch (error) {
      console.error('DEBA offer submission failed', error)
      setStatus('error')
      setFeedback('تعذر إرسال العرض الآن. حاول مرة أخرى.')
    }
  }

  return (
    <form id="deba-offer-form" className="deba-offer-form" onSubmit={submitOffer}>
      <div className="deba-offer-form-head">
        <div>
          <span>DEBA NEGOTIATION</span>
          <h2>تفاوض على السعر</h2>
        </div>
        <Repeat2 size={22} />
      </div>

      <label>
        <span>قيمة العرض</span>
        <div className="deba-amount-input">
          <input
            name="amount"
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={price !== null ? String(Math.round(price)) : 'اكتب قيمة عرضك'}
            required
          />
          <b>{currency}</b>
        </div>
        <small>
          {minimumOfferAmount !== null
            ? 'الحد الأدنى: ' + formatMoney(minimumOfferAmount, currency)
            : price !== null
              ? 'السعر المعلن: ' + formatMoney(price, currency)
              : 'اختَر سعرًا مناسبًا للتفاوض.'}
        </small>
      </label>

      <label>
        <span>رسالة للبائع</span>
        <textarea
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={500}
          rows={4}
          placeholder="اكتب رسالة قصيرة توضّح عرضك أو موعد الاستلام المقترح..."
        />
      </label>

      {feedback && (
        <div
          className={'deba-form-feedback ' + (status === 'success' ? 'is-success' : 'is-error')}
          role="status"
        >
          {status === 'success' ? <CheckCircle2 size={18} /> : null}
          <span>{feedback}</span>
        </div>
      )}

      <button
        type="submit"
        className="deba-offer-submit"
        disabled={status === 'loading' || status === 'success'}
      >
        {status === 'loading' ? (
          <>
            <Loader2 size={18} className="deba-spin" />
            جارٍ الإرسال...
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle2 size={18} />
            تم الإرسال
          </>
        ) : (
          <>
            إرسال العرض
            <ArrowLeft size={17} />
          </>
        )}
      </button>

      <div className="deba-offer-note">
        <ShieldCheck size={14} />
        <span>لا ترسل بيانات دفع أو أرقام حساسة داخل الرسالة.</span>
      </div>
    </form>
  )
}
