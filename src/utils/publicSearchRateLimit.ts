import 'server-only'

import { createHmac } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const PUBLIC_SEARCH_RATE_LIMIT = 60
export const PUBLIC_SEARCH_RATE_WINDOW_SECONDS = 60

const SEARCH_PARAM_KEYS = [
  'q',
  'category',
  'minPrice',
  'maxPrice',
  'condition',
  'governorate',
  'city',
  'sort',
  'page',
] as const

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
}

function getServerRateLimitSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
}

function getClientIp(request: NextRequest) {
  const vercelIp = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  if (vercelIp) return vercelIp

  const forwardedIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedIp || ''
}

function hashClientIp(ip: string, secret: string) {
  return createHmac('sha256', secret).update(ip).digest('hex')
}

export function isPublicSearchRequest(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  if (request.nextUrl.pathname !== '/') return false

  return SEARCH_PARAM_KEYS.some((key) => request.nextUrl.searchParams.has(key))
}

export async function enforcePublicSearchRateLimit(request: NextRequest) {
  if (!isPublicSearchRequest(request)) return null

  const secret = getServerRateLimitSecret()
  if (!secret) {
    if (isProductionRuntime()) {
      return NextResponse.json(
        { error: 'حماية البحث العام غير مهيأة على بيئة الإنتاج.' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'X-DEBA-Rate-Limit': 'configuration-error',
          },
        },
      )
    }

    console.warn('DEBA public-search rate limiter skipped: server secret is not configured')
    return null
  }

  const clientIp = getClientIp(request)
  if (!clientIp) {
    if (isProductionRuntime()) {
      return NextResponse.json(
        { error: 'تعذر التحقق من مصدر الطلب.' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'X-DEBA-Rate-Limit': 'client-ip-unavailable',
          },
        },
      )
    }

    return null
  }

  const rateKey = 'public-search:ip:' + hashClientIp(clientIp, secret)
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('consume_api_rate_limit', {
    p_rate_key: rateKey,
    p_limit: PUBLIC_SEARCH_RATE_LIMIT,
    p_window_seconds: PUBLIC_SEARCH_RATE_WINDOW_SECONDS,
  })

  if (error) {
    console.error('DEBA public-search rate-limit check failed', error)
    return NextResponse.json(
      { error: 'حماية البحث العام غير متاحة مؤقتًا. حاول لاحقًا.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(PUBLIC_SEARCH_RATE_LIMIT),
          'X-DEBA-Rate-Limit': 'backend-error',
        },
      },
    )
  }

  if (data !== true) {
    return NextResponse.json(
      { error: 'تم تجاوز حد البحث المؤقت. حاول بعد قليل.' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(PUBLIC_SEARCH_RATE_LIMIT),
          'X-DEBA-Rate-Limit': '60-per-60s-per-ip',
        },
      },
    )
  }

  return null
}
