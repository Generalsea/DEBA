import 'server-only'

import { createClient } from '@supabase/supabase-js'

function getServerSecret() {
  const value =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY

  if (!value) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY on the server.',
    )
  }

  return value
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL on the server.')
  }

  return createClient(url, getServerSecret(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
