import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SITE_URL = process.env.DEBA_SMOKE_SITE_URL || 'http://127.0.0.1:3100'
const requestedSlug =
  process.env.DEBA_PRODUCT_SMOKE_SLUG ||
  'أداة-منزلية-متعددة-الاستخدام-تجربة-deba'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase public environment variables.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: product, error } = await supabase
  .from('products')
  .select('id,title,slug,status,moderation_status,listing_type')
  .eq('slug', requestedSlug)
  .eq('status', 'published')
  .eq('moderation_status', 'approved')
  .eq('listing_type', 'sale')
  .maybeSingle()

if (error) {
  throw new Error(
    'Supabase lookup failed: ' +
      JSON.stringify({
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      }),
  )
}

if (!product) {
  throw new Error('Smoke-test product not found: ' + requestedSlug)
}

const debugUrl =
  SITE_URL.replace(/\/$/, '') +
  '/api/debug/product?slug=' +
  encodeURIComponent(product.slug)

const debugResponse = await fetch(debugUrl, {
  signal: AbortSignal.timeout(15_000),
})
const debugBody = await debugResponse.text()

console.log('SERVER DEBUG:', debugBody)

if (!debugResponse.ok) {
  throw new Error('Server debug route failed with HTTP ' + debugResponse.status)
}

const debug = JSON.parse(debugBody)

if (debug.simple?.id !== product.id) {
  throw new Error(
    'Server simple query mismatch: ' +
      JSON.stringify({ expected: product.id, actual: debug.simple?.id ?? null }),
  )
}

if (debug.exact?.id !== product.id) {
  throw new Error(
    'Server exact query mismatch: ' +
      JSON.stringify({ expected: product.id, actual: debug.exact?.id ?? null }),
  )
}

const encodedSlug = encodeURIComponent(product.slug)
const url = SITE_URL.replace(/\/$/, '') + '/products/' + encodedSlug
const response = await fetch(url, {
  redirect: 'manual',
  signal: AbortSignal.timeout(15_000),
})
const body = await response.text()
const hasDetailLayout = body.includes('<main class="deba-detail-page" dir="rtl">')
const hasDetailContent = body.includes('class="deba-detail-layout"')
const hasNotFoundBoundary = body.includes('deba-detail-empty-state')
const hasErrorBoundary = body.includes('deba-detail-error-state')

console.log(
  JSON.stringify(
    {
      url,
      status: response.status,
      productId: product.id,
      title: product.title,
      bodyHasTitle: body.includes(product.title),
      hasDetailLayout,
      hasDetailContent,
      hasNotFoundBoundary,
      hasErrorBoundary,
    },
    null,
    2,
  ),
)

if (response.status !== 200) {
  console.error(body.slice(0, 8_000))
  throw new Error('Product detail route did not return HTTP 200.')
}

if (!hasDetailLayout || !hasDetailContent) {
  console.error(body.slice(0, 12_000))
  throw new Error('Product detail route did not render the product detail layout.')
}

if (!body.includes(product.title)) {
  console.error(body.slice(0, 8_000))
  throw new Error('Product detail route did not render the expected product title.')
}

console.log('Product detail smoke test passed: detail layout rendered.')
