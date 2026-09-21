import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type Body = {
  notificationId?: string
  all?: boolean
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { data, error } = await supabase
      .from('notifications')
      .select('id,type,title,body,href,read_at,metadata,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('DEBA notification list failed', error)
      return NextResponse.json({ error: 'تعذر تحميل الإشعارات.' }, { status: 500 })
    }

    return NextResponse.json({ notifications: data || [] })
  } catch (error) {
    console.error('DEBA notification route failed', error)
    return NextResponse.json({ error: 'تعذر تحميل الإشعارات.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Body
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    if (body.all) {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null)

      if (error) {
        console.error('DEBA mark all notifications failed', error)
        return NextResponse.json({ error: 'تعذر تحديث الإشعارات.' }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    const notificationId = typeof body.notificationId === 'string' ? body.notificationId.trim() : ''
    if (!notificationId) {
      return NextResponse.json({ error: 'معرّف الإشعار غير صالح.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', user.id)

    if (error) {
      console.error('DEBA mark notification failed', error)
      return NextResponse.json({ error: 'تعذر تحديث الإشعار.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DEBA notification update failed', error)
    return NextResponse.json({ error: 'تعذر تحديث الإشعارات.' }, { status: 500 })
  }
}
