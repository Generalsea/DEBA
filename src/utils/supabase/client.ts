import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    )
  }

  return { url, publishableKey }
}

export function createClient(): SupabaseClient {
  if (browserClient) {
    return browserClient
  }

  const { url, publishableKey } = getConfig()
  browserClient = createBrowserClient(url, publishableKey)

  return browserClient
}
