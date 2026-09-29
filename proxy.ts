import { type NextRequest } from 'next/server'
import { enforcePublicSearchRateLimit } from '@/utils/publicSearchRateLimit'
import { updateSession } from '@/utils/supabase/proxy'

export async function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === '/deba-comms.html' &&
    request.headers.get('sec-fetch-dest') !== 'iframe'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/chat'
    return Response.redirect(url)
  }

  const searchRateLimitResponse = await enforcePublicSearchRateLimit(request)
  if (searchRateLimitResponse) return searchRateLimitResponse

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
