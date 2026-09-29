import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type AlertFrequency = 'off' | 'instant' | 'daily'

const ALLOWED_FILTERS = new Set([
  'category',
  'categorySlug',
  'category_slug',
  'minPrice',
  'min_price',
  'maxPrice',
  'max_price',
  'condition',
  'governorate',
  'city',
])

function cleanString(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function normalizeFilters(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const source = value as Record<string, unknown>
  const normalized: Record<string, string> = {}

  for (const [key, raw] of Object.entries(source)) {
    if (!ALLOWED_FILTERS.has(key)) continue
    const value = cleanString(raw, 120)
    if (!value) continue
    normalized[key] = value
  }

  return Object.fromEntries(
    Object.entries(normalized).sort(([left], [right]) => left.localeCompare(right)),
  )
}

function canonicalSearch(query: string, filters: Record<string, string>) {
  return JSON.stringify({ query: query || null, filters })
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    const requestOrigin = new URL(request.url).origin
    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const body = (await request.json()) as {
      name?: unknown
      query?: unknown
      filters?: unknown
      alertFrequency?: unknown
    }

    const query = cleanString(body.query, 80)
    const filters = normalizeFilters(body.filters)
    const name =
      cleanString(body.name, 80) || (query ? 'بحث: ' + query : 'بحث محفوظ')
    const alertFrequency = cleanString(body.alertFrequency, 16) as AlertFrequency

    if (!['off', 'instant', 'daily'].includes(alertFrequency)) {
      return NextResponse.json({ error: 'وتيرة التنبيه غير صالحة.' }, { status: 400 })
    }

    if (!query && Object.keys(filters).length === 0) {
      return NextResponse.json(
        { error: 'أضف عبارة بحث أو فلترًا واحدًا على الأقل.' },
        { status: 400 },
      )
    }

    const searchHash = createHash('sha256')
      .update(canonicalSearch(query, filters))
      .digest('hex')

    const { data, error } = await supabase
      .from('saved_searches')
      .upsert(
        {
          user_id: user.id,
          name,
          query: query || null,
          filters,
          search_hash: searchHash,
          alert_frequency: alertFrequency,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,search_hash' },
      )
      .select(
        'id,name,query,filters,search_hash,alert_frequency,last_match_count,updated_at',
      )
      .single()

    if (error) {
      console.error('DEBA saved buyer intent failed', error)
      return NextResponse.json({ error: 'تعذر حفظ البحث الذكي.' }, { status: 500 })
    }

    return NextResponse.json({ savedSearch: data }, { status: 200 })
  } catch (error) {
    console.error('DEBA saved buyer intent route failed', error)
    return NextResponse.json({ error: 'تعذر حفظ البحث الذكي.' }, { status: 500 })
  }
}
