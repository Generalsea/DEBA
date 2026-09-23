'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import { EGYPT_LOCATIONS, getCitiesForGovernorate } from '@/data/egypt-locations'

type ClassifiedFilterBarProps = {
  q?: string
  category?: string
  governorate?: string
  city?: string
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
  state: { q?: string; category?: string; governorate?: string; city?: string; condition?: string; minPrice?: number | null; maxPrice?: number | null },
) {
  const params = new URLSearchParams()
  if (state.q?.trim()) params.set('q', state.q.trim())
  if (state.category && state.category !== 'all') params.set('category', state.category)
  if (state.governorate) params.set('governorate', state.governorate)
  if (state.city) params.set('city', state.city)
  if (state.condition) params.set('condition', state.condition)
  if (state.minPrice != null) params.set('minPrice', String(state.minPrice))
  if (state.maxPrice != null) params.set('maxPrice', String(state.maxPrice))
  router.push('/' + (params.toString() ? '?' + params.toString() : ''))
}

export default function ClassifiedFilterBar({
  q,
  category,
  governorate,
  city,
  condition,
  minPrice,
  maxPrice,
}: ClassifiedFilterBarProps) {
  const router = useRouter()
  const [location, setLocation] = useState(governorate || '')
  const [selectedCity, setSelectedCity] = useState(city || '')
  const cities = getCitiesForGovernorate(location)
  const [activeCondition, setActiveCondition] = useState(condition || '')
  const [range, setRange] = useState(rangeValue(minPrice, maxPrice))

  const applyLocation = (next: string) => {
    setLocation(next)
    setSelectedCity('')
    navigate(router, {
      q,
      category,
      governorate: next,
      city: undefined,
      condition: activeCondition,
      minPrice,
      maxPrice,
    })
  }

  const applyCity = (next: string) => {
    setSelectedCity(next)
    navigate(router, {
      q,
      category,
      governorate: location,
      city: next,
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
      city: selectedCity,
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
      city: selectedCity,
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
            {EGYPT_LOCATIONS.map((item) => (
              <option key={item.name_ar} value={item.name_ar}>{item.name_ar}</option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
        <div className="deba-classified-select-wrap">
          <select
            className="deba-classified-filter-select"
            value={selectedCity}
            onChange={(event) => applyCity(event.target.value)}
            aria-label="تصفية حسب المدينة"
            disabled={!location}
          >
            <option value="">{location ? 'جميع المدن' : 'اختر المحافظة أولًا'}</option>
            {cities.map((item) => <option key={item} value={item}>{item}</option>)}
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
