'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Coins, Gavel, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import styles from './FutureMarketplacePanel.module.css'

type AuctionState = {
  productId: string
  isLive: boolean
  startsAt: string | null
  endsAt: string | null
  offerCount: number
  leadingAmount: number | null
  currency: string
  listingPrice: number | null
}

type Props = {
  productId: string
  isOwner: boolean
  isNegotiable: boolean
  currency: string
  listingPrice: number | null
}

export default function FutureMarketplacePanel({
  productId,
  isOwner,
  isNegotiable,
  currency,
  listingPrice,
}: Props) {
  const [auction, setAuction] = useState<AuctionState | null>(null)
  const [coins, setCoins] = useState(0)
  const [floor, setFloor] = useState('')
  const [offer, setOffer] = useState('')
  const [message, setMessage] = useState('')
  const [minutes, setMinutes] = useState('120')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  const refresh = useCallback(async () => {
    if (!isNegotiable && !isOwner) return

    const response = await fetch(
      '/api/auctions?productId=' + encodeURIComponent(productId),
      { cache: 'no-store' },
    )
    const body = response.ok ? await response.json() : null

    if (body?.state) setAuction(body.state)

    if (isOwner) {
      const balance = await supabase.rpc('get_my_coin_balance')
      if (balance.data?.balance !== undefined) {
        setCoins(Number(balance.data.balance) || 0)
      }
    }
  }, [isNegotiable, isOwner, productId, supabase])

  useEffect(() => {
    if (!isNegotiable && !isOwner) return

    void refresh()
    const timer = window.setInterval(() => void refresh(), 10000)
    const channel = supabase
      .channel('deba-auction-' + productId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'offers',
          filter: 'product_id=eq.' + productId,
        },
        () => void refresh(),
      )
      .subscribe()

    return () => {
      window.clearInterval(timer)
      void supabase.removeChannel(channel)
    }
  }, [isNegotiable, isOwner, productId, refresh, supabase])

  if (!isNegotiable && !isOwner) {
    return null
  }

  const remaining = auction?.endsAt
    ? Math.max(
        0,
        Math.floor(
          (new Date(auction.endsAt).getTime() - Date.now()) / 1000,
        ),
      )
    : 0

  const countdown = remaining
    ? [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60]
        .map((value) => String(value).padStart(2, '0'))
        .join(':')
    : '—'

  const post = async (url: string, body: unknown, okText: string) => {
    setBusy(true)
    setFeedback('')

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'تعذر تنفيذ العملية')
      }

      setFeedback(
        data.smartDecision === 'auto_countered'
          ? 'تم إنشاء عرض مقابل تلقائيًا وفق الحد الذي حدده البائع.'
          : data.smartDecision === 'accepted_escrow'
            ? 'تم قبول العرض وفتح مسار الصفقة الآمن.'
            : data.message || okText,
      )

      await refresh()
      return data
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'تعذر تنفيذ العملية')
      return null
    } finally {
      setBusy(false)
    }
  }

  const isLiveAuction = Boolean(auction?.isLive)

  return (
    <section className={styles.panel} aria-label="أدوات التفاوض والصفقة">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <Sparkles size={15} /> DEBA DEAL TOOLS
          </span>
          <h2>{isOwner ? 'أدوات الإعلان الذكية' : 'التفاوض الذكي'}</h2>
        </div>

        {isOwner ? (
          <div className={styles.coinPill}>
            <Coins size={16} />
            {coins.toLocaleString('ar-EG')} Coins
          </div>
        ) : null}
      </div>

      <div className={styles.grid}>
        {isNegotiable ? (
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <Gavel size={18} /> {isLiveAuction ? 'المزاد المباشر' : 'إرسال عرض'}
            </div>

            {isOwner ? (
              <>
                <div className={styles.metric}>
                  <strong>{isLiveAuction ? countdown : 'غير مفعّل'}</strong>
                  <span>
                    {isLiveAuction
                      ? (auction?.offerCount || 0).toLocaleString('ar-EG') + ' عرض نشط'
                      : 'يمكنك تشغيل المزاد عندما يناسبك'}
                  </span>
                </div>

                {isLiveAuction && auction?.leadingAmount ? (
                  <p className={styles.muted}>
                    أعلى عرض حالي: {auction.leadingAmount.toLocaleString('ar-EG')}{' '}
                    {auction.currency}
                  </p>
                ) : (
                  <p className={styles.muted}>
                    المزاد خيار إضافي. يبقى الإعلان في نموذج التواصل والعروض ما لم
                    تفعّله بنفسك.
                  </p>
                )}

                <div className={styles.controls}>
                  <input
                    inputMode="numeric"
                    value={minutes}
                    onChange={(event) => setMinutes(event.target.value)}
                    aria-label="مدة المزاد بالدقائق"
                    placeholder="120"
                  />
                  <button
                    disabled={busy}
                    onClick={() =>
                      void post(
                        '/api/auctions',
                        { productId, durationMinutes: Number(minutes) },
                        'تم تشغيل المزاد',
                      )
                    }
                  >
                    <Gavel size={15} /> تشغيل المزاد
                  </button>
                </div>
              </>
            ) : (
              <>
                {isLiveAuction ? (
                  <>
                    <div className={styles.metric}>
                      <strong>{countdown}</strong>
                      <span>
                        {(auction?.offerCount || 0).toLocaleString('ar-EG')} عرض نشط
                      </span>
                    </div>
                    <p className={styles.muted}>
                      أعلى عرض حالي:{' '}
                      {auction?.leadingAmount
                        ? auction.leadingAmount.toLocaleString('ar-EG') + ' ' + auction.currency
                        : 'لم يصل عرض بعد'}
                    </p>
                  </>
                ) : null}

                <div className={styles.offerForm}>
                  <input
                    inputMode="decimal"
                    value={offer}
                    onChange={(event) => setOffer(event.target.value)}
                    placeholder={'قيمة العرض بـ ' + currency}
                    aria-label="قيمة العرض"
                  />
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="رسالة اختيارية للبائع"
                    aria-label="رسالة العرض"
                  />
                  <button
                    disabled={busy || !offer}
                    onClick={() =>
                      void post(
                        '/api/smart-offers',
                        {
                          productId,
                          amount: Number(offer),
                          message: message.trim().slice(0, 1000),
                        },
                        'تم إرسال العرض للبائع',
                      )
                    }
                  >
                    <Gavel size={15} /> أرسل العرض
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {isOwner && isNegotiable ? (
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <ShieldCheck size={18} /> الحد الأدنى الذي تقبله للعروض
            </div>
            <p className={styles.muted}>
              هذا الحد خاص بك ولا يظهر للمشترين. يستخدم فقط لاتخاذ قرار العرض
              المقابل عندما تكون الميزة مفعلة.
            </p>

            <div className={styles.controls}>
              <input
                inputMode="decimal"
                value={floor}
                onChange={(event) => setFloor(event.target.value)}
                placeholder={
                  listingPrice ? String(Math.round(listingPrice)) : 'الحد الأدنى'
                }
                aria-label="الحد الأدنى الذي تقبله للعروض"
              />
              <button
                disabled={busy || !floor}
                onClick={() =>
                  void post(
                    '/api/smart-offers/floor',
                    {
                      productId,
                      floorAmount: Number(floor),
                      autoCounterEnabled: true,
                    },
                    'تم حفظ الحد الأدنى للعروض',
                  )
                }
              >
                <ShieldCheck size={15} /> حفظ الحد
              </button>
            </div>
          </div>
        ) : null}

        {isOwner ? (
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <RefreshCw size={18} /> أدوات زيادة الظهور
            </div>
            <p className={styles.muted}>
              خصائص مدفوعة لرفع ظهور الإعلان وإعادة تنشيطه وفق الرصيد الفعلي.
            </p>
            <div className={styles.boosts}>
              <button
                disabled={busy}
                onClick={() =>
                  void post(
                    '/api/boosts',
                    {
                      productId,
                      boostType: 'super_boost',
                      durationMinutes: 1440,
                    },
                    'تم تفعيل Super Boost',
                  )
                }
              >
                Super Boost
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void post(
                    '/api/boosts',
                    {
                      productId,
                      boostType: 'stealth_pin',
                      durationMinutes: 4320,
                    },
                    'تم تفعيل Stealth Pin',
                  )
                }
              >
                Stealth Pin
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void post(
                    '/api/boosts',
                    {
                      productId,
                      boostType: 'auto_refresh',
                      durationMinutes: 10080,
                    },
                    'تم تفعيل Auto-Refresh',
                  )
                }
              >
                Auto-Refresh
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {feedback ? (
        <div className={styles.feedback} role="status">
          {feedback}
        </div>
      ) : null}
    </section>
  )
}
