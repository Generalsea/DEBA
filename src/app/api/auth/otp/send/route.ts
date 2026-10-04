import { NextResponse } from 'next/server'
import { assertEgyptianPhone } from '@/lib/auth/egyptian-phone'
import { enforceOtpSendRateLimits } from '@/utils/auth/otpRateLimit'
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
      accountType?: unknown
    }

    const phone = assertEgyptianPhone(typeof body.phone === 'string' ? body.phone : '')
    const accountType = body.accountType === 'seller' ? 'seller' : 'buyer'

    const allowed = await enforceOtpSendRateLimits(request, phone)
    if (!allowed) {
      return NextResponse.json(
        { error: 'تعذر إرسال رمز التحقق الآن. حاول بعد قليل.' },
        { status: 429 },
      )
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        channel: 'whatsapp',
        shouldCreateUser: true,
        data: {
          account_type: accountType,
        },
      },
    })

    if (error) {
      console.error('DEBA WhatsApp OTP send failed', {
        code: error.code,
        status: error.status,
      })

      return NextResponse.json(
        { error: 'تعذر إرسال رمز WhatsApp الآن. حاول مرة أخرى لاحقًا.' },
        { status: 503 },
      )
    }

    return NextResponse.json(
      {
        sent: true,
        channel: 'whatsapp',
        expiresInSeconds: 60 * 60,
        resendAfterSeconds: 60,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_EGYPTIAN_PHONE') {
      return NextResponse.json(
        { error: 'أدخل رقم هاتف مصري صحيحًا يبدأ بـ +20.' },
        { status: 400 },
      )
    }

    console.error('DEBA WhatsApp OTP send route failed', error)
    return NextResponse.json(
      { error: 'تعذر إرسال رمز التحقق الآن. حاول مرة أخرى.' },
      { status: 400 },
    )
  }
}
