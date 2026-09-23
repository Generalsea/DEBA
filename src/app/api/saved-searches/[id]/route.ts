import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { id } = await context.params
    const body = (await request.json()) as { name?: string; alertFrequency?: string }

    const patch: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = body.name.trim()
      if (!name || name.length > 100) return NextResponse.json({ error: 'اسم البحث غير صالح.' }, { status: 400 })
      patch.name = name
    }
    if (body.alertFrequency !== undefined) {
      if (!['off', 'instant', 'daily'].includes(body.alertFrequency)) {
        return NextResponse.json({ error: 'تواتر التنبيه غير صالح.' }, { status: 400 })
      }
      patch.alert_frequency = body.alertFrequency
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'لا توجد تغييرات.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .select('id,name,query,filters,search_hash,alert_frequency,last_notified_at,last_match_count,created_at,updated_at')
      .maybeSingle()

    if (error) {
      console.error('DEBA saved search update failed', error)
      return NextResponse.json({ error: 'تعذر تحديث البحث.' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'البحث المحفوظ غير موجود.' }, { status: 404 })

    return NextResponse.json({ search: data })
  } catch (error) {
    console.error('DEBA saved search PATCH failed', error)
    return NextResponse.json({ error: 'تعذر تحديث البحث.' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { id } = await context.params
    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', id)
      .eq('user_id', userData.user.id)

    if (error) {
      console.error('DEBA saved search delete failed', error)
      return NextResponse.json({ error: 'تعذر حذف البحث.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DEBA saved search DELETE failed', error)
    return NextResponse.json({ error: 'تعذر حذف البحث.' }, { status: 500 })
  }
}
