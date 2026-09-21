'use client'

import { Loader2, RotateCcw } from 'lucide-react'
import { useState } from 'react'

export default function RefundActions({
  orderId,
  amount,
}: {
  orderId: string
  amount: number
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function requestRefund() {
    if (!window.confirm('سيتم إرسال طلب استرداد كامل للمبلغ المتاح. هل تريد المتابعة؟')) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/refunds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ orderId, amount }),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر إرسال طلب الاسترداد.')
      }

      window.location.reload()
    } catch (refundError) {
      setError(
        refundError instanceof Error
          ? refundError.message
          : 'تعذر إرسال طلب الاسترداد.',
      )
      setLoading(false)
    }
  }

  return (
    <div className="deba-order-refund">
      <button
        type="button"
        className="deba-order-action"
        disabled={loading}
        onClick={() => void requestRefund()}
      >
        {loading ? <Loader2 size={17} className="deba-spin" /> : <RotateCcw size={17} />}
        طلب استرداد كامل
      </button>
      <small>
        المبلغ المتاح للاسترداد: {new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(amount)}
      </small>
      {error ? <p className="deba-checkout-error" role="alert">{error}</p> : null}
    </div>
  )
}
