import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function read(path) {
  return readFile(new URL('../' + path, import.meta.url), 'utf8')
}

test('Arabic product routes stay dynamic and normalize slug params', async () => {
  const detail = await read('src/app/products/[slug]/page.tsx')
  const checkout = await read('src/app/products/[slug]/checkout/page.tsx')

  for (const source of [detail, checkout]) {
    assert.match(source, /export const dynamic = ['"]force-dynamic['"]/)
    assert.match(source, /function normalizeRouteSlug\(value: string\)/)
    assert.match(source, /return decodeURIComponent\(value\)/)
    assert.match(source, /\.eq\(['"]slug['"], normalizedSlug\)/)
  }
})

test('seller listing starts as a draft and uses structured contract v1', async () => {
  const source = await read('src/app/sell/ProductListingForm.tsx')

  assert.match(source, /status:\s*['"]draft['"]/)
  assert.match(source, /moderation_status:\s*['"]pending['"]/)
  assert.match(source, /details_schema_version:\s*1/)
  assert.match(source, /files\.length < 3/)
})

test('database hardening migration protects seller verification review fields', async () => {
  const source = await read('supabase/migrations/20260923150000_harden_seller_verification_writes.sql')

  for (const field of ['status', 'reviewed_at', 'reviewed_by', 'review_note', 'expires_at']) {
    assert.match(source, new RegExp('new\\.' + field + '\\s+is distinct from old\\.' + field))
  }

  assert.match(source, /create trigger trg_secure_seller_verification_write/)
  assert.match(source, /private\.secure_seller_verification_write\(\)/)
})

test('CI uses npm ci when the repository lockfile is present', async () => {
  const source = await read('.github/workflows/ci.yml')
  assert.match(source, /npm ci --no-audit --no-fund/)
  assert.match(source, /package-lock\.json/)
})
