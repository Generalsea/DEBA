import type { SupabaseClient } from '@supabase/supabase-js'

export type WhatsAppOtpAccountType = 'buyer' | 'seller'

export async function sendWhatsAppOtp(
  supabase: SupabaseClient,
  phone: string,
  accountType: WhatsAppOtpAccountType,
) {
  return supabase.auth.signInWithOtp({
    phone,
    options: {
      channel: 'whatsapp',
      shouldCreateUser: true,
      data: {
        account_type: accountType,
      },
    },
  })
}

export async function verifyWhatsAppOtp(
  supabase: SupabaseClient,
  phone: string,
  token: string,
) {
  return supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })
}
