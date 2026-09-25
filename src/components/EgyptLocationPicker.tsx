'use client'

import { MapPin } from 'lucide-react'
import { EGYPT_LOCATIONS, getCitiesForGovernorate } from '@/data/egypt-locations'

type Props = {
  governorate: string
  city: string
  district?: string
  onGovernorateChange: (value: string) => void
  onCityChange: (value: string) => void
  onDistrictChange?: (value: string) => void
  compact?: boolean
  required?: boolean
}

export default function EgyptLocationPicker({
  governorate,
  city,
  district,
  onGovernorateChange,
  onCityChange,
  onDistrictChange,
  compact = false,
  required = true,
}: Props) {
  const cities = getCitiesForGovernorate(governorate)

  function changeGovernorate(value: string) {
    onGovernorateChange(value)
    onCityChange('')
  }

  return (
    <div className={'deba-location-picker' + (compact ? ' is-compact' : '')}>
      <label>
        <span><MapPin size={14} /> المحافظة{required ? ' *' : ''}</span>
        <select value={governorate} onChange={(event) => changeGovernorate(event.target.value)} required={required}>
          <option value="">اختر المحافظة</option>
          {EGYPT_LOCATIONS.map((item) => (
            <option key={item.name_ar} value={item.name_ar}>{item.name_ar}</option>
          ))}
        </select>
      </label>

      <label>
        <span><MapPin size={14} /> المدينة{required ? ' *' : ''}</span>
        <select
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
          required={required}
          disabled={!governorate}
        >
          <option value="">{governorate ? 'اختر المدينة' : 'اختر المحافظة أولًا'}</option>
          {cities.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      {onDistrictChange ? (
        <label>
          <span>الحي / المنطقة{required ? ' *' : ''}</span>
          <input
            value={district || ''}
            onChange={(event) => onDistrictChange(event.target.value)}
            placeholder="مثال: المعادي الجديدة"
            maxLength={100}
            required={required}
          />
        </label>
      ) : null}
    </div>
  )
}
