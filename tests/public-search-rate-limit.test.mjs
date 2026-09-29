import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const HELPER_PATH = new URL('../src/utils/publicSearchRateLimit.ts', import.meta.url)
const PROXY_PATH = new URL('../proxy.ts', import.meta.url)
const ENV_PATH = new URL('../.env.example', import.meta.url)

async function loadLocalEnv() {
  for (const path of ['.env.local', '.env']) {
    try {
      const source = await readFile(new URL('../' + path, import.meta.url), 'utf8')
      for (const rawLine of source.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue

        const equal = line.indexOf('=')
        if (equal <= 0) continue

        const key = line.slice(0, equal).trim()
        let value = line.slice(equal + 1).trim()
        if (
          value.length >= 2 &&
          ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'")))
        ) {
          value = value.slice(1, -1)
        }

        if (!(key in process.env)) process.env[key] = value
      }
    } catch {
      // CI may inject environment variables directly.
    }
  }
}

test('public search abuse control is wired at the request boundary', async () => {
  const [helper, proxy, envExample] = await Promise.all([
    readFile(HELPER_PATH, 'utf8'),
    readFile(PROXY_PATH, 'utf8'),
    readFile(ENV_PATH, 'utf8'),
  ])

  assert.match(proxy, /enforcePublicSearchRateLimit/)
  assert.match(proxy, /return searchRateLimitResponse/)
  assert.match(helper, /request\.method !== 'GET' && request\.method !== 'HEAD'/)
  assert.match(helper, /request\.nextUrl\.pathname !== '\/'/)
  assert.match(helper, /x-vercel-forwarded-for/)
  assert.match(helper, /x-forwarded-for/)
  assert.match(helper, /createHmac\('sha256'/)
  assert.match(helper, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(helper, /p_limit: PUBLIC_SEARCH_RATE_LIMIT/)
  assert.match(helper, /PUBLIC_SEARCH_RATE_LIMIT = 60/)
  assert.match(helper, /PUBLIC_SEARCH_RATE_WINDOW_SECONDS = 60/)
  assert.match(helper, /status: 429/)
  assert.match(helper, /status: 503/)
  assert.match(helper, /X-DEBA-Rate-Limit/)
  assert.match(envExample, /^SUPABASE_SERVICE_ROLE_KEY=/m)
})

test('public search limiter primitive rejects the fourth request in a 3-per-60s window', async (t) => {
  await loadLocalEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    t.skip('Live Supabase limiter integration requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    return
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const rateKey =
    'public-search:test:' +
    crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex')

  try {
    const results = []
    for (let i = 0; i < 4; i += 1) {
      const { data, error } = await supabase.rpc('consume_api_rate_limit', {
        p_rate_key: rateKey,
        p_limit: 3,
        p_window_seconds: 60,
      })
      if (error) throw new Error(error.message)
      results.push(data)
    }

    assert.deepEqual(results, [true, true, true, false])
  } finally {
    await supabase.from('api_rate_limits').delete().eq('rate_key', rateKey)
  }
})
