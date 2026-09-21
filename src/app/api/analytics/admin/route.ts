import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .in('role', ['admin'])
      .limit(1)
      .maybeSingle()

    if (!role) {
      return NextResponse.json({ error: 'لا تملك صلاحية الإدارة.' }, { status: 403 })
    }

    const { data, error } = await supabase.rpc('get_admin_analytics')

    if (error) {
      console.error('DEBA admin analytics failed', error)
      return NextResponse.json({ error: 'تعذر تحميل تحليلات الإدارة.' }, { status: 500 })
    }

    return NextResponse.json({ analytics: data })
  } catch (error) {
    console.error('DEBA admin analytics route failed', error)
    return NextResponse.json({ error: 'تعذر تحميل تحليلات الإدارة.' }, { status: 500 })
  }
}
