import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('get_seller_analytics')

    if (error) {
      console.error('DEBA seller analytics failed', error)
      return NextResponse.json({ error: 'تعذر تحميل تحليلات البائع.' }, { status: 500 })
    }

    return NextResponse.json({ analytics: data })
  } catch (error) {
    console.error('DEBA seller analytics route failed', error)
    return NextResponse.json({ error: 'تعذر تحميل تحليلات البائع.' }, { status: 500 })
  }
}
