import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cleanNullable(value: unknown, max: number) {
  const result = clean(value, max)
  return result || null
}

function validPhone(value: string | null) {
  if (!value) return true
  return /^01\d{9}$/.test(value.replace(/\s/g, ''))
}

export async function PATCH(request: Request) {
  try {
    const origin = request.headers.get('origin')
    const requestOrigin = new URL(request.url).origin
    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const userId = claimsData?.claims?.sub

    if (typeof userId !== 'string') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول لإدارة الحساب.' }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const hasAvatarUrl = Object.prototype.hasOwnProperty.call(body, 'avatarUrl')
    const requestedAvatarUrl =
      hasAvatarUrl && body.avatarUrl === null ? null : clean(body.avatarUrl, 200)
    const displayName = clean(body.displayName, 120)
    const username = cleanNullable(body.username, 40)
    const bio = cleanNullable(body.bio, 500)
    const city = cleanNullable(body.city, 100)
    const governorate = cleanNullable(body.governorate, 100)
    const phone = cleanNullable(body.phone, 30)
    const addressLine1 = cleanNullable(body.addressLine1, 180)
    const addressLine2 = cleanNullable(body.addressLine2, 180)
    const district = cleanNullable(body.district, 100)
    const postalCode = cleanNullable(body.postalCode, 20)
    const isPublic = body.isPublic === true
    const requestedAccountType =
      body.accountType === 'seller' || body.accountType === 'buyer'
        ? body.accountType
        : null

    if (displayName.length < 2) {
      return NextResponse.json({ error: 'الاسم الظاهر يجب ألا يقل عن حرفين.' }, { status: 400 })
    }

    if (username && !/^[a-zA-Z0-9_\u0600-\u06FF.-]{3,40}$/.test(username)) {
      return NextResponse.json(
        { error: 'اسم المستخدم يحتوي على محارف غير مسموحة أو قصير جدًا.' },
        { status: 400 },
      )
    }

    if (!validPhone(phone)) {
      return NextResponse.json({ error: 'رقم الهاتف المصري غير صالح.' }, { status: 400 })
    }

    const expectedAvatarPath = userId + '/avatar.webp'
    if (hasAvatarUrl && requestedAvatarUrl && requestedAvatarUrl !== expectedAvatarPath) {
      return NextResponse.json({ error: 'مسار الصورة الشخصية غير صالح.' }, { status: 400 })
    }

    const { data: currentProfile, error: currentProfileError } = await supabase
      .from('profiles')
      .select('id,account_type')
      .eq('id', userId)
      .maybeSingle()

    if (currentProfileError || !currentProfile) {
      return NextResponse.json({ error: 'ملف الحساب غير موجود.' }, { status: 404 })
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        username,
        bio,
        city,
        governorate,
        is_public: isPublic,
        ...(requestedAccountType === 'seller' ? { account_type: 'seller' } : {}),
        ...(hasAvatarUrl ? { avatar_url: requestedAvatarUrl } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (profileError) {
      if (profileError.code === '23505') {
        return NextResponse.json({ error: 'اسم المستخدم مستخدم بالفعل.' }, { status: 409 })
      }
      console.error('DEBA profile update failed', profileError)
      return NextResponse.json({ error: 'تعذر حفظ بيانات الملف العام.' }, { status: 500 })
    }

    const { error: privateError } = await supabase
      .from('profile_private')
      .upsert(
        {
          user_id: userId,
          phone,
          address_line1: addressLine1,
          address_line2: addressLine2,
          district,
          postal_code: postalCode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (privateError) {
      console.error('DEBA private profile update failed', privateError)
      return NextResponse.json(
        { error: 'تم حفظ الملف العام، لكن تعذر حفظ بعض البيانات الخاصة.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      accountType: requestedAccountType || currentProfile.account_type,
      ...(hasAvatarUrl ? { avatarUrl: requestedAvatarUrl } : {}),
    })
  } catch (error) {
    console.error('DEBA profile route failed', error)
    return NextResponse.json({ error: 'تعذر تحديث الحساب الآن.' }, { status: 500 })
  }
}
