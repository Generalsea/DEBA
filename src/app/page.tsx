import type { Metadata } from 'next'
import { Gift, ShieldCheck, Truck, UsersRound, ArrowLeft, Sparkles } from 'lucide-react'
import Header, { type HeaderCategory } from '@/components/Header'
import ProductGrid, { type ProductGridItem } from '@/components/ProductGrid'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'DEBA — Marketplace',
  description: 'DEBA: سوق مصري لبيع السلع، التفاوض المباشر، وإهداء الأشياء لمن يحتاجها.',
}

const BUCKET = 'deba-product-media'
const LIMIT = 24

type SearchParamValue = string | string[] | undefined
type ListingMode = 'all' | 'sale' | 'donation'

type PageProps = {
  searchParams: Promise<{
    q?: SearchParamValue
    category?: SearchParamValue
    type?: SearchParamValue
  }>
}

type CategoryRow = {
  id: string
  name_ar: string
  name_en: string | null
  slug: string
  sort_order: number
}

type ProductImageRow = {
  id: string
  storage_path: string
  alt_text: string | null
  sort_order: number
  is_primary: boolean
}

type ProductRow = {
  id: string
  owner_id: string | null
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
  images: ProductImageRow[] | null
}

const PRODUCT_SELECT =
  'id,owner_id,title,slug,description,listing_type,price,currency,is_negotiable,condition_grade,city,governorate,published_at,created_at,category:categories!products_category_id_fkey(id,name_ar,name_en,slug),images:product_images!product_images_product_id_fkey(id,storage_path,alt_text,sort_order,is_primary)'

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

function mapCategory(row: CategoryRow): HeaderCategory {
  return {
    id: row.id,
    nameAr: row.name_ar,
    slug: row.slug,
  }
}

function mapRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: ProductRow,
  favoriteIds: Set<string>,
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
    listingType: row.listing_type,
    price: normalizePrice(row.price),
    currency: row.currency || 'EGP',
    isNegotiable: row.is_negotiable,
    conditionGrade: row.condition_grade,
    city: row.city,
    governorate: row.governorate,
    categoryName: row.category?.name_ar || row.category?.name_en || null,
    imageUrl: getImageUrl(supabase, image?.storage_path || null),
    imageAlt: image?.alt_text?.trim() || row.title,
    isFavorite: favoriteIds.has(row.id),
  }
}

async function getUserContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    const { data } = await supabase.auth.getClaims()
    const userId =
      data?.claims && typeof data.claims.sub === 'string'
        ? data.claims.sub
        : null

    return userId
  } catch {
    return null
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

  if (bySlug.data?.id) return bySlug.data.id

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
  mode: ListingMode,
) {
  const empty = {
    products: [] as ProductGridItem[],
    donations: [] as ProductGridItem[],
    favoriteCount: 0,
    negotiationCount: 0,
  }

  try {
    const supabase = await createClient()
    const [categoryRows, userId] = await Promise.all([
      supabase
        .from('categories')
        .select('id,name_ar,name_en,slug,sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name_ar', { ascending: true }),
      getUserContext(supabase),
    ])

    const categories = (categoryRows.data || []) as CategoryRow[]
    const categoryId = await resolveCategoryId(supabase, category)

    if (category && category !== 'all' && !categoryId) {
      return { ...empty, categories }
    }

    const searchTerm = normalizeSearchTerm(q)
    const types =
      mode === 'sale'
        ? ['sale']
        : mode === 'donation'
          ? ['donation', 'free']
          : ['sale', 'donation', 'free']

    const buildQuery = (allowedTypes: string[]) => {
      let query = supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .in('listing_type', allowedTypes)
        .eq('status', 'published')
        .eq('moderation_status', 'approved')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(LIMIT)

      if (categoryId) query = query.eq('category_id', categoryId)

      if (searchTerm) {
        const pattern = '%' + searchTerm + '%'
        query = query.or(
          'title.ilike.' + pattern + ',description.ilike.' + pattern,
        )
      }

      return query
    }

    const salesPromise =
      mode === 'donation'
        ? Promise.resolve({ data: [], error: null })
        : buildQuery(['sale'])

    const donationsPromise =
      mode === 'sale'
        ? Promise.resolve({ data: [], error: null })
        : buildQuery(['donation', 'free'])

    const [sales, donations] = await Promise.all([
      salesPromise,
      donationsPromise,
    ])

    if (sales.error || donations.error) {
      console.error(
        'DEBA listings query failed',
        sales.error?.message,
        donations.error?.message,
      )
      return { ...empty, categories }
    }

    const rows = [
      ...((sales.data || []) as unknown as ProductRow[]),
      ...((donations.data || []) as unknown as ProductRow[]),
    ]

    const productIds = rows.map((row) => row.id)
    let favoriteIds = new Set<string>()
    let favoriteCount = 0
    let negotiationCount = 0

    if (userId) {
      const [favorites, favoritesTotal, negotiations] = await Promise.all([
        productIds.length
          ? supabase
              .from('favorites')
              .select('product_id')
              .in('product_id', productIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('favorites')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('offers')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'countered']),
      ])

      favoriteIds = new Set(
        ((favorites.data || []) as { product_id: string }[]).map(
          (row) => row.product_id,
        ),
      )
      favoriteCount = favoritesTotal.count || 0
      negotiationCount = negotiations.count || 0
    }

    return {
      products: ((sales.data || []) as unknown as ProductRow[]).map((row) =>
        mapRow(supabase, row, favoriteIds),
      ),
      donations: ((donations.data || []) as unknown as ProductRow[]).map((row) =>
        mapRow(supabase, row, favoriteIds),
      ),
      favoriteCount,
      negotiationCount,
      categories,
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
  const requestedType = firstParam(params.type)
  const mode: ListingMode =
    requestedType === 'sale' || requestedType === 'donation'
      ? requestedType
      : 'all'

  const data = await fetchListings(q, category, mode)
  const products = data.products
  const donations = data.donations
  const categories = (data.categories || []).map(mapCategory)
  const total = products.length + donations.length

  return (
    <>
      <Header
        categories={categories}
        initialSearch={q || ''}
        initialCategory={category || 'all'}
        favoriteCount={data.favoriteCount}
        negotiationCount={data.negotiationCount}
      />

      <main className="deba-home">
        <section className="deba-hero">
          <div className="deba-hero-main">
            <div className="deba-hero-copy">
              <div className="deba-hero-kicker">
                <Sparkles size={14} />
                سوق مصري بقلب تجاري
              </div>

              <h1>
                كل شيء له
                <span> قيمة.</span>
              </h1>

              <p>
                بيع ما لا تحتاجه، تفاوض على السعر الذي يناسبك، أو أهدِ شيئًا
                لمن يحتاجه. تجربة DEBA مبنية حول المنتجات الحقيقية والصفقات
                الواضحة.
              </p>

              <div className="deba-hero-cta">
                <a href="#marketplace" className="deba-hero-primary">
                  تسوق الآن
                  <ArrowLeft size={17} />
                </a>
                <a href="#donations" className="deba-hero-secondary">
                  اكتشف التبرعات
                  <Gift size={17} />
                </a>
              </div>

              <div className="deba-hero-proof">
                <span><ShieldCheck size={15} /> إعلانات معتمدة</span>
                <span><UsersRound size={15} /> تفاوض مباشر</span>
                <span><Truck size={15} /> خيارات استلام واضحة</span>
              </div>
            </div>

            <div className="deba-hero-panel">
              <span>DEBA VALUE</span>
              <strong>حوّل المساحة المهدرة إلى قيمة تتحرك.</strong>
              <p>أضف سلعتك مرة واحدة، واستقبل عروضًا وطلبات حقيقية من داخل المنصة.</p>
              <Link href="/login" className="deba-hero-panel-link">
                أضف سلعتك
                <ArrowLeft size={16} />
              </Link>

              <div className="deba-hero-panel-stat">
                <b>{total.toLocaleString('ar-EG')}</b>
                <span>نتيجة مطابقة في العرض الحالي</span>
              </div>
            </div>
          </div>

          <div className="deba-hero-categories">
            <span>ابدأ من الفئة المناسبة</span>
            <div>
              {categories.slice(0, 8).map((item) => (
                <Link key={item.id} href={'/?category=' + encodeURIComponent(item.slug)}>
                  {item.nameAr}
                  <ArrowLeft size={13} />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="deba-market-content">
          <div className="deba-value-strip">
            <div>
              <span>01</span>
              <ShieldCheck size={21} />
              <strong>إعلانات معتمدة</strong>
              <small>المحتوى العام لا يظهر إلا بعد حالة النشر والمراجعة.</small>
            </div>
            <div>
              <span>02</span>
              <MessageSquareText size={21} />
              <strong>Make Offer حقيقي</strong>
              <small>العرض يحفظ داخل قاعدة البيانات ويصل لحساب البائع.</small>
            </div>
            <div>
              <span>03</span>
              <Gift size={21} />
              <strong>أثر مجاني</strong>
              <small>التبرعات والسلع المجانية لها مسار طلب واضح داخل المنتج.</small>
            </div>
            <div>
              <span>04</span>
              <Sparkles size={21} />
              <strong>بحث سريع</strong>
              <small>{total.toLocaleString('ar-EG')} نتيجة مطابقة للبحث الحالي.</small>
            </div>
          </div>

          <div className="deba-results-bar">
            <div>
              <span>DEBA MARKETPLACE</span>
              <h2>
                {q
                  ? <>نتائج البحث عن «{q}»</>
                  : category && category !== 'all'
                    ? <>الفئة: «{category}»</>
                    : mode === 'sale'
                      ? 'أحدث السلع المعروضة'
                      : mode === 'donation'
                        ? 'التبرعات والسلع المجانية'
                        : 'أحدث السلع والتبرعات'}
              </h2>
            </div>
            <div className="deba-results-pill">{total.toLocaleString('ar-EG')} عنصر</div>
          </div>

          <ProductGrid
            products={products}
            donations={donations}
            mode={mode}
          />
        </section>
      </main>
    </>
  )
}
