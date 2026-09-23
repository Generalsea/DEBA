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

const encodedSlug = encodeURIComponent(product.slug)
const url = SITE_URL.replace(/\/$/, '') + '/products/' + encodedSlug
const response = await fetch(url, {
  redirect: 'manual',
  signal: AbortSignal.timeout(15_000),
})
const body = await response.text()

console.log(
  JSON.stringify(
    {
      url,
      status: response.status,
      productId: product.id,
      title: product.title,
      bodyHasTitle: body.includes(product.title),
      bodyHasNotFound: body.includes('السلعة غير موجودة'),
    },
    null,
    2,
  ),
)

if (response.status !== 200) {
  console.error(body.slice(0, 8_000))
  throw new Error('Product detail route did not return HTTP 200.')
}

if (body.includes('السلعة غير موجودة')) {
  console.error(body.slice(0, 8_000))
  throw new Error('Product detail route rendered the not-found state.')
}

if (!body.includes(product.title)) {
  console.error(body.slice(0, 8_000))
  throw new Error('Product detail route did not render the expected product title.')
}

console.log('Product detail smoke test passed.')
