import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/proxy'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/deba-comms.html') {
    const url = request.nextUrl.clone()
    url.pathname = '/chat'
    return Response.redirect(url)
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
