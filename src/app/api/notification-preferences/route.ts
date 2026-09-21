import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const KEYS = [
  'order_updates',
  'payment_updates',
  'shipping_updates',
  'security_updates',
  'marketing_updates',
] as const

type PreferenceKey = (typeof KEYS)[number]
type Body = Partial<Record<PreferenceKey, boolean>>

function isAllowedKey(value: string): value is PreferenceKey {
  return (KEYS as readonly string[]).includes(value)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('order_updates,payment_updates,shipping_updates,security_updates,marketing_updates')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (error) {
      console.error('DEBA notification preferences lookup failed', error)
      return NextResponse.json({ error: 'تعذر تحميل تفضيلات الإشعارات.' }, { status: 500 })
    }

    return NextResponse.json({
      preferences: data || {
        order_updates: true,
        payment_updates: true,
        shipping_updates: true,
        security_updates: true,
        marketing_updates: true,
      },
    })
  } catch (error) {
    console.error('DEBA notification preferences GET failed', error)
    return NextResponse.json({ error: 'تعذر تحميل تفضيلات الإشعارات.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const body = (await request.json()) as Body
    const patch: Body = {}

    for (const [key, value] of Object.entries(body)) {
      if (isAllowedKey(key) && typeof value === 'boolean') patch[key] = value
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'لا توجد إعدادات صالحة للتحديث.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: user.id,
          ...patch,
        },
        { onConflict: 'user_id' },
      )
      .select('order_updates,payment_updates,shipping_updates,security_updates,marketing_updates')
      .single()

    if (error) {
      console.error('DEBA notification preferences update failed', error)
      return NextResponse.json({ error: 'تعذر حفظ تفضيلات الإشعارات.' }, { status: 500 })
    }

    return NextResponse.json({ preferences: data })
  } catch (error) {
    console.error('DEBA notification preferences PATCH failed', error)
    return NextResponse.json({ error: 'تعذر حفظ تفضيلات الإشعارات.' }, { status: 500 })
  }
}
