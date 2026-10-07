'use client'

import { useState } from 'react'
import { BellRing, Check, Loader2 } from 'lucide-react'

type Props = {
  query: string
  filters: Record<string, string | number | null | undefined>
}

export default function SaveBuyerIntentButton({ query, filters }: Props) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const save = async () => {
    if (state === 'saving' || state === 'saved') return

    setState('saving')
    setMessage('')

    try {
      const response = await fetch('/api/buyer-intent/saved-searches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: query ? 'بحث: ' + query : 'بحث محفوظ',
          query,
          filters,
          alertFrequency: 'instant',
        }),
      })

      const data = (await response.json()) as {
        savedSearch?: { id?: string }
        error?: string
      }

      if (!response.ok) {
        setState('error')
        setMessage(
          response.status === 401
            ? 'سجّل الدخول أولاً لحفظ البحث والتنبيه عند توفر نتائج جديدة.'
            : data.error || 'تعذر حفظ البحث الذكي.',
        )
        return
      }

      setState('saved')
      setMessage('تم حفظ البحث. سنسجل المطابقات الجديدة عند توفرها.')
    } catch {
      setState('error')
      setMessage('تعذر حفظ البحث الآن. حاول مرة أخرى.')
    }
  }

  return (
    <div>
      <button
        type="button"
        className="deba-classified-btn deba-classified-btn-secondary"
        onClick={save}
        disabled={state === 'saving' || state === 'saved'}
        aria-live="polite"
      >
        {state === 'saving' ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : state === 'saved' ? (
          <Check size={16} aria-hidden="true" />
        ) : (
          <BellRing size={16} aria-hidden="true" />
        )}
        {state === 'saved' ? 'تم حفظ البحث' : 'احفظ البحث ونبّهني'}
      </button>
      {message ? (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: '12px',
            lineHeight: 1.7,
            color: state === 'error' ? '#9a3e16' : '#55606f',
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
