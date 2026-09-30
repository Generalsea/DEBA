import styles from './ProductDealScore.module.css'

export type ProductDealScoreData = {
  product_id: string
  current_price: number | string
  currency: string
  condition_grade: string | null
  category_id: string | null
  average_price: number | string | null
  median_price: number | string | null
  p25_price: number | string | null
  p75_price: number | string | null
  peer_count: number
  price_delta_pct: number | string | null
  deal_score: number | string | null
  deal_label: 'great_deal' | 'fair' | 'overpriced' | 'insufficient_data'
  confidence: number | string | null
  graph: Record<string, unknown> | null
}

function numberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function money(value: number | string | null | undefined, currency: string) {
  const parsed = numberValue(value)
  if (parsed === null) return '—'
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(parsed) + ' ' + currency
}

function percent(value: number | string | null | undefined) {
  const parsed = numberValue(value)
  if (parsed === null) return '—'
  const sign = parsed > 0 ? '+' : ''
  return sign + parsed.toFixed(1) + '%'
}

const LABELS = {
  great_deal: 'سعر ممتاز',
  fair: 'سعر عادل',
  overpriced: 'أعلى من نطاق السوق',
  insufficient_data: 'بيانات مقارنة غير كافية',
} as const

const LABEL_COPY = {
  great_deal: 'السعر الحالي أقل بوضوح من متوسط الإعلانات المقارنة.',
  fair: 'السعر الحالي قريب من مستوى الأسعار المقارنة لنفس السلعة وحالتها.',
  overpriced: 'السعر الحالي أعلى من المتوسط المقارن المتاح لهذا النوع من الإعلانات.',
  insufficient_data: 'نحتاج إلى إعلانات مقارنة كافية قبل إصدار حكم سعري.',
} as const

export default function ProductDealScore({
  data,
}: {
  data: ProductDealScoreData | null
}) {
  if (!data) return null

  const current = numberValue(data.current_price)
  const p25 = numberValue(data.p25_price)
  const median = numberValue(data.median_price)
  const average = numberValue(data.average_price)
  const p75 = numberValue(data.p75_price)
  const delta = numberValue(data.price_delta_pct)
  const score = numberValue(data.deal_score)
  const confidence = numberValue(data.confidence)
  const hasRange = p25 !== null && p75 !== null && p75 > p25 && current !== null
  const marker = hasRange
    ? Math.max(0, Math.min(100, ((current - p25) / (p75 - p25)) * 100))
    : null

  return (
    <section className={styles.card} aria-labelledby="deba-deal-score-title">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>DEBA PRICE INTELLIGENCE</span>
          <h2 id="deba-deal-score-title">مؤشر السعر الذكي</h2>
        </div>
        <span className={styles.badge} data-label={data.deal_label}>
          {LABELS[data.deal_label]}
        </span>
      </div>

      <p className={styles.copy}>{LABEL_COPY[data.deal_label]}</p>

      <div className={styles.metrics}>
        <div>
          <span>متوسط المقارنة</span>
          <strong>{money(average, data.currency)}</strong>
        </div>
        <div>
          <span>الوسيط</span>
          <strong>{money(median, data.currency)}</strong>
        </div>
        <div>
          <span>الفرق عن المتوسط</span>
          <strong>{percent(delta)}</strong>
        </div>
      </div>

      {hasRange ? (
        <div className={styles.graph} role="img" aria-label="نطاق الأسعار المقارنة">
          <div className={styles.range} />
          {marker !== null ? (
            <div className={styles.marker} style={{ left: marker + '%' }}>
              <span>{money(current, data.currency)}</span>
            </div>
          ) : null}
          <div className={styles.graphLabels}>
            <span>الربع الأدنى {money(p25, data.currency)}</span>
            <span>الربع الأعلى {money(p75, data.currency)}</span>
          </div>
        </div>
      ) : null}

      <div className={styles.footer}>
        <span>{data.peer_count.toLocaleString('ar-EG')} إعلان مقارنة</span>
        {score !== null ? <strong>{score.toFixed(0)}/100</strong> : <strong>غير متاح</strong>}
        {confidence !== null ? <span>ثقة {Math.round(confidence * 100)}%</span> : null}
      </div>
    </section>
  )
}
