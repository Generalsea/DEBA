import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from '@/utils/supabase/config'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
          void headers
        } catch {
          // Server Components cannot mutate response cookies.
        }
      },
    },
  })
}
