import { NextResponse } from 'next/server'
import { assertEgyptianPhone } from '@/lib/auth/egyptian-phone'
import { verifyWhatsAppOtp } from '@/lib/auth/whatsappOtpProvider'
import { enforceOtpVerifyRateLimits } from '@/utils/auth/otpRateLimit'
import { createClient } from '@/utils/supabase/server'

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
  }

  try {
    const body = (await request.json()) as {
      phone?: unknown
      token?: unknown
    }

    const phone = assertEgyptianPhone(typeof body.phone === 'string' ? body.phone : '')
    const token =
      typeof body.token === 'string' ? body.token.replace(/\s/g, '') : ''

    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: 'أدخل رمز التحقق المكوّن من 6 أرقام.' },
        { status: 400 },
      )
    }

    const allowed = await enforceOtpVerifyRateLimits(request, phone)
    if (!allowed) {
      return NextResponse.json(
        { error: 'تم تجاوز محاولات التحقق مؤقتًا. حاول لاحقًا.' },
        { status: 429 },
      )
    }

    const supabase = await createClient()
    const { data, error } = await verifyWhatsAppOtp(supabase, phone, token)

    if (error || !data.session || !data.user) {
      console.error('DEBA WhatsApp OTP verification failed', {
        code: error?.code,
        status: error?.status,
      })

      return NextResponse.json(
        { error: 'رمز التحقق غير صحيح أو انتهت صلاحيته.' },
        { status: 401 },
      )
    }

    return NextResponse.json(
      {
        authenticated: true,
        phoneVerified: true,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_EGYPTIAN_PHONE') {
      return NextResponse.json(
        { error: 'رقم الهاتف غير صالح.' },
        { status: 400 },
      )
    }

    console.error('DEBA WhatsApp OTP verify route failed', error)
    return NextResponse.json(
      { error: 'تعذر التحقق من الرمز الآن. حاول مرة أخرى.' },
      { status: 400 },
    )
  }
}
