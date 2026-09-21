import { loadEnvFile } from 'node:process'
import { createClient } from '@supabase/supabase-js'

try { loadEnvFile('.env.local') } catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!url || !key) throw new Error('Missing Supabase server credentials in .env.local')

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const BUCKET = 'deba-product-media'

const PRODUCTS = [
  ['iphone-13-pro-deba-demo','iPhone 13 Pro 128GB','إلكترونيات','#FF6B35',3],
  ['samsung-s23-256-deba-demo','Samsung Galaxy S23 256GB','إلكترونيات','#004E89',1],
  ['samsung-washer-deba-demo','غسالة Samsung EcoBubble','أجهزة منزلية','#004E89',1],
  ['modern-sofa-deba-demo','أريكة مودرن ثلاثية','أثاث ومنزل','#9A6B4F',1],
  ['premium-sneakers-deba-demo','حذاء رياضي Premium','ملابس وأحذية','#FF6B35',1],
  ['engineering-books-deba-demo','مجموعة كتب هندسية','كتب ومستلزمات تعليمية','#2F855A',1],
  ['lego-space-set-deba-demo','مجموعة ألعاب تركيب','ألعاب وهوايات','#E53E3E',1],
  ['hyundai-elantra-deba-demo','Hyundai Elantra 2018','مركبات وقطع غيار','#1D4ED8',1],
  ['bosch-drill-deba-demo','شنيور لاسلكي 18V','معدات وأدوات','#16A34A',1],
  ['vintage-radio-deba-demo','راديو Vintage خشبي','مقتنيات وتحف','#8B5E3C',1],
  ['baby-stroller-deba-demo','عربة أطفال قابلة للطي','مستلزمات أطفال','#0EA5E9',1],
  ['city-bike-deba-demo','دراجة City Bike','رياضة ولياقة','#7C3AED',1],
  ['office-desk-deba-demo','مكتب عمل عملي','أخرى','#64748B',1]
]

function svg(title, category, accent, variant) {
  const shapeX = 800 + (variant * 18)
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">' +
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbfbfa"/><stop offset="1" stop-color="#eef2f6"/></linearGradient></defs>' +
    '<rect width="1600" height="1200" rx="42" fill="url(#bg)"/>' +
    '<circle cx="1320" cy="210" r="150" fill="' + accent + '" opacity=".09"/>' +
    '<text x="120" y="115" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#004E89">' + category + '</text>' +
    '<rect x="'+(shapeX-260)+'" y="240" width="520" height="500" rx="46" fill="' + accent + '" opacity=".14"/>' +
    '<rect x="'+(shapeX-180)+'" y="320" width="360" height="340" rx="36" fill="#ffffff" stroke="' + accent + '" stroke-width="18"/>' +
    '<circle cx="'+shapeX+'" cy="490" r="92" fill="' + accent + '" opacity=".55"/>' +
    '<circle cx="'+shapeX+'" cy="490" r="44" fill="#ffffff" opacity=".85"/>' +
    '<rect x="90" y="1035" width="1420" height="2" fill="#d7dee6"/>' +
    '<text x="120" y="1100" font-family="Arial,sans-serif" font-size="48" font-weight="800" fill="#1f2937">' + title + '</text>' +
    '<text x="1480" y="1100" text-anchor="end" font-family="Arial,sans-serif" font-size="28" fill="#6b7280">DEBA • TEST FIXTURE</text>' +
  '</svg>'
}

for (const [slug, title, category, accent, count] of PRODUCTS) {
  const { data: product, error: productError } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle()
  if (productError) throw productError
  if (!product) { console.log('Missing product: ' + slug); continue }
  await supabase.from('product_images').delete().eq('product_id', product.id)
  for (let index = 1; index <= count; index += 1) {
    const path = 'catalog-demo/' + slug + '/' + index + '.svg'
    const body = svg(title, category, accent, index)
    const upload = await supabase.storage.from(BUCKET).upload(path, new Blob([body], { type: 'image/svg+xml' }), { contentType: 'image/svg+xml', cacheControl: '31536000', upsert: true })
    if (upload.error) throw upload.error
    const insert = await supabase.from('product_images').insert({ product_id: product.id, storage_path: path, alt_text: title + ' — صورة ' + index, sort_order: index - 1, is_primary: index === 1, width: 1600, height: 1200 })
    if (insert.error) throw insert.error
  }
  console.log('Seeded Storage images: ' + slug)
}

console.log('DEBA demo catalog image seeding complete.')