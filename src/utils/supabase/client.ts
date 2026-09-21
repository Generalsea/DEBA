import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from '@/utils/supabase/config'

let browserClient: SupabaseClient | undefined

export function createClient(): SupabaseClient {
  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
  )

  return browserClient
}
