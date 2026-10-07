import { NextResponse } from 'next/server'
import { assertEgyptianPhone } from '@/lib/auth/egyptian-phone'
import {
  LegacyPhoneVerificationConfigurationError,
  sendLegacyPhoneWhatsAppVerification,
} from '@/lib/auth/legacyPhoneVerification'
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
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولًا.' }, { status: 401 })
    }

    if (authData.user.phone) {
      return NextResponse.json(
        {
          error: 'هذا الحساب مرتبط بالفعل بهاتف. استخدم دخول الهاتف المعتاد.',
          code: 'PHONE_ALREADY_LINKED',
        },
        { status: 409 },
      )
    }

    if (!authData.user.email || !authData.user.email_confirmed_at) {
      return NextResponse.json(
        {
          error: 'يجب تأكيد بريد الحساب القديم قبل ربط هاتف جديد.',
          code: 'LEGACY_EMAIL_NOT_CONFIRMED',
        },
        { status: 403 },
      )
    }

    const body = (await request.json()) as { phone?: unknown }
    const phone = assertEgyptianPhone(typeof body.phone === 'string' ? body.phone : '')

    if (!(await enforceOtpSendRateLimits(request, phone))) {
      return NextResponse.json(
        { error: 'تعذر إرسال رمز التحقق الآن. حاول بعد قليل.' },
        { status: 429 },
      )
    }

    const verification = await sendLegacyPhoneWhatsAppVerification(phone)

    const latestAttempt = verification.send_code_attempts?.at(-1)
    const actualChannel = latestAttempt?.channel || verification.channel || ''

    if (actualChannel.toLowerCase() !== 'whatsapp') {
      return NextResponse.json(
        {
          error: 'تعذر ضمان إرسال رمز التحقق عبر WhatsApp فقط. لم يتم إكمال الربط.',
          code: 'WHATSAPP_CHANNEL_NOT_CONFIRMED',
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      {
        sent: true,
        channel: 'whatsapp',
        resendAfterSeconds: 60,
        expiresInSeconds: 10 * 60,
      },
      {
        status: 202,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_EGYPTIAN_PHONE') {
      return NextResponse.json(
        { error: 'أدخل رقم هاتف مصري صحيحًا يبدأ بـ +20.' },
        { status: 400 },
      )
    }

    if (error instanceof LegacyPhoneVerificationConfigurationError) {
      console.error('DEBA legacy phone verification is not configured')
      return NextResponse.json(
        { error: 'ربط الحسابات القديمة عبر WhatsApp غير مهيأ بعد.' },
        { status: 503 },
      )
    }

    console.error('DEBA legacy phone WhatsApp send failed', error)
    return NextResponse.json(
      { error: 'تعذر إرسال رمز التحقق الآن. حاول مرة أخرى.' },
      { status: 503 },
    )
  }
}
