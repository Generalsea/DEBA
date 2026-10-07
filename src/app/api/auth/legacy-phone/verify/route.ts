import { NextResponse } from 'next/server'
import { assertEgyptianPhone } from '@/lib/auth/egyptian-phone'
import { checkLegacyPhoneWhatsAppVerification } from '@/lib/auth/legacyPhoneVerification'
import { enforceOtpVerifyRateLimits } from '@/utils/auth/otpRateLimit'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

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
          error: 'هذا الحساب مرتبط بالفعل بهاتف. لم يتم تغيير الهوية.',
          code: 'PHONE_ALREADY_LINKED',
        },
        { status: 409 },
      )
    }

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

    if (!(await enforceOtpVerifyRateLimits(request, phone))) {
      return NextResponse.json(
        { error: 'تم تجاوز محاولات التحقق مؤقتًا. حاول لاحقًا.' },
        { status: 429 },
      )
    }

    const verification = await checkLegacyPhoneWhatsAppVerification(phone, token)
    const verified =
      verification.status === 'approved' &&
      verification.valid !== false &&
      String(verification.channel || '').toLowerCase() === 'whatsapp'

    if (!verified) {
      console.error('DEBA legacy phone WhatsApp verification rejected', {
        status: verification.status,
        channel: verification.channel,
      })

      return NextResponse.json(
        { error: 'رمز التحقق غير صحيح أو لم يتم توثيقه عبر WhatsApp.' },
        { status: 401 },
      )
    }

    const admin = createAdminClient()
    const { data: updatedUser, error: updateError } =
      await admin.auth.admin.updateUserById(authData.user.id, {
        phone,
        phone_confirm: true,
      })

    if (updateError || !updatedUser.user) {
      console.error('DEBA legacy phone Auth binding failed', updateError)
      return NextResponse.json(
        { error: 'تم التحقق من الهاتف لكن تعذر ربطه بالحساب. لم يتم اعتماد الربط.' },
        { status: 503 },
      )
    }

    const { error: privateProfileError } = await admin
      .from('profile_private')
      .upsert(
        {
          user_id: authData.user.id,
          phone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (privateProfileError) {
      console.error('DEBA legacy phone private-profile sync failed', privateProfileError)

      // The Auth update above is the canonical identity mutation. If the
      // database mirror cannot be synchronized, immediately clear the phone
      // rather than leaving two sources of truth out of sync.
      const { error: rollbackError } =
        await admin.auth.admin.updateUserById(authData.user.id, {
          phone: null,
          phone_confirm: false,
        })

      if (rollbackError) {
        console.error('DEBA legacy phone rollback failed', rollbackError)
        return NextResponse.json(
          {
            error:
              'تعذر إكمال ربط الهاتف بصورة آمنة. تم إيقاف العملية ويجب مراجعة الحساب قبل إعادة المحاولة.',
            code: 'LEGACY_PHONE_BINDING_NEEDS_REVIEW',
          },
          { status: 503 },
        )
      }

      return NextResponse.json(
        { error: 'تعذر مزامنة بيانات الهاتف بأمان. لم يتم اعتماد الربط.' },
        { status: 503 },
      )
    }

    return NextResponse.json(
      {
        ok: true,
        authenticated: true,
        phoneVerified: true,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_EGYPTIAN_PHONE') {
      return NextResponse.json(
        { error: 'رقم الهاتف غير صالح.' },
        { status: 400 },
      )
    }

    console.error('DEBA legacy phone WhatsApp verification failed', error)
    return NextResponse.json(
      { error: 'تعذر إكمال ربط الهاتف الآن.' },
      { status: 503 },
    )
  }
}
