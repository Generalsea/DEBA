import type { Metadata } from 'next'
import Header from '@/components/Header'
import ProductGrid, { type ProductGridItem } from '@/components/ProductGrid'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'DEBA — Marketplace',
  description: 'سوق DEBA للبيع والتبادل والتبرع في مصر.',
}

const BUCKET = 'deba-product-media'
const LIMIT = 24

type SearchParamValue = string | string[] | undefined

type PageProps = {
  searchParams: Promise<{
    q?: SearchParamValue
    category?: SearchParamValue
  }>
}

type ProductRow = {
  id: string
  title: string
  slug: string
  description: string | null
  listing_type: 'sale' | 'donation' | 'free'
  price: number | string | null
  currency: string
  is_negotiable: boolean
  condition_grade: string | null
  city: string | null
  governorate: string | null
  published_at: string | null
  created_at: string
  category:
    | {
        id: string
        name_ar: string
        name_en: string | null
        slug: string
      }
    | null
  images:
    | {
        id: string
        storage_path: string
        alt_text: string | null
        sort_order: number
        is_primary: boolean
      }[]
    | null
}

const PRODUCT_SELECT =
  'id,title,slug,description,listing_type,price,currency,is_negotiable,condition_grade,city,governorate,published_at,created_at,category:categories!products_category_id_fkey(id,name_ar,name_en,slug),images:product_images!product_images_product_id_fkey(id,storage_path,alt_text,sort_order,is_primary)'

function firstParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value
}

function normalizeSearchTerm(value: string | undefined) {
  if (!value) return null

  const clean = value
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)

  return clean || null
}

function normalizePrice(value: number | string | null) {
  if (value === null) return null

  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function getImageUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string | null,
) {
  if (!storagePath) return null
  if (/^https?:\/\//i.test(storagePath)) return storagePath

  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

function mapRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: ProductRow,
): ProductGridItem {
  const image = [...(row.images || [])].sort(
    (left, right) =>
      Number(right.is_primary) - Number(left.is_primary) ||
      left.sort_order - right.sort_order,
  )[0]

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    listingType: row.listing_type === 'donation' ? 'donation' : 'sale',
    price: normalizePrice(row.price),
    currency: row.currency || 'EGP',
    isNegotiable: row.is_negotiable,
    conditionGrade: row.condition_grade,
    city: row.city,
    governorate: row.governorate,
    categoryName: row.category?.name_ar || row.category?.name_en || null,
    imageUrl: getImageUrl(supabase, image?.storage_path || null),
    imageAlt: image?.alt_text?.trim() || row.title,
  }
}

async function resolveCategoryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  category: string | undefined,
) {
  if (!category || category === 'all') return null

  const bySlug = await supabase
    .from('categories')
    .select('id')
    .eq('slug', category)
    .eq('is_active', true)
    .maybeSingle()

  if (bySlug.data?.id) {
    return bySlug.data.id
  }

  const byName = await supabase
    .from('categories')
    .select('id')
    .eq('name_ar', category)
    .eq('is_active', true)
    .maybeSingle()

  return byName.data?.id || null
}

async function fetchListings(
  q: string | undefined,
  category: string | undefined,
) {
  const empty = {
    products: [] as ProductGridItem[],
    donations: [] as ProductGridItem[],
  }

  try {
    const supabase = await createClient()
    const searchTerm = normalizeSearchTerm(q)
    const categoryId = await resolveCategoryId(supabase, category)

    if (category && category !== 'all' && !categoryId) {
      return empty
    }

    const buildQuery = (listingType: 'sale' | 'donation') => {
      let query = supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('listing_type', listingType)
        .eq('status', 'published')
        .eq('moderation_status', 'approved')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(LIMIT)

      if (categoryId) {
        query = query.eq('category_id', categoryId)
      }

      if (searchTerm) {
        const pattern = '%' + searchTerm + '%'
        query = query.or(
          'title.ilike.' + pattern + ',description.ilike.' + pattern,
        )
      }

      return query
    }

    const [sales, donations] = await Promise.all([
      buildQuery('sale'),
      buildQuery('donation'),
    ])

    if (sales.error || donations.error) {
      console.error(
        'DEBA listings query failed',
        sales.error?.message,
        donations.error?.message,
      )
      return empty
    }

    return {
      products: (sales.data as unknown as ProductRow[]).map((row) =>
        mapRow(supabase, row),
      ),
      donations: (donations.data as unknown as ProductRow[]).map((row) =>
        mapRow(supabase, row),
      ),
    }
  } catch (error) {
    console.error('DEBA homepage data load failed', error)
    return empty
  }
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams
  const q = firstParam(params.q)
  const category = firstParam(params.category)
  const { products, donations } = await fetchListings(q, category)

  const total = products.length + donations.length

  return (
    <>
      <Header />

      <main className="market-home">
        <section className="market-hero">
          <div className="market-hero-content">
            <span className="market-hero-kicker">DEBA / MARKETPLACE</span>

            <h1>
              اشترِ بذكاء.
              <br />
              بع، بدّل، وتبرّع.
            </h1>

            <p>
              كل ما تحتاجه في سوق واحد: سلع مختارة، عروض محلية، وتبرعات تصل إلى
              من يحتاجها فعلًا.
            </p>

            <div className="market-hero-actions">
              <a href="#marketplace" className="market-hero-primary">
                تسوق الآن
              </a>
              <a href="#donations" className="market-hero-secondary">
                اكتشف التبرعات
              </a>
            </div>

            <div className="market-hero-trust">
              <span>✓ إعلانات معتمدة</span>
              <span>✓ تفاوض مباشر</span>
              <span>✓ تبرعات مجانية</span>
            </div>
          </div>

          <div className="market-hero-offer">
            <span>DEBA VALUE</span>
            <strong>حوّل الأشياء غير المستخدمة إلى قيمة.</strong>
            <p>أضف سلعتك في دقائق وابدأ استقبال العروض أو طلبات التبرع.</p>
            <a href="/login">أضف أول إعلان ←</a>
          </div>
        </section>

        <section className="market-home-content">
          <div className="market-service-strip">
            <div>
              <span>01</span>
              <strong>بيع محلي</strong>
              <small>اعرض سلعتك واجعل التفاوض مباشرًا</small>
            </div>
            <div>
              <span>02</span>
              <strong>تبرع مؤثر</strong>
              <small>امنح ما لا تحتاجه لمن يحتاجه</small>
            </div>
            <div>
              <span>03</span>
              <strong>اكتشف بسهولة</strong>
              <small>بحث وفئات واضحة في مكان واحد</small>
            </div>
            <div>
              <span>04</span>
              <strong>{total.toLocaleString('ar-EG')}</strong>
              <small>نتيجة مطابقة للبحث الحالي</small>
            </div>
          </div>

          <div className="market-result-context">
            <div>
              <span>نتائج السوق</span>
              <h2>
                {q
                  ? <>نتائج البحث عن «{q}»</>
                  : category && category !== 'all'
                    ? <>فئة «{category}»</>
                    : 'أحدث السلع والتبرعات'}
              </h2>
            </div>

            <span className="market-result-count">
              {total.toLocaleString('ar-EG')} عنصر
            </span>
          </div>

          <ProductGrid products={products} donations={donations} />
        </section>
      </main>
    </>
  )
}
