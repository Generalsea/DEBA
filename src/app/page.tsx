import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Camera,
  HeartHandshake,
  Layers3,
  PackageCheck,
  Palette,
  Plug,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sofa,
  Tag,
  Truck,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Header from '@/components/Header'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'
import type { HeaderPromo } from '@/components/HeaderReelsRail'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'DEBA | سوق مصري للبيع والشراء والتبادل',
  description:
    'اكتشف المنتجات المنشورة فعليًا على DEBA، وقارن السعر والحالة والموقع، أو أضف ما لا تحتاجه للبيع.',
}

const BUCKET = 'deba-product-media'
const PRODUCT_LIMIT = 36

type SearchParamValue = string | string[] | undefined

type SearchFilters = {
  q?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  condition?: string
  governorate?: string
  sort?: 'newest' | 'price_low' | 'price_high'
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
  listing_type: 'sale'
  price: number | string | null
  currency: string
  condition_grade: string | null
  city: string | null
  governorate: string | null
  moderation_status: string
  published_at: string | null
  created_at: string
  category_id: string | null
  quantity: number
  delivery_method: 'pickup' | 'seller_delivery' | 'platform_delivery' | 'both'
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

type ReviewRow = {
  product_id: string
  rating: number
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

const CATEGORY_ICON_BY_SLUG: Record<string, LucideIcon> = {
  electronics: Smartphone,
  'home-appliances': Plug,
  'furniture-home': Sofa,
  fashion: Tag,
  'books-education': BookOpen,
  'toys-hobbies': Palette,
  'vehicles-parts': Truck,
  'tools-equipment': Wrench,
  'collectibles-antiques': Palette,
  'baby-kids': HeartHandshake,
  'sports-fitness': ShoppingBag,
  other: Layers3,
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

function parsePositiveNumber(value: string | undefined) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function normalizePrice(value: number | string | null) {
  if (value === null) return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function formatPrice(value: number | string | null, currency: string) {
  const number = normalizePrice(value)
  if (number === null) return 'السعر عند التواصل'

  return (
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(number) +
    ' ' +
    (currency || 'EGP')
  )
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

function isSafeMediaUrl(value: string) {
  return /^https?:\/\//i.test(value) || (/^\//.test(value) && !value.startsWith('//'))
}

function isSafeTargetUrl(value: string) {
  return isSafeMediaUrl(value)
}

async function loadHomeData(filters: SearchFilters) {
  const supabase = await createClient()
  const searchTerm = cleanSearch(filters.q)
  let categoryId: string | null = null

  if (filters.category && filters.category !== 'all') {
    const categoryResponse = await supabase
      .from('categories')
      .select('id')
      .eq('slug', filters.category)
      .eq('is_active', true)
      .maybeSingle()

    categoryId = categoryResponse.data?.id || null
  }

  let productQuery = supabase
    .from('products')
    .select(
      'id,owner_id,title,slug,description,listing_type,price,currency,condition_grade,city,governorate,moderation_status,published_at,created_at,category_id,quantity,delivery_method',
    )
    .eq('listing_type', 'sale')
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .limit(PRODUCT_LIMIT)

  if (categoryId) productQuery = productQuery.eq('category_id', categoryId)
  if (filters.minPrice !== undefined) productQuery = productQuery.gte('price', filters.minPrice)
  if (filters.maxPrice !== undefined) productQuery = productQuery.lte('price', filters.maxPrice)
  if (filters.condition) productQuery = productQuery.eq('condition_grade', filters.condition)
  if (filters.governorate) productQuery = productQuery.ilike('governorate', filters.governorate)

  if (filters.sort === 'price_low') {
    productQuery = productQuery.order('price', { ascending: true, nullsFirst: false })
  } else if (filters.sort === 'price_high') {
    productQuery = productQuery.order('price', { ascending: false, nullsFirst: false })
  } else {
    productQuery = productQuery
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
  }

  if (searchTerm) {
    const pattern = '%' + searchTerm + '%'
    productQuery = productQuery.or('title.ilike.' + pattern + ',description.ilike.' + pattern)
  }

  const [
    categoryResponse,
    productsResponse,
    productCountResponse,
    membersCountResponse,
    sellerCountResponse,
    headerAdsResponse,
  ] = await Promise.all([
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
      .eq('listing_type', 'sale')
      .eq('status', 'published')
      .eq('moderation_status', 'approved'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true)
      .eq('account_type', 'seller'),
    supabase
      .from('header_ad_promotions')
      .select('id,title,subtitle,media_type,media_url,poster_url,target_url,cta_label,alt_text')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const categories = (categoryResponse.data || []) as CategoryRow[]
  const products = (productsResponse.data || []) as ProductRow[]
  const ownerIds = Array.from(
    new Set(products.map((product) => product.owner_id).filter((id): id is string => Boolean(id))),
  )
  const productIds = products.map((product) => product.id)

  const [imagesResponse, profilesResponse, reviewsResponse] = await Promise.all([
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
    productIds.length
      ? supabase
          .from('reviews')
          .select('product_id,rating')
          .eq('status', 'published')
          .in('product_id', productIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const imageByProduct = new Map<string, ImageRow>()
  for (const image of (imagesResponse.data || []) as ImageRow[]) {
    if (!imageByProduct.has(image.product_id)) imageByProduct.set(image.product_id, image)
  }

  const profileById = new Map(
    (profilesResponse.data || []).map((profile) => [profile.id, profile as ProfileRow]),
  )

  const ratingByProduct = new Map<string, { value: number; count: number }>()
  for (const review of (reviewsResponse.data || []) as ReviewRow[]) {
    const current = ratingByProduct.get(review.product_id) || { value: 0, count: 0 }
    current.value += Number(review.rating)
    current.count += 1
    ratingByProduct.set(review.product_id, current)
  }

  for (const [productId, aggregate] of ratingByProduct) {
    ratingByProduct.set(productId, {
      value: Number((aggregate.value / aggregate.count).toFixed(1)),
      count: aggregate.count,
    })
  }

  const headerAds: HeaderPromo[] = (headerAdsResponse.data || []).flatMap((row) => {
    if (row.media_type !== 'image' && row.media_type !== 'video') return []
    if (!row.media_url || !row.target_url || !row.title) return []
    if (!isSafeMediaUrl(row.media_url) || !isSafeTargetUrl(row.target_url)) return []

    return [
      {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        mediaType: row.media_type,
        mediaUrl: row.media_url,
        posterUrl: row.poster_url,
        targetUrl: row.target_url,
        ctaLabel: row.cta_label || 'اكتشف الآن',
        altText: row.alt_text || row.title,
      },
    ]
  })

  return {
    categories,
    products,
    headerAds,
    imageByProduct,
    profileById,
    ratingByProduct,
    stats: {
      products: productCountResponse.count || 0,
      members: membersCountResponse.count || 0,
      sellers: sellerCountResponse.count || 0,
    },
  }
}

function toProductCardItem(
  product: ProductRow,
  data: Awaited<ReturnType<typeof loadHomeData>>,
  categoryName?: string | null,
): ProductCardItem {
  const image = data.imageByProduct.get(product.id)
  const seller = product.owner_id ? data.profileById.get(product.owner_id) : null

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    listingType: 'sale',
    price: normalizePrice(product.price),
    currency: product.currency || 'EGP',
    conditionGrade: product.condition_grade,
    city: product.city,
    governorate: product.governorate,
    categoryName:
      categoryName ||
      data.categories.find((row) => row.id === product.category_id)?.name_ar ||
      null,
    imageUrl: getImageUrl(image?.storage_path || null),
    imageAlt: image?.alt_text?.trim() || product.title,
    sellerId: product.owner_id,
    sellerName: seller?.display_name || seller?.username || 'عضو DEBA',
    sellerAvatar:
      seller?.avatar_url && /^https?:\/\//i.test(seller.avatar_url) ? seller.avatar_url : null,
    sellerVerified: false,
    quantityAvailable: product.quantity,
    isLowStock: product.quantity > 0 && product.quantity <= 3,
    deliveryMethod: product.delivery_method,
    ratingValue: data.ratingByProduct.get(product.id)?.value ?? null,
    ratingCount: data.ratingByProduct.get(product.id)?.count ?? 0,
  }
}

function ProductRail({
  title,
  subtitle,
  products,
  data,
  href,
}: {
  title: string
  subtitle?: string
  products: ProductRow[]
  data: Awaited<ReturnType<typeof loadHomeData>>
  href?: string
}) {
  if (!products.length) return null

  return (
    <section className="fm-section fm-rail-section">
      <div className="fm-container">
        <div className="fm-section-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {href ? (
            <Link href={href} className="fm-section-link">
              عرض الكل <ArrowLeft size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        <div className="fm-rail">
          {products.map((product, index) => (
            <div className="fm-rail-item" key={product.id}>
              <ProductCard item={toProductCardItem(product, data)} priority={index < 2} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Hero({
  products,
  data,
}: {
  products: ProductRow[]
  data: Awaited<ReturnType<typeof loadHomeData>>
}) {
  const latest = products.slice(0, 8)

  return (
    <section id="latest" className="deba-market-pulse" aria-label="أحدث المعروض للبيع">
      <div className="fm-container">
        <div className="deba-market-pulse-head">
          <div>
            <span className="deba-market-pulse-kicker">السوق الآن</span>
            <h1>أحدث المعروض للبيع</h1>
            <p>وصل الآن إلى السوق — بطاقات خفيفة، صور واضحة، وسعر ظاهر من أول نظرة.</p>
          </div>
          <Link href="/?sort=newest" className="deba-market-pulse-link">
            عرض كل الجديد <ArrowLeft size={16} aria-hidden="true" />
          </Link>
        </div>

        {latest.length ? (
          <div className="deba-market-pulse-track">
            {latest.map((product) => {
              const image = data.imageByProduct.get(product.id)
              const imageUrl = getImageUrl(image?.storage_path || null)
              return (
                <Link
                  key={product.id}
                  href={'/products/' + encodeURIComponent(product.slug)}
                  className="deba-market-pulse-card"
                >
                  <div className="deba-market-pulse-media">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={image?.alt_text?.trim() || product.title}
                        fill
                        sizes="(max-width: 700px) 42vw, 190px"
                      />
                    ) : (
                      <div className="deba-market-card-placeholder"><PackageCheck size={28} aria-hidden="true" /><span>DEBA</span></div>
                    )}
                    <span className="deba-market-pulse-new">جديد</span>
                  </div>
                  <div className="deba-market-pulse-copy">
                    <span>{product.category_id ? 'معروض للبيع' : 'سلعة منشورة'}</span>
                    <strong>{product.title}</strong>
                    <b>{formatPrice(product.price, product.currency)}</b>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="deba-market-pulse-empty">
            <PackageCheck size={24} aria-hidden="true" />
            <span>لا توجد سلع منشورة حديثًا الآن.</span>
            <Link href="/sell">كن أول من ينشر</Link>
          </div>
        )}
      </div>
    </section>
  )
}

function CategoryGrid({ categories }: { categories: Array<{ row: CategoryRow; label: string; slug: string; icon: LucideIcon }> }) {
  return (
    <section className="fm-section fm-category-section" id="categories">
      <div className="fm-container">
        <div className="fm-section-head">
          <div>
            <h2>تصفح الأقسام</h2>
            <p>انتقل مباشرة إلى المجال الذي تبحث فيه.</p>
          </div>
          <Link href="#latest" className="fm-section-link">
            مشاهدة المنتجات <ArrowLeft size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="fm-category-grid">
          {categories.map((category) => {
            const Icon = category.icon

            return (
              <Link
                key={category.row.id}
                href={'/?category=' + encodeURIComponent(category.slug)}
                className="fm-category-card"
              >
                <span className="fm-category-icon">
                  <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <strong>{category.label}</strong>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function BrowseView({
  data,
  q,
  category,
  condition,
  governorate,
  minPrice,
  maxPrice,
  safeSort,
  hasResultsFilter,
}: {
  data: Awaited<ReturnType<typeof loadHomeData>>
  q?: string
  category?: string
  condition?: string
  governorate?: string
  minPrice: number | null
  maxPrice: number | null
  safeSort: SearchFilters['sort']
  hasResultsFilter: boolean
}) {
  return (
    <section className="fm-browse">
      <div className="fm-container">
        <div className="fm-breadcrumb">
          <Link href="/">الرئيسية</Link>
          <span>/</span>
          <strong>{q ? 'نتائج البحث' : 'المنتجات'}</strong>
        </div>

        <div className="fm-browse-head">
          <div>
            <span>الكتالوج</span>
            <h1>{q ? 'نتائج البحث عن «' + q + '»' : 'المنتجات'}</h1>
            <p>{data.products.length.toLocaleString('ar-EG')} نتيجة معروضة من الكتالوج الحالي.</p>
          </div>
          <Link href="/#latest" className="fm-section-link">
            العودة للرئيسية <ArrowLeft size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="fm-filter-card">
          <form action="/" method="get" className="fm-filter-form">
            {q ? <input type="hidden" name="q" value={q} /> : null}
            {category ? <input type="hidden" name="category" value={category} /> : null}

            <input
              name="minPrice"
              type="number"
              min="0"
              step="1"
              placeholder="أقل سعر"
              defaultValue={minPrice ?? ''}
              aria-label="أقل سعر"
            />
            <input
              name="maxPrice"
              type="number"
              min="0"
              step="1"
              placeholder="أعلى سعر"
              defaultValue={maxPrice ?? ''}
              aria-label="أعلى سعر"
            />
            <select name="condition" defaultValue={condition || ''} aria-label="حالة المنتج">
              <option value="">كل الحالات</option>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              name="governorate"
              type="text"
              maxLength={80}
              placeholder="المحافظة"
              defaultValue={governorate || ''}
              aria-label="المحافظة"
            />
            <select name="sort" defaultValue={safeSort} aria-label="ترتيب النتائج">
              <option value="newest">الأحدث</option>
              <option value="price_low">السعر: من الأقل</option>
              <option value="price_high">السعر: من الأعلى</option>
            </select>

            <button type="submit" className="fm-filter-button">
              <Search size={16} aria-hidden="true" />
              تطبيق الفلاتر
            </button>

            {hasResultsFilter ? (
              <Link href="/#latest" className="fm-filter-reset">
                مسح الفلاتر
              </Link>
            ) : null}
          </form>
        </div>

        {data.products.length ? (
          <div className="fm-results-grid">
            {data.products.map((product, index) => (
              <ProductCard
                key={product.id}
                item={toProductCardItem(product, data)}
                priority={index < 4}
              />
            ))}
          </div>
        ) : (
          <div className="fm-empty-state">
            <PackageCheck size={42} aria-hidden="true" />
            <h2>لا توجد نتائج مطابقة</h2>
            <p>
              {q
                ? 'جرّب تعديل عبارة البحث أو إزالة بعض الفلاتر.'
                : 'ستظهر المنتجات هنا تلقائيًا بعد نشرها واعتمادها.'}
            </p>
            <Link href="/" className="fm-btn fm-btn-primary">
              العودة للتصفح
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

function TrustSection() {
  const items = [
    {
      icon: ShieldCheck,
      title: 'نشر واضح',
      copy: 'المعروض في السوق العام يمر عبر حالة النشر والمراجعة الموجودة في النظام.',
    },
    {
      icon: PackageCheck,
      title: 'تفاصيل حقيقية',
      copy: 'السعر والحالة والموقع والصور مرتبطة بالإعلان المنشور، وليست بيانات تجميلية.',
    },
    {
      icon: Truck,
      title: 'توصيل مفهوم',
      copy: 'وسيلة التوصيل تظهر حسب ما حدده البائع في الإعلان.',
    },
    {
      icon: HeartHandshake,
      title: 'مسار متصل',
      copy: 'التصفح والحساب والسلة والمفضلة والطلبات تعمل ضمن التطبيق الحقيقي.',
    },
  ]

  return (
    <section className="fm-section fm-trust-section" id="trust">
      <div className="fm-container">
        <div className="fm-trust">
          <div className="fm-section-head">
            <div>
              <h2>لماذا DEBA؟</h2>
              <p>كل شيء واضح بما يكفي لتتخذ قرارك بثقة وبدون ضوضاء.</p>
            </div>
          </div>

          <div className="fm-trust-grid">
            {items.map((item) => {
              const Icon = item.icon

              return (
                <article key={item.title} className="fm-trust-card">
                  <span>
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.copy}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function SellerSection() {
  return (
    <section className="fm-section fm-seller-section" id="sell">
      <div className="fm-container">
        <div className="fm-seller">
          <div>
            <span className="fm-eyebrow">للبائعين</span>
            <h2>حوّل ما لا تحتاجه إلى قيمة</h2>
            <p>
              أضف الصور والسعر والحالة ووسيلة التوصيل، ثم تابع إعلانك من حسابك داخل DEBA.
            </p>
            <div className="fm-seller-points">
              <span><Camera size={15} /> صور واضحة</span>
              <span><Tag size={15} /> سعر وحالة</span>
              <span><Truck size={15} /> وسيلة التوصيل</span>
              <span><BadgeCheck size={15} /> مسار المراجعة</span>
            </div>
          </div>

          <div className="fm-seller-action">
            <Link href="/sell" className="fm-btn fm-btn-primary fm-btn-lg">
              <Tag size={18} aria-hidden="true" />
              أضف إعلانك
            </Link>
            <Link href="/support" className="fm-btn fm-btn-secondary">
              مركز المساعدة
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: SearchParamValue
    category?: SearchParamValue
    minPrice?: SearchParamValue
    maxPrice?: SearchParamValue
    condition?: SearchParamValue
    governorate?: SearchParamValue
    sort?: SearchParamValue
  }>
}) {
  const params = await searchParams
  const q = firstParam(params.q)
  const category = firstParam(params.category)
  const condition = firstParam(params.condition)
  const governorate = firstParam(params.governorate)
  const sortValue = firstParam(params.sort)
  const minPrice = parsePositiveNumber(firstParam(params.minPrice))
  const maxPrice = parsePositiveNumber(firstParam(params.maxPrice))

  const safeSort: SearchFilters['sort'] =
    sortValue === 'price_low' || sortValue === 'price_high' ? sortValue : 'newest'

  const data = await loadHomeData({
    q,
    category,
    condition: condition && Object.hasOwn(CONDITION_LABELS, condition) ? condition : undefined,
    governorate: governorate?.trim().slice(0, 80) || undefined,
    minPrice: minPrice ?? undefined,
    maxPrice:
      maxPrice !== null && (minPrice === null || maxPrice >= minPrice) ? maxPrice : undefined,
    sort: safeSort,
  })

  const presentationCategories = data.categories.map((row) => ({
    slug: row.slug,
    icon: CATEGORY_ICON_BY_SLUG[row.slug] || Layers3,
    label: row.name_ar,
    row,
  }))

  const hasResultsFilter = Boolean(
    q ||
      (category && category !== 'all') ||
      condition ||
      governorate ||
      minPrice !== null ||
      maxPrice !== null ||
      safeSort !== 'newest',
  )

  const departmentSections = presentationCategories
    .map((categoryItem) => ({
      ...categoryItem,
      products: data.products
        .filter((product) => product.category_id === categoryItem.row.id)
        .slice(0, 6),
    }))
    .filter((section) => section.products.length >= 2)
    .slice(0, 3)

  return (
    <div className="deba-marketplace">
      <Header
        categories={presentationCategories.map((item) => ({
          id: item.row.id,
          nameAr: item.label,
          slug: item.row.slug,
        }))}
        initialSearch={q || ''}
        initialCategory={category || 'all'}
        promotions={data.headerAds}
      />

      <main>
        {hasResultsFilter ? (
          <BrowseView
            data={data}
            q={q}
            category={category}
            condition={condition}
            governorate={governorate}
            minPrice={minPrice}
            maxPrice={maxPrice}
            safeSort={safeSort}
            hasResultsFilter={hasResultsFilter}
          />
        ) : (
          <>
            <Hero products={data.products} data={data} />
            <CategoryGrid categories={presentationCategories} />

            {departmentSections.map((section) => (
              <ProductRail
                key={section.row.id}
                title={'في ' + section.label}
                subtitle="منتجات منشورة حاليًا في هذا القسم."
                products={section.products}
                data={data}
                href={'/?category=' + encodeURIComponent(section.slug)}
              />
            ))}

            <TrustSection />
            <SellerSection />
          </>
        )}
      </main>

      <footer className="fm-footer">
        <div className="fm-container">
          <div className="fm-footer-grid">
            <div className="fm-footer-brand">
              <Link href="/" className="fm-footer-logo">
                <span>DEBA</span>
                <small>سوق مصري للبيع والشراء والتبادل</small>
              </Link>
              <p>
                منصة مصرية تجمع البيع والشراء والتبادل والتبرع في تجربة واضحة ومتّصلة.
              </p>
            </div>

            <div>
              <h3>التسوق</h3>
              <Link href="/">الرئيسية</Link>
              <Link href="#categories">الأقسام</Link>
              <Link href="#latest">أحدث المنتجات</Link>
            </div>

            <div>
              <h3>البيع على DEBA</h3>
              <Link href="/sell">أضف إعلانك</Link>
              <Link href="/profile?tab=products">إعلاناتي</Link>
              <Link href="/profile?tab=orders">الطلبات</Link>
            </div>

            <div>
              <h3>الحساب والمساعدة</h3>
              <Link href="/profile">حسابي</Link>
              <Link href="/profile?tab=favorites">المفضلة</Link>
              <Link href="/chat">المحادثات</Link>
              <Link href="/support">مركز المساعدة</Link>
            </div>
          </div>

          <div className="fm-footer-bottom">
            <span>© {new Date().getFullYear()} DEBA. جميع الحقوق محفوظة.</span>
            <div>
              <Link href="/support">الدعم</Link>
              <Link href="/legal">السياسات والخصوصية</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
