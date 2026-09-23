'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'

type ClassifiedFilterBarProps = {
  q?: string
  category?: string
  governorate?: string
  condition?: string
  minPrice?: number | null
  maxPrice?: number | null
}

function rangeValue(minPrice?: number | null, maxPrice?: number | null) {
  if (minPrice === 0 && maxPrice === 500) return '0-500'
  if (minPrice === 500 && maxPrice === 1000) return '500-1000'
  if (minPrice === 1000 && maxPrice === 5000) return '1000-5000'
  if (minPrice === 5000 && maxPrice == null) return '5000+'
  return ''
}

function navigate(
  router: ReturnType<typeof useRouter>,
  state: { q?: string; category?: string; governorate?: string; condition?: string; minPrice?: number | null; maxPrice?: number | null },
) {
  const params = new URLSearchParams()
  if (state.q?.trim()) params.set('q', state.q.trim())
  if (state.category && state.category !== 'all') params.set('category', state.category)
  if (state.governorate) params.set('governorate', state.governorate)
  if (state.condition) params.set('condition', state.condition)
  if (state.minPrice != null) params.set('minPrice', String(state.minPrice))
  if (state.maxPrice != null) params.set('maxPrice', String(state.maxPrice))
  router.push('/' + (params.toString() ? '?' + params.toString() : ''))
}

export default function ClassifiedFilterBar({
  q,
  category,
  governorate,
  condition,
  minPrice,
  maxPrice,
}: ClassifiedFilterBarProps) {
  const router = useRouter()
  const [location, setLocation] = useState(governorate || '')
  const [activeCondition, setActiveCondition] = useState(condition || '')
  const [range, setRange] = useState(rangeValue(minPrice, maxPrice))

  const applyLocation = (next: string) => {
    setLocation(next)
    navigate(router, {
      q,
      category,
      governorate: next,
      condition: activeCondition,
      minPrice,
      maxPrice,
    })
  }

  const applyCondition = (next: string) => {
    setActiveCondition(next)
    navigate(router, {
      q,
      category,
      governorate: location,
      condition: next,
      minPrice,
      maxPrice,
    })
  }

  const applyRange = (next: string) => {
    setRange(next)
    const values =
      next === '0-500'
        ? { minPrice: 0, maxPrice: 500 }
        : next === '500-1000'
          ? { minPrice: 500, maxPrice: 1000 }
          : next === '1000-5000'
            ? { minPrice: 1000, maxPrice: 5000 }
            : next === '5000+'
              ? { minPrice: 5000, maxPrice: null }
              : { minPrice: null, maxPrice: null }

    navigate(router, {
      q,
      category,
      governorate: location,
      condition: activeCondition,
      ...values,
    })
  }

  return (
    <div className="deba-classified-filters-bar" aria-label="تصفية الإعلانات">
      <div className="deba-classified-filter-group">
        <span className="deba-classified-filter-label">الموقع:</span>
        <div className="deba-classified-select-wrap">
          <MapPin size={14} aria-hidden="true" />
          <select
            className="deba-classified-filter-select"
            value={location}
            onChange={(event) => applyLocation(event.target.value)}
            aria-label="تصفية حسب الموقع"
          >
            <option value="">جميع المواقع</option>
            <option value="القاهرة">القاهرة</option>
            <option value="الإسكندرية">الإسكندرية</option>
            <option value="الجيزة">الجيزة</option>
            <option value="الدقهلية">الدقهلية</option>
            <option value="البحر الأحمر">البحر الأحمر</option>
            <option value="المنوفية">المنوفية</option>
            <option value="الغربية">الغربية</option>
            <option value="الشرقية">الشرقية</option>
            <option value="القليوبية">القليوبية</option>
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
      </div>

      <div className="deba-classified-filter-group">
        <span className="deba-classified-filter-label">الحالة:</span>
        <button
          type="button"
          className={'deba-classified-filter-chip' + (!activeCondition ? ' active' : '')}
          onClick={() => applyCondition('')}
        >
          الكل
        </button>
        <button
          type="button"
          className={'deba-classified-filter-chip' + (activeCondition === 'new' ? ' active' : '')}
          onClick={() => applyCondition('new')}
        >
          جديد
        </button>
        <button
          type="button"
          className={'deba-classified-filter-chip' + (activeCondition === 'used' ? ' active' : '')}
          onClick={() => applyCondition('used')}
        >
          مستعمل
        </button>
      </div>

      <div className="deba-classified-filter-group">
        <span className="deba-classified-filter-label">السعر:</span>
        <div className="deba-classified-select-wrap">
          <select
            className="deba-classified-filter-select"
            value={range}
            onChange={(event) => applyRange(event.target.value)}
            aria-label="تصفية حسب السعر"
          >
            <option value="">أي سعر</option>
            <option value="0-500">أقل من 500 جنيه</option>
            <option value="500-1000">500 - 1000 جنيه</option>
            <option value="1000-5000">1000 - 5000 جنيه</option>
            <option value="5000+">أكثر من 5000 جنيه</option>
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
