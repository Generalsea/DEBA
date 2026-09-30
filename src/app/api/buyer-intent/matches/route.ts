import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = Math.min(
      Math.max(Number(url.searchParams.get('limit') || 50), 1),
      50,
    )

    const { data, error } = await supabase.rpc('get_buyer_intent_matches', {
      p_limit: limit,
    })

    if (error) {
      console.error('DEBA buyer intent match feed failed', error)
      return NextResponse.json({ error: 'تعذر تحميل المطابقات الذكية.' }, { status: 500 })
    }

    return NextResponse.json({ matches: data || [] })
  } catch (error) {
    console.error('DEBA buyer intent match route failed', error)
    return NextResponse.json({ error: 'تعذر تحميل المطابقات الذكية.' }, { status: 500 })
  }
}
