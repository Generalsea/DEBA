'use client'

import { BellRing, CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type Preferences = {
  order_updates: boolean
  payment_updates: boolean
  shipping_updates: boolean
  security_updates: boolean
  marketing_updates: boolean
}

const DEFAULTS: Preferences = {
  order_updates: true,
  payment_updates: true,
  shipping_updates: true,
  security_updates: true,
  marketing_updates: true,
}

const ITEMS: Array<{ key: keyof Preferences; label: string; body: string }> = [
  {
    key: 'order_updates',
    label: 'تحديثات الطلبات',
    body: 'تأكيد الطلب، التجهيز، الإلغاء، والإتمام.',
  },
  {
    key: 'payment_updates',
    label: 'تحديثات الدفع',
    body: 'حالة عمليات الدفع والاسترداد.',
  },
  {
    key: 'shipping_updates',
    label: 'تحديثات الشحن',
    body: 'التجهيز، النقل، ومحاولات التسليم.',
  },
  {
    key: 'security_updates',
    label: 'تنبيهات الأمان',
    body: 'تنبيهات مرتبطة بأمان الحساب والجلسات.',
  },
  {
    key: 'marketing_updates',
    label: 'رسائل DEBA',
    body: 'الأخبار والعروض والرسائل التسويقية.',
  },
]

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/notification-preferences', { cache: 'no-store' })
        if (!response.ok) return
        const result = (await response.json()) as { preferences?: Preferences }
        if (result.preferences) setPreferences(result.preferences)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function update(key: keyof Preferences, value: boolean) {
    setSaving(key)
    setMessage(null)
    setPreferences((current) => ({ ...current, [key]: value }))

    try {
      const response = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error || 'تعذر حفظ الإعداد.')
      }

      setMessage('تم حفظ تفضيلات الإشعارات.')
    } catch (error) {
      setPreferences((current) => ({ ...current, [key]: !value }))
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ الإعداد.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className="deba-profile-preferences-card">
      <div className="deba-profile-security-head">
        <BellRing size={20} />
        <div>
          <strong>الإشعارات</strong>
          <span>تحكم في أنواع التنبيهات التي تصل إلى حسابك.</span>
        </div>
      </div>

      {loading ? (
        <div className="deba-profile-preferences-loading">
          <Loader2 size={17} className="deba-spin" />
          جارٍ تحميل الإعدادات...
        </div>
      ) : (
        <div className="deba-profile-preferences-list">
          {ITEMS.map((item) => (
            <label key={item.key} className="deba-profile-preference-row">
              <span>
                <strong>{item.label}</strong>
                <small>{item.body}</small>
              </span>
              <input
                type="checkbox"
                checked={preferences[item.key]}
                disabled={saving !== null}
                onChange={(event) => void update(item.key, event.target.checked)}
              />
              {saving === item.key ? <Loader2 size={15} className="deba-spin" /> : <CheckCircle2 size={15} />}
            </label>
          ))}
        </div>
      )}

      {message ? <p className="deba-profile-preference-message">{message}</p> : null}
    </section>
  )
}
