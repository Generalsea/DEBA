import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const COOKIE_NAME = 'deba_visitor_id'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin')
    const requestOrigin = new URL(request.url).origin
    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
    }

    const { id } = await params
    const cookieStore = await cookies()
    let visitorId = cookieStore.get(COOKIE_NAME)?.value || ''

    if (!UUID_PATTERN.test(visitorId)) {
      visitorId = crypto.randomUUID()
    }

    const supabase = await createClient()
    const { error } = await supabase.rpc('record_product_view', {
      p_product_id: id,
      p_visitor_key: visitorId,
    })

    if (error) {
      console.error('DEBA product view tracking failed', error)
      return NextResponse.json({ error: 'تعذر تسجيل المشاهدة.' }, { status: 500 })
    }

    const response = NextResponse.json({ ok: true })

    if (cookieStore.get(COOKIE_NAME)?.value !== visitorId) {
      response.cookies.set({
        name: COOKIE_NAME,
        value: visitorId,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    return response
  } catch (error) {
    console.error('DEBA product view route failed', error)
    return NextResponse.json({ error: 'تعذر تسجيل المشاهدة.' }, { status: 500 })
  }
}
