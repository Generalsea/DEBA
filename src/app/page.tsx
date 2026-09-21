import type { Metadata } from 'next'
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Car,
  Gamepad2,
  Gift,
  Home,
  Laptop,
  MoreHorizontal,
  PackageOpen,
  Shirt,
  ShieldCheck,
  Sofa,
  Sparkles,
  Trophy,
  Wrench,
  Baby,
} from 'lucide-react'
import Link from 'next/link'
import Header, { type HeaderCategory } from '@/components/Header'
import ProductGrid, { type ProductGridItem } from '@/components/ProductGrid'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'DEBA — Marketplace',
  description: 'DEBA — سوق مصري للسلع، التفاوض المباشر، والتبرع.',
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
  category: { id: string; name_ar: string; name_en: string | null; slug: string } | null
  images: { id: string; storage_path: string; alt_text: string | null; sort_order: number; is_primary: boolean }[] | null
}

const FALLBACK_CATEGORIES: CategoryRow[] = [
  { id: 'electronics', name_ar: 'إلكترونيات', name_en: 'Electronics', slug: 'electronics', sort_order: 10 },
  { id: 'home-appliances', name_ar: 'أجهزة منزلية', name_en: 'Home Appliances', slug: 'home-appliances', sort_order: 20 },
  { id: 'furniture-home', name_ar: 'أثاث ومنزل', name_en: 'Furniture & Home', slug: 'furniture-home', sort_order: 30 },
  { id: 'fashion', name_ar: 'ملابس وأحذية', name_en: 'Fashion', slug: 'fashion', sort_order: 40 },
  { id: 'books-education', name_ar: 'كتب ومستلزمات تعليمية', name_en: 'Books & Education', slug: 'books-education', sort_order: 50 },
  { id: 'toys-hobbies', name_ar: 'ألعاب وهوايات', name_en: 'Toys & Hobbies', slug: 'toys-hobbies', sort_order: 60 },
  { id: 'vehicles-parts', name_ar: 'مركبات وقطع غيار', name_en: 'Vehicles & Parts', slug: 'vehicles-parts', sort_order: 70 },
  { id: 'tools-equipment', name_ar: 'معدات وأدوات', name_en: 'Tools & Equipment', slug: 'tools-equipment', sort_order: 80 },
  { id: 'collectibles-antiques', name_ar: 'مقتنيات وتحف', name_en: 'Collectibles & Antiques', slug: 'collectibles-antiques', sort_order: 90 },
  { id: 'baby-kids', name_ar: 'مستلزمات أطفال', name_en: 'Baby & Kids', slug: 'baby-kids', sort_order: 100 },
  { id: 'sports-fitness', name_ar: 'رياضة ولياقة', name_en: 'Sports & Fitness', slug: 'sports-fitness', sort_order: 110 },
  { id: 'other', name_ar: 'أخرى', name_en: 'Other', slug: 'other', sort_order: 999 },
]

const CATEGORY_ICONS = [
  Laptop,
  Home,
  Sofa,
  Shirt,
  BookOpen,
  Gamepad2,
  Car,
  Wrench,
  Trophy,
  Baby,
  Sparkles,
  MoreHorizontal,
]

const PRODUCT_SELECT =
  'id,owner_id,title,slug,description,listing_type,price,currency,is_negotiable,condition_grade,city,governorate,published_at,created_at,category:categories!products_category_id_fkey(id,name_ar,name_en,slug),images:product_images!product_images_product_id_fkey(id,storage_path,alt_text,sort_order,is_primary)'

function firstParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value
}

function cleanSearch(value: string | undefined) {
  if (!value) return null

  const result = value
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)

  return result || null
}

function toNumber(value: number | string | null) {
  if (value === null) return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function imageUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string | null,
) {
  if (!storagePath) return null
  if (/^https?:///i.test(storagePath)) return storagePath
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

function mapCategory(row: CategoryRow): HeaderCategory {
  return { id: row.id, nameAr: row.name_ar, slug: row.slug }
}

function mapProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: ProductRow,
): ProductGridItem {
  const image = [...(row.images || [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  )[0]

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    listingType: row.listing_type,
    price: toNumber(row.price),
    currency: row.currency || 'EGP',
    isNegotiable: row.is_negotiable,
    conditionGrade: row.condition_grade,
    city: row.city,
    governorate: row.governorate,
    categoryName: row.category?.name_ar || row.category?.name_en || null,
    imageUrl: imageUrl(supabase, image?.storage_path || null),
    imageAlt: image?.alt_text?.trim() || row.title,
  }
}

async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { data } = await supabase.auth.getClaims()
    return typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  } catch {
    return null
  }
}

async function resolveCategoryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  value: string | undefined,
) {
  if (!value || value === 'all') return null

  const bySlug = await supabase
    .from('categories')
    .select('id')
    .eq('slug', value)
    .eq('is_active', true)
    .maybeSingle()

  if (bySlug.data?.id) return bySlug.data.id

  const byArabicName = await supabase
    .from('categories')
    .select('id')
    .eq('name_ar', value)
    .eq('is_active', true)
    .maybeSingle()

  return byArabicName.data?.id || null
}

async function loadMarketplace(q: string | undefined, category: string | undefined, mode: ListingMode) {
  const empty = {
    categories: FALLBACK_CATEGORIES,
    products: [] as ProductGridItem[],
    donations: [] as ProductGridItem[],
    favoriteCount: 0,
    negotiationCount: 0,
  }

  try {
    const supabase = await createClient()
    const [{ data: categoryData }, userId] = await Promise.all([
      supabase
        .from('categories')
        .select('id,name_ar,name_en,slug,sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name_ar', { ascending: true }),
      getUserId(supabase),
    ])

    const categories =
      categoryData?.length === 12
        ? (categoryData as CategoryRow[])
        : FALLBACK_CATEGORIES

    const categoryId = await resolveCategoryId(supabase, category)
    if (category && category !== 'all' && !categoryId) {
      return { ...empty, categories }
    }

    const searchTerm = cleanSearch(q)

    const buildQuery = (types: ('sale' | 'donation' | 'free')[]) => {
      let query = supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .in('listing_type', types)
        .eq('status', 'published')
        .eq('moderation_status', 'approved')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(LIMIT)

      if (categoryId) query = query.eq('category_id', categoryId)

      if (searchTerm) {
        const pattern = '%' + searchTerm + '%'
        query = query.or('title.ilike.' + pattern + ',description.ilike.' + pattern)
      }

      return query
    }

    const [sales, donations] = await Promise.all([
      mode === 'donation' ? Promise.resolve({ data: [], error: null }) : buildQuery(['sale']),
      mode === 'sale' ? Promise.resolve({ data: [], error: null }) : buildQuery(['donation', 'free']),
    ])

    if (sales.error || donations.error) {
      console.error('DEBA marketplace query failed', sales.error?.message, donations.error?.message)
      return { ...empty, categories }
    }

    const ids = [
      ...((sales.data || []) as unknown as ProductRow[]),
      ...((donations.data || []) as unknown as ProductRow[]),
    ].map((row) => row.id)

    let favoriteIds = new Set<string>()
    let favoriteCount = 0
    let negotiationCount = 0

    if (userId) {
      const [favorites, favoriteTotal, offers] = await Promise.all([
        ids.length
          ? supabase.from('favorites').select('product_id').in('product_id', ids)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('favorites').select('id', { count: 'exact', head: true }),
        supabase
          .from('offers')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'countered']),
      ])

      favoriteIds = new Set(
        ((favorites.data || []) as { product_id: string }[]).map((row) => row.product_id),
      )
      favoriteCount = favoriteTotal.count || 0
      negotiationCount = offers.count || 0
    }

    return {
      categories,
      products: ((sales.data || []) as unknown as ProductRow[]).map((row) => ({
        ...mapProduct(supabase, row),
        isFavorite: favoriteIds.has(row.id),
      })),
      donations: ((donations.data || []) as unknown as ProductRow[]).map((row) => ({
        ...mapProduct(supabase, row),
        isFavorite: favoriteIds.has(row.id),
      })),
      favoriteCount,
      negotiationCount,
    }
  } catch (error) {
    console.error('DEBA marketplace load failed', error)
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

  const data = await loadMarketplace(q, category, mode)
  const categories = data.categories.map(mapCategory)
  const totalProducts = data.products.length + data.donations.length

  return (
    <>
      <Header
        categories={categories}
        initialSearch={q || ''}
        initialCategory={category || 'all'}
        favoriteCount={data.favoriteCount}
        negotiationCount={data.negotiationCount}
      />

      <main className="deba-marketplace">
        <section className="deba-hero">
          <div className="deba-hero-copy">
            <div className="deba-hero-kicker">
              <Sparkles size={15} />
              DEBA MARKETPLACE
            </div>
            <h1>
              سوق مصري
              <span> أذكى.</span>
              <br />
              قيمة تتحرك.
            </h1>
            <p>
              اكتشف سلعًا حقيقية، قدّم عرضك مباشرة، أو امنح ما لا تحتاجه لمن
              يحتاجه. تجربة DEBA تبدأ من المنتجات وتصل إلى الصفقة.
            </p>
            <div className="deba-hero-actions">
              <a href="#marketplace" className="deba-primary-cta">
                ابدأ التسوق
                <ArrowLeft size={17} />
              </a>
              <Link href="/?type=donation#donations" className="deba-secondary-cta">
                اكتشف المجاني
                <Gift size={17} />
              </Link>
            </div>
            <div className="deba-trust-row">
              <span><ShieldCheck size={15} /> إعلانات معتمدة</span>
              <span><BadgeCheck size={15} /> تفاوض مباشر</span>
              <span><PackageOpen size={15} /> استلام واضح</span>
            </div>
          </div>

          <aside className="deba-hero-card">
            <span className="deba-hero-card-label">DEBA VALUE</span>
            <strong>من سلعة غير مستخدمة إلى قيمة حقيقية.</strong>
            <p>أضف إعلانك واستقبل عروضًا وطلبات من داخل المنصة.</p>
            <Link href="/login" className="deba-hero-card-action">
              أضف إعلانك
              <ArrowLeft size={15} />
            </Link>
            <div className="deba-hero-stat">
              <span>النتائج الحالية</span>
              <b>{totalProducts.toLocaleString('ar-EG')}</b>
            </div>
          </aside>
        </section>

        <section className="deba-category-section" aria-labelledby="deba-categories-title">
          <div className="deba-section-heading">
            <div>
              <span>SHOP BY CATEGORY</span>
              <h2 id="deba-categories-title">كل الأقسام الـ12 النشطة</h2>
            </div>
            <span className="deba-section-caption">اختر قسمًا للبدء</span>
          </div>

          <div className="deba-category-grid">
            {categories.map((item, index) => {
              const Icon = CATEGORY_ICONS[index] || MoreHorizontal
              return (
                <Link
                  key={item.id}
                  href={'/?category=' + encodeURIComponent(item.slug)}
                  className="deba-category-card"
                >
                  <span className="deba-category-icon"><Icon size={21} /></span>
                  <span className="deba-category-card-copy">
                    <strong>{item.nameAr}</strong>
                    <small>استكشف القسم</small>
                  </span>
                  <ArrowLeft size={15} />
                </Link>
              )
            })}
          </div>
        </section>

        <section id="marketplace" className="deba-results-shell">
          <div className="deba-filter-bar">
            <div>
              <span>DEBA FILTERS</span>
              <strong>
                {q
                  ? 'نتائج البحث عن «' + q + '»'
                  : category && category !== 'all'
                    ? 'قسم «' + category + '»'
                    : mode === 'sale'
                      ? 'السلع المعروضة للبيع'
                      : mode === 'donation'
                        ? 'التبرعات والسلع المجانية'
                        : 'أحدث السلع والتبرعات'}
              </strong>
            </div>

            <div className="deba-filter-pills">
              <Link href="/" className={mode === 'all' ? 'is-active' : ''}>الكل</Link>
              <Link href="/?type=sale" className={mode === 'sale' ? 'is-active' : ''}>للبيع</Link>
              <Link href="/?type=donation" className={mode === 'donation' ? 'is-active' : ''}>مجاني</Link>
              {category && category !== 'all' && (
                <Link href="/" className="deba-filter-reset">مسح الفلتر ×</Link>
              )}
            </div>
          </div>

          {mode !== 'donation' && (
            <div className="deba-results-section">
              <div className="deba-mini-heading">
                <div>
                  <span>MARKET</span>
                  <h2>أحدث السلع والعروض</h2>
                </div>
                <b>{data.products.length.toLocaleString('ar-EG')} نتيجة</b>
              </div>
              {data.products.length ? (
                <ProductGrid products={data.products} donations={[]} mode="sale" />
              ) : (
                <div className="deba-empty-state">
                  <div className="deba-empty-icon"><PackageOpen size={27} /></div>
                  <h3>لا توجد منتجات منشورة للبيع حاليًا</h3>
                  <p>القائمة جاهزة، وستظهر السلع تلقائيًا بعد النشر والمراجعة.</p>
                  <Link href="/login">أضف أول إعلان ←</Link>
                </div>
              )}
            </div>
          )}

          {mode !== 'sale' && (
            <div id="donations" className="deba-results-section">
              <div className="deba-mini-heading">
                <div>
                  <span>DEBA IMPACT</span>
                  <h2>تبرعات وسلع مجانية</h2>
                </div>
                <b>{data.donations.length.toLocaleString('ar-EG')} نتيجة</b>
              </div>
              {data.donations.length ? (
                <ProductGrid products={[]} donations={data.donations} mode="donation" />
              ) : (
                <div className="deba-empty-state deba-empty-state-green">
                  <div className="deba-empty-icon"><Gift size={27} /></div>
                  <h3>لا توجد تبرعات منشورة حاليًا</h3>
                  <p>يمكن نشرها من لوحة الإعلان لتظهر هنا بعد الاعتماد.</p>
                  <Link href="/login">قدّم تبرعًا ←</Link>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
