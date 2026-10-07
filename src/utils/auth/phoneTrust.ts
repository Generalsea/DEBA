import { NextResponse } from 'next/server'
import { isValidEgyptianPhone } from '@/lib/auth/egyptian-phone'
import { createClient } from '@/utils/supabase/server'

export async function getAuthenticatedPhoneTrust() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return {
      supabase,
      user: null,
      phoneVerified: false,
    }
  }

  return {
    supabase,
    user: data.user,
    phoneVerified: Boolean(
      data.user.phone &&
        data.user.phone_confirmed_at &&
        isValidEgyptianPhone(data.user.phone),
    ),
  }
}

export async function requireVerifiedPhone() {
  const trust = await getAuthenticatedPhoneTrust()

  if (!trust.user) {
    return {
      ...trust,
      response: NextResponse.json(
        { error: 'يجب تسجيل الدخول.' },
        { status: 401 },
      ),
    }
  }

  if (!trust.phoneVerified) {
    return {
      ...trust,
      response: NextResponse.json(
        {
          error: 'يجب توثيق رقم الهاتف المصري قبل تنفيذ هذا الإجراء.',
          code: 'PHONE_VERIFICATION_REQUIRED',
        },
        { status: 403 },
      ),
    }
  }

  return {
    ...trust,
    response: null,
  }
}
