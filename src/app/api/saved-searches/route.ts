import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const FREQUENCIES = new Set(['off', 'instant', 'daily'])

function hashSearch(query: string | null, filters: Record<string, unknown>) {
  const normalized = JSON.stringify({
    query: query?.trim().toLowerCase() || null,
    filters,
  })
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { data, error } = await supabase
      .from('saved_searches')
      .select('id,name,query,filters,search_hash,alert_frequency,last_notified_at,last_match_count,created_at,updated_at')
      .eq('user_id', userData.user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('DEBA saved searches GET failed', error)
      return NextResponse.json({ error: 'تعذر تحميل عمليات البحث المحفوظة.' }, { status: 500 })
    }

    return NextResponse.json({ searches: data || [] })
  } catch (error) {
    console.error('DEBA saved searches route failed', error)
    return NextResponse.json({ error: 'تعذر تحميل عمليات البحث المحفوظة.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const body = (await request.json()) as {
      name?: string
      query?: string
      filters?: Record<string, unknown>
      alertFrequency?: string
    }

    const name = body.name?.trim() || 'بحث محفوظ'
    const query = body.query?.trim() || null
    const filters = body.filters && typeof body.filters === 'object' ? body.filters : {}
    const alertFrequency = body.alertFrequency?.trim() || 'off'

    if (name.length > 100) return NextResponse.json({ error: 'اسم البحث طويل جدًا.' }, { status: 400 })
    if (query && query.length > 120) return NextResponse.json({ error: 'نص البحث طويل جدًا.' }, { status: 400 })
    if (!FREQUENCIES.has(alertFrequency)) return NextResponse.json({ error: 'تواتر التنبيه غير صالح.' }, { status: 400 })

    const searchHash = hashSearch(query, filters)

    const { data, error } = await supabase
      .from('saved_searches')
      .upsert({
        user_id: userData.user.id,
        name,
        query,
        filters,
        search_hash: searchHash,
        alert_frequency: alertFrequency,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,search_hash' })
      .select('id,name,query,filters,search_hash,alert_frequency,last_notified_at,last_match_count,created_at,updated_at')
      .single()

    if (error) {
      console.error('DEBA saved search create failed', error)
      return NextResponse.json({ error: 'تعذر حفظ البحث.' }, { status: 500 })
    }

    return NextResponse.json({ search: data }, { status: 201 })
  } catch (error) {
    console.error('DEBA saved search POST failed', error)
    return NextResponse.json({ error: 'تعذر حفظ البحث.' }, { status: 500 })
  }
}
