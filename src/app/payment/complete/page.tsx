import { ArrowRight, CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

type OrderRow = {
  id: string
  reference_code: string
  status: string
  payment_status: string
  total: number | string
  currency: string
}

function formatMoney(value: number | string, currency: string) {
  const amount = typeof value === 'number' ? value : Number(value)
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(amount) + ' ' + currency
}

export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>
}) {
  const orderId = (await searchParams).orderId?.trim()

  if (!orderId) redirect('/profile?tab=orders')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=%2Fpayment%2Fcomplete')

  const { data: order, error } = await supabase
    .from('orders')
    .select('id,reference_code,status,payment_status,total,currency')
    .eq('id', orderId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (error || !order) redirect('/profile?tab=orders')

  const row = order as OrderRow
  const isPaid = row.payment_status === 'paid'
  const isFailed = row.payment_status === 'failed'
  const Icon = isPaid ? CheckCircle2 : isFailed ? XCircle : Clock3

  return (
    <main className="deba-checkout-page" dir="rtl">
      <div className="deba-checkout-success">
        <div className="deba-checkout-success-icon">
          <Icon size={28} />
        </div>
        <span>DEBA PAYMENT</span>
        <h1>{isPaid ? 'تم تأكيد الدفع' : isFailed ? 'تعذر تأكيد الدفع' : 'جاري تأكيد الدفع'}</h1>
        <p>
          المرجع: <strong>{row.reference_code}</strong>
          <br />
          إجمالي الطلب: <strong>{formatMoney(row.total, row.currency)}</strong>
        </p>

        <div className="deba-checkout-note-card">
          <ShieldCheck size={18} />
          <div>
            <strong>مصدر الحالة</strong>
            <span>
              حالة الدفع في هذه الصفحة تُقرأ من قاعدة بيانات DEBA بعد استقبال إشعار بوابة الدفع، وليس من رابط العودة في المتصفح.
            </span>
          </div>
        </div>

        <div className="deba-checkout-success-actions">
          <Link href="/profile?tab=orders" className="deba-checkout-primary">
            فتح طلباتي
          </Link>
          <Link href="/" className="deba-checkout-secondary">
            العودة للسوق
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </main>
  )
}
