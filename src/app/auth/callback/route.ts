import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/'
  }

  return value
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const nextPath = getSafeNextPath(requestUrl.searchParams.get('next'))
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ||
    (forwardedHost
      ? forwardedProto + '://' + forwardedHost
      : requestUrl.origin)

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/login?error=auth', origin))
  }

  const requestedAccountType = requestUrl.searchParams.get('account_type')
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId =
    claimsData?.claims && typeof claimsData.claims.sub === 'string'
      ? claimsData.claims.sub
      : null

  if (
    userId &&
    (requestedAccountType === 'buyer' || requestedAccountType === 'seller')
  ) {
    await supabase
      .from('profiles')
      .update({
        account_type: requestedAccountType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
  }

  return NextResponse.redirect(new URL(nextPath, origin))
}
