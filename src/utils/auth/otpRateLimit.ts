import { createHash } from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'

type RateWindow = {
  scope: string
  value: string
  limit: number
  windowSeconds: number
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const direct = request.headers.get('x-real-ip')

  return (
    forwarded?.split(',')[0]?.trim() ||
    direct?.trim() ||
    'unknown'
  )
}

function getDeviceMaterial(request: Request) {
  return [
    request.headers.get('user-agent') || 'unknown',
    request.headers.get('accept-language') || 'unknown',
  ].join('|')
}

async function consume(window: RateWindow) {
  const admin = createAdminClient()
  const key = 'otp:' + window.scope + ':' + digest(window.value)

  const { data, error } = await admin.rpc('consume_api_rate_limit', {
    p_rate_key: key,
    p_limit: window.limit,
    p_window_seconds: window.windowSeconds,
  })

  if (error) {
    console.error('DEBA OTP rate limiter failed', {
      scope: window.scope,
      code: error.code,
    })
    return false
  }

  return data === true
}

export async function enforceOtpSendRateLimits(request: Request, phone: string) {
  const ip = getClientIp(request)
  const device = getDeviceMaterial(request)

  const checks = await Promise.all([
    consume({
      scope: 'send-phone',
      value: phone,
      limit: 3,
      windowSeconds: 15 * 60,
    }),
    consume({
      scope: 'send-ip',
      value: ip,
      limit: 10,
      windowSeconds: 15 * 60,
    }),
    consume({
      scope: 'send-device',
      value: ip + '|' + device,
      limit: 5,
      windowSeconds: 15 * 60,
    }),
  ])

  return checks.every(Boolean)
}

export async function enforceOtpVerifyRateLimits(request: Request, phone: string) {
  const ip = getClientIp(request)
  const device = getDeviceMaterial(request)

  const checks = await Promise.all([
    consume({
      scope: 'verify-phone',
      value: phone,
      limit: 8,
      windowSeconds: 15 * 60,
    }),
    consume({
      scope: 'verify-ip',
      value: ip,
      limit: 20,
      windowSeconds: 15 * 60,
    }),
    consume({
      scope: 'verify-device',
      value: ip + '|' + device,
      limit: 15,
      windowSeconds: 15 * 60,
    }),
  ])

  return checks.every(Boolean)
}
