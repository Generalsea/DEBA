import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import Header, { type HeaderCategory } from '@/components/Header'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'

export const metadata: Metadata = {
  title: 'DEBA | Marketplace مصري - بيع وشراء',
  description: 'DEBA — منصة مصرية لبيع وشراء وتبادل السلع داخل مصر.',
}

const BUCKET = 'deba-product-media'
const PRODUCT_LIMIT = 12

type SearchParamValue = string | string[] | undefined

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
  listing_type: 'sale' | 'free'
  price: number | string | null
  currency: string
  condition_grade: string | null
  city: string | null
  governorate: string | null
  is_negotiable: boolean
  published_at: string | null
  created_at: string
  category_id: string | null
}

type ImageRow = {
  id: string
  product_id: string
  storage_path: string
  alt_text: string | null
  sort_order: number
  is_primary: boolean
}

type ProfileRow = {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'جديد',
  like_new: 'كالجديد',
  excellent: 'ممتاز',
  good: 'جيد',
  fair: 'مقبول',
  poor: 'يحتاج عناية',
  for_parts: 'للقطع / الإصلاح',
}

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

function normalizePrice(value: number | string | null) {
  if (value === null) return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function getImageUrl(storagePath: string | null) {
  if (!storagePath) return null
  if (/^https?:\/\//i.test(storagePath)) return storagePath
  return (
    'https://gkwpjtbrecoesxyoybto.supabase.co/storage/v1/object/public/' +
    BUCKET +
    '/' +
    storagePath
  )
}

async function loadHomeData(
  searchValue: string | undefined,
  categoryValue: string | undefined,
  typeValue: string | undefined,
) {
  const supabase = await createClient()
  const searchTerm = cleanSearch(searchValue)
  const requestedType =
    typeValue === 'free' ? 'free' : typeValue === 'sale' ? 'sale' : null

  let categoryId: string | null = null

  if (categoryValue && categoryValue !== 'all') {
    const categoryResponse = await supabase
      .from('categories')
      .select('id')
      .eq('slug', categoryValue)
      .eq('is_active', true)
      .maybeSingle()
    categoryId = categoryResponse.data?.id || null
  }

  let productQuery = supabase
    .from('products')
    .select(
      'id,owner_id,title,slug,description,listing_type,price,currency,condition_grade,city,governorate,is_negotiable,published_at,created_at,category_id',
    )
    .in('listing_type', ['sale', 'free'])
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(PRODUCT_LIMIT)

  if (requestedType) productQuery = productQuery.eq('listing_type', requestedType)
  if (categoryId) productQuery = productQuery.eq('category_id', categoryId)

  if (searchTerm) {
    const pattern = '%' + searchTerm + '%'
    productQuery = productQuery.or(
      'title.ilike.' + pattern + ',description.ilike.' + pattern,
    )
  }

  const [categoryResponse, productsResponse, productCountResponse, membersCountResponse] =
    await Promise.all([
      supabase
        .from('categories')
        .select('id,name_ar,name_en,slug,sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name_ar', { ascending: true }),
      productQuery,
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .in('listing_type', ['sale', 'free'])
        .eq('status', 'published')
        .eq('moderation_status', 'approved'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_public', true),
    ])

  const categories = (categoryResponse.data || []) as CategoryRow[]
  const products = (productsResponse.data || []) as ProductRow[]
  const productIds = products.map((product) => product.id)
  const ownerIds = Array.from(
    new Set(
      products
        .map((product) => product.owner_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  const categoryIds = Array.from(
    new Set(
      products
        .map((product) => product.category_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )

  const [imagesResponse, profilesResponse, categoryRowsResponse] = await Promise.all([
    productIds.length
      ? supabase
          .from('product_images')
          .select('id,product_id,storage_path,alt_text,sort_order,is_primary')
          .in('product_id', productIds)
          .order('is_primary', { ascending: false })
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    ownerIds.length
      ? supabase
          .from('profiles')
          .select('id,display_name,username,avatar_url')
          .in('id', ownerIds)
      : Promise.resolve({ data: [], error: null }),
    categoryIds.length
      ? supabase
          .from('categories')
          .select('id,name_ar,name_en,slug')
          .in('id', categoryIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const images = (imagesResponse.data || []) as ImageRow[]
  const profiles = (profilesResponse.data || []) as ProfileRow[]
  const categoryRows = (categoryRowsResponse.data || []) as CategoryRow[]

  const imageByProduct = new Map<string, ImageRow>()
  for (const image of images) {
    if (!imageByProduct.has(image.product_id)) imageByProduct.set(image.product_id, image)
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]))

  const items: ProductCardItem[] = products.map((product) => {
    const image = imageByProduct.get(product.id)
    const category = product.category_id ? categoryById.get(product.category_id) : null
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      listingType: product.listing_type,
      price: normalizePrice(product.price),
      currency: product.currency || 'EGP',
      isNegotiable: product.is_negotiable,
      conditionGrade: product.condition_grade,
      city: product.city,
      governorate: product.governorate,
      categoryName: category?.name_ar || null,
      imageUrl: getImageUrl(image?.storage_path || null),
      imageAlt: image?.alt_text?.trim() || product.title,
      isFavorite: false,
    }
  })

  return {
    categories: categories.map<HeaderCategory>((category) => ({
      id: category.id,
      nameAr: category.name_ar,
      slug: category.slug,
    })),
    products: items,
    stats: {
      products: productCountResponse.count || 0,
      members: membersCountResponse.count || 0,
    },
    selectedCategory: categoryValue || 'all',
    selectedType: requestedType || 'all',
    searchTerm,
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: SearchParamValue
    category?: SearchParamValue
    type?: SearchParamValue
  }>
}) {
  const params = await searchParams
  const q = firstParam(params.q)
  const category = firstParam(params.category)
  const type = firstParam(params.type)
  const data = await loadHomeData(q, category, type)

  const freeCount = data.products.filter((item) => item.listingType === 'free').length

  return (
    <div className="deba-home-page" dir="rtl">
      <Header
        categories={data.categories}
        initialSearch={q || ''}
        initialCategory={category || 'all'}
      />

      <main>
        <section className="deba-home-hero">
          <div>
            <span>DEBA MARKETPLACE</span>
            <h1>سوق التبادل المصري للشراء والبيع</h1>
            <p>
              ابحث عن السلعة التي تريدها، راجع تفاصيلها كاملة، ثم أتمم الطلب أو
              تفاوض على السعر من نفس صفحة الإعلان.
            </p>
            <div className="deba-home-hero-actions">
              <Link href="#featured" className="btn-primary">
                ابدأ التسوق
              </Link>
              <Link href="/login" className="btn-outline">
                أضف إعلانك
              </Link>
            </div>
          </div>

          <div className="deba-home-stats">
            <div>
              <strong>{data.stats.products.toLocaleString('ar-EG')}+</strong>
              <span>منتج منشور</span>
            </div>
            <div>
              <strong>{data.stats.members.toLocaleString('ar-EG')}+</strong>
              <span>عضو</span>
            </div>
            <div>
              <strong>{freeCount.toLocaleString('ar-EG')}</strong>
              <span>سلع مجانية ظاهرة</span>
            </div>
          </div>
        </section>

        <section className="deba-home-section" id="categories">
          <div className="deba-home-section-head">
            <div>
              <span>EXPLORE</span>
              <h2>كل الأقسام</h2>
            </div>
            <Link href="/#featured">مشاهدة المنتجات</Link>
          </div>

          <div className="deba-home-category-grid">
            {data.categories.map((category, index) => {
              const icons = ['📱', '🔌', '🛋️', '👕', '📚', '🎮', '🚗', '🔧', '🎨', '🧸', '⚽', '📦']
              return (
                <Link
                  key={category.id}
                  href={'/?category=' + encodeURIComponent(category.slug) + '#featured'}
                  className="deba-home-category-card"
                >
                  <span>{icons[index] || '📦'}</span>
                  <strong>{category.nameAr}</strong>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="deba-home-section" id="featured">
          <div className="deba-home-section-head">
            <div>
              <span>{data.selectedType === 'free' ? 'FREE' : 'FOR YOU'}</span>
              <h2>
                {q || category || type
                  ? 'نتائج السوق'
                  : 'منتجات تستحق المشاهدة'}
              </h2>
            </div>
            <Link href="/?type=sale#featured">السلع للبيع</Link>
          </div>

          {data.products.length ? (
            <div className="deba-product-grid">
              {data.products.map((product, index) => (
                <ProductCard key={product.id} item={product} priority={index < 2} />
              ))}
            </div>
          ) : (
            <div className="deba-home-empty">
              <span>📦</span>
              <h3>لا توجد منتجات مطابقة حاليًا</h3>
              <p>
                {data.searchTerm
                  ? 'جرّب كلمة بحث أخرى أو تصفح قسمًا مختلفًا.'
                  : 'ستظهر المنتجات هنا تلقائيًا بعد النشر والمراجعة.'}
              </p>
              <Link href="/" className="btn-primary">
                العودة للسوق
              </Link>
            </div>
          )}
        </section>

        <section className="deba-home-free-band">
          <div>
            <span>DEBA FREE</span>
            <h2>سلع مجانية داخل السوق</h2>
            <p>
              بعض الإعلانات تكون متاحة بدون مقابل. تعامل معها كأي إعلان آخر:
              راجع التفاصيل ثم اطلب المنتج من صفحة الإعلان.
            </p>
          </div>
          <Link href="/?type=free#featured" className="btn-primary">
            تصفح السلع المجانية
          </Link>
        </section>
      </main>

      <footer className="deba-home-footer">
        <div>
          <strong>DEBA</strong>
          <span>سوق التبادل المصري</span>
        </div>
        <nav>
          <Link href="/">الرئيسية</Link>
          <Link href="#categories">الأقسام</Link>
          <Link href="#featured">المنتجات</Link>
          <Link href="/login">حسابي</Link>
        </nav>
        <small>© 2026 DEBA. جميع الحقوق محفوظة.</small>
      </footer>
    </div>
  )
}
