import type { SupabaseClient } from '@supabase/supabase-js'

type RateLimitResult = {
  allowed: boolean
  limit: number
  windowSeconds: number
}

export async function consumeApiRateLimit(
  supabase: SupabaseClient,
  userId: string,
  scope: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = scope.trim() + ':' + userId

  const { data, error } = await supabase.rpc('consume_api_rate_limit', {
    p_rate_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.error('DEBA rate-limit check failed', error)
    // Security boundary: a failed limiter must fail closed so a database/API
    // availability incident cannot silently disable abuse protection.
    return { allowed: false, limit, windowSeconds }
  }

  return {
    allowed: data === true,
    limit,
    windowSeconds,
  }
}
