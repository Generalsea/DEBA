import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  BadgeCheck,
  BookOpen,
  Camera,
  Car,
  Building2,
  Heart,
  HeartHandshake,
  KeyRound,
  Layers3,
  MessageCircle,
  PackageCheck,
  Palette,
  Search,
  ShieldCheck,
  Smartphone,
  Sofa,
  Tag,
  Users,
  Wrench,
} from 'lucide-react'
import Header from '@/components/Header'
import ClassifiedFilterBar from '@/components/ClassifiedFilterBar'
import ClassifiedListingCard, { type ClassifiedListingItem } from '@/components/ClassifiedListingCard'
import type { HeaderPromo } from '@/components/HeaderReelsRail'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'DEBA | سوق الإعلانات والبيع المباشر في مصر',
  description:
    'DEBA — سوق مصري للإعلانات المبوبة والبيع والشراء والتبادل والتواصل المباشر بين المستخدمين.',
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
  city?: string
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
  price: number | string | null
  currency: string
  condition_grade: string | null
  city: string | null
  governorate: string | null
  published_at: string | null
  created_at: string
  category_id: string | null
  quantity: number
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
  good: 'مستعمل',
  fair: 'مستعمل',
  poor: 'يحتاج عناية',
  for_parts: 'للقطع / الإصلاح',
}

const CATEGORY_EMOJI_BY_SLUG: Record<string, string> = {
  electronics: '📱',
  'home-appliances': '🏠',
  'furniture-home': '🛋️',
  fashion: '👕',
  'books-education': '📚',
  'toys-hobbies': '🎮',
  'vehicles-parts': '🚗',
  'real-estate': '🏡',
  'tools-equipment': '🔧',
  'collectibles-antiques': '🏺',
  'baby-kids': '🧸',
  'sports-fitness': '⚽',
  other: '📦',
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

  const amount = new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: 0,
  }).format(number)

  return amount + ' ' + (currency === 'EGP' ? 'جنيه' : currency || 'جنيه')
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

function isSafeUrl(value: string) {
  return /^https?:\/\//i.test(value) || (/^\//.test(value) && !value.startsWith('//'))
}

function resolveCondition(value: string | undefined) {
  if (!value) return undefined
  if (value === 'new') return ['new']
  if (value === 'used') return ['like_new', 'excellent', 'good', 'fair', 'poor', 'for_parts']
  if (Object.hasOwn(CONDITION_LABELS, value)) return [value]
  return undefined
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
      'id,owner_id,title,slug,description,price,currency,condition_grade,city,governorate,published_at,created_at,category_id,quantity',
    )
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .eq('listing_type', 'sale')
    .not('owner_id', 'is', null)
    .gt('quantity', 0)
    .gt('price', 0)
    .limit(PRODUCT_LIMIT)

  if (categoryId) productQuery = productQuery.eq('category_id', categoryId)
  if (filters.minPrice !== undefined) productQuery = productQuery.gte('price', filters.minPrice)
  if (filters.maxPrice !== undefined) productQuery = productQuery.lte('price', filters.maxPrice)

  const conditionValues = resolveCondition(filters.condition)
  if (conditionValues?.length === 1) {
    productQuery = productQuery.eq('condition_grade', conditionValues[0])
  } else if (conditionValues?.length) {
    productQuery = productQuery.in('condition_grade', conditionValues)
  }

  if (filters.governorate) {
    productQuery = productQuery.ilike('governorate', filters.governorate)
  }

  if (filters.city) {
    productQuery = productQuery.ilike('city', filters.city)
  }

  if (filters.sort === 'price_low') {
    productQuery = productQuery.order('price', { ascending: true, nullsFirst: false })
  } else if (filters.sort === 'price_high') {
    productQuery = productQuery.order('price', { ascending: false, nullsFirst: false })
  } else {
    productQuery = productQuery
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
  }

  const productsResponse =
    searchTerm
      ? await supabase.rpc('search_marketplace_products', {
          p_query: searchTerm,
          p_limit: PRODUCT_LIMIT,
          p_offset: 0,
          p_category_slug:
            filters.category && filters.category !== 'all' ? filters.category : null,
          p_min_price: filters.minPrice ?? null,
          p_max_price: filters.maxPrice ?? null,
          p_condition: filters.condition ?? null,
          p_governorate: filters.governorate ?? null,
          p_city: filters.city ?? null,
          p_sort: filters.sort ?? 'relevance',
        })
      : await productQuery

  const [categoryResponse, productCountResponse, membersCountResponse, headerAdsResponse] =
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
        .eq('status', 'published')
        .eq('moderation_status', 'approved')
        .eq('listing_type', 'sale')
        .not('owner_id', 'is', null)
        .gt('quantity', 0)
        .gt('price', 0),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_public', true),
      supabase
        .from('header_ad_promotions')
        .select('id,title,subtitle,media_type,media_url,poster_url,target_url,cta_label,alt_text')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(8),
    ])

  let resolvedProductsResponse = productsResponse

  if (searchTerm && productsResponse.error) {
    console.error('DEBA FTS search RPC failed; falling back to ILIKE search', productsResponse.error)
    const pattern = '%' + searchTerm + '%'
    resolvedProductsResponse = await productQuery.or(
      'title.ilike.' + pattern + ',description.ilike.' + pattern,
    )
  }

  const categories = (categoryResponse.data || []) as CategoryRow[]
  const products = (resolvedProductsResponse.data || []) as ProductRow[]
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

  const ratingByProduct = new Map<string, { sum: number; count: number }>()
  for (const review of (reviewsResponse.data || []) as ReviewRow[]) {
    const current = ratingByProduct.get(review.product_id) || { sum: 0, count: 0 }
    current.sum += Number(review.rating)
    current.count += 1
    ratingByProduct.set(review.product_id, current)
  }

  const headerAds: HeaderPromo[] = (headerAdsResponse.data || []).flatMap((row) => {
    if (row.media_type !== 'image' && row.media_type !== 'video') return []
    if (!row.media_url || !row.target_url || !row.title) return []
    if (!isSafeUrl(row.media_url) || !isSafeUrl(row.target_url)) return []

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
    },
  }
}

function toClassifiedItem(
  product: ProductRow,
  data: Awaited<ReturnType<typeof loadHomeData>>,
  categoryName?: string | null,
): ClassifiedListingItem {
  const image = data.imageByProduct.get(product.id)
  const seller = product.owner_id ? data.profileById.get(product.owner_id) : null
  const aggregate = data.ratingByProduct.get(product.id)
  const ratingValue =
    aggregate && aggregate.count > 0 ? Number((aggregate.sum / aggregate.count).toFixed(1)) : null

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    price: normalizePrice(product.price),
    currency: product.currency || 'EGP',
    conditionLabel:
      (product.condition_grade && CONDITION_LABELS[product.condition_grade]) || 'غير محددة',
    city: product.city,
    governorate: product.governorate,
    categoryName:
      categoryName ||
      data.categories.find((row) => row.id === product.category_id)?.name_ar ||
      null,
    imageUrl: getImageUrl(image?.storage_path || null),
    imageAlt: image?.alt_text?.trim() || product.title,
    sellerName: seller?.display_name || seller?.username || 'عضو DEBA',
    sellerAvatar:
      seller?.avatar_url && /^https?:\/\//i.test(seller.avatar_url) ? seller.avatar_url : null,
    ratingValue,
    ratingCount: aggregate?.count || 0,
    publishedAt: product.published_at || product.created_at,
  }
}

function HeroVisual({
  products,
  data,
}: {
  products: ProductRow[]
  data: Awaited<ReturnType<typeof loadHomeData>>
}) {
  const tiles = products.slice(0, 6)

  return (
    <div className="deba-classified-hero-visual">
      {tiles.length
        ? tiles.map((product, index) => {
            const image = data.imageByProduct.get(product.id)
            const imageUrl = getImageUrl(image?.storage_path || null)

            return (
              <Link
                key={product.id}
                href={'/products/' + encodeURIComponent(product.slug)}
                className={
                  'deba-classified-hero-listing deba-classified-hero-listing-' +
                  Math.min(index + 1, 6)
                }
              >
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={image?.alt_text?.trim() || product.title}
                    fill
                    priority={index < 2}
                    sizes="(max-width: 1024px) 30vw, 220px"
                  />
                ) : (
                  <div className="deba-classified-hero-placeholder">
                    <PackageCheck size={28} aria-hidden="true" />
                    <span>DEBA</span>
                  </div>
                )}
              </Link>
            )
          })
        : Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className={
                'deba-classified-hero-listing deba-classified-hero-listing-' +
                Math.min(index + 1, 6) +
                ' is-placeholder'
              }
            >
              <div className="deba-classified-hero-placeholder">
                <PackageCheck size={28} aria-hidden="true" />
                <span>DEBA</span>
              </div>
            </div>
          ))}
    </div>
  )
}

function HeroSection({
  products,
  data,
  stats,
}: {
  products: ProductRow[]
  data: Awaited<ReturnType<typeof loadHomeData>>
  stats: { products: number; members: number }
}) {
  return (
    <section className="deba-classified-hero">
      <div className="deba-classified-container">
        <div className="deba-classified-hero-content">
          <div className="deba-classified-hero-text">
            <h1>بيع، اشتري، أو تبادل في مصر</h1>
            <p>إعلانات حقيقية من مستخدمين في جميع أنحاء مصر — ابحث، تواصل، واتفق مباشرة.</p>
            <div className="deba-classified-hero-cta">
              <Link href="#latest" className="deba-classified-btn deba-classified-btn-primary">
                تصفح الإعلانات
              </Link>
              <Link href="/sell" className="deba-classified-btn deba-classified-btn-secondary">
                نشر إعلان مجاني
              </Link>
            </div>
            <div className="deba-classified-hero-stats" aria-label="إحصائيات DEBA">
              <div>
                <strong>{stats.products.toLocaleString('ar-EG')}</strong>
                <span>إعلانًا نشطًا</span>
              </div>
              <div>
                <strong>{stats.members.toLocaleString('ar-EG')}</strong>
                <span>عضوًا مسجلًا</span>
              </div>
              <div>
                <strong>مباشر</strong>
                <span>تواصل مع المعلن</span>
              </div>
            </div>
          </div>

          <HeroVisual products={products} data={data} />
        </div>
      </div>
    </section>
  )
}

function RealEstateSection({ category }: { category: CategoryRow | undefined }) {
  const propertyTypes = [
    ['شقق وفلل', 'سكني', '🏠'],
    ['أراضي', 'سكني وتجاري', '📐'],
    ['محلات ومكاتب', 'تجاري وإداري', '🏢'],
    ['شاليهات ومصايف', 'مصايف', '🌊'],
  ] as const

  return (
    <section className="deba-classified-real-estate" id="real-estate">
      <div className="deba-classified-container">
        <div className="deba-classified-section-header deba-classified-section-header-with-link">
          <div>
            <span>DEBA REAL ESTATE</span>
            <h2>العقارات على DEBA</h2>
          </div>
          {category ? (
            <Link href="/?category=real-estate" className="deba-classified-section-link">
              اكتشف كل العقارات <span aria-hidden="true">←</span>
            </Link>
          ) : null}
        </div>
        <div className="deba-classified-real-estate-grid">
          {propertyTypes.map(([title, subtitle, icon]) => (
            <Link
              key={title}
              href="/?category=real-estate"
              className="deba-classified-real-estate-card"
            >
              <span className="deba-classified-real-estate-icon" aria-hidden="true">{icon}</span>
              <div>
                <strong>{title}</strong>
                <span>{subtitle}</span>
              </div>
              <span className="deba-classified-real-estate-arrow" aria-hidden="true">←</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function CategoryDiscovery({ categories }: { categories: CategoryRow[] }) {
  return (
    <section className="deba-classified-category-discovery" id="categories">
      <div className="deba-classified-container">
        <div className="deba-classified-section-header">
          <h2>تصفح حسب القسم</h2>
        </div>

        <div className="deba-classified-category-grid">
          {categories.slice(0, 8).map((category) => (
            <Link
              href={'/?category=' + encodeURIComponent(category.slug)}
              className="deba-classified-category-card"
              key={category.id}
            >
              <span className="deba-classified-category-icon">
                {CATEGORY_EMOJI_BY_SLUG[category.slug] || '📦'}
              </span>
              <span className="deba-classified-category-name">{category.name_ar}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function ListingRail({
  title,
  href,
  products,
  data,
}: {
  title: string
  href: string
  products: ProductRow[]
  data: Awaited<ReturnType<typeof loadHomeData>>
}) {
  if (!products.length) return null

  return (
    <section className="deba-classified-listing-rail" id={title === 'أحدث الإعلانات' ? 'latest' : undefined}>
      <div className="deba-classified-container">
        <div className="deba-classified-section-header deba-classified-section-header-with-link">
          <h2>{title}</h2>
          <Link href={href} className="deba-classified-section-link">
            عرض الكل <span aria-hidden="true">←</span>
          </Link>
        </div>

        <div className="deba-classified-listing-scroll">
          {products.slice(0, 6).map((product, index) => (
            <div className="deba-classified-listing-scroll-item" key={product.id}>
              <ClassifiedListingCard
                item={toClassifiedItem(product, data)}
                priority={index < 2}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SearchResults({
  data,
  q,
}: {
  data: Awaited<ReturnType<typeof loadHomeData>>
  q?: string
}) {
  return (
    <section className="deba-classified-search-results">
      <div className="deba-classified-container">
        <div className="deba-classified-search-heading">
          <span>نتائج البحث</span>
          <h1>{q ? 'الإعلانات المطابقة لـ «' + q + '»' : 'تصفية الإعلانات'}</h1>
          <p>{data.products.length.toLocaleString('ar-EG')} إعلانًا مطابقًا متاحًا للتصفح.</p>
        </div>

        <div className="deba-classified-results-grid">
          {data.products.length ? (
            data.products.map((product, index) => (
              <ClassifiedListingCard
                key={product.id}
                item={toClassifiedItem(product, data)}
                priority={index < 4}
              />
            ))
          ) : (
            <div className="deba-classified-empty-state">
              <Search size={42} aria-hidden="true" />
              <h2>لا توجد إعلانات مطابقة</h2>
              <p>جرّب حذف بعض الفلاتر أو تعديل عبارة البحث.</p>
              <Link href="/" className="deba-classified-btn deba-classified-btn-primary">
                العودة للسوق
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function TrustSection() {
  const items = [
    { icon: ShieldCheck, title: 'إعلانات حقيقية', copy: 'الإعلانات العامة مرتبطة بحسابات ومارة عبر حالة النشر والمراجعة.' },
    { icon: MessageCircle, title: 'تواصل مباشر', copy: 'ابدأ المحادثة مع صاحب الإعلان من نفس المنصة.' },
    { icon: BadgeCheck, title: 'ثقة أوضح', copy: 'حالة الحساب وتفاصيل الإعلان تساعدك على اتخاذ قرار أكثر وعيًا.' },
    { icon: KeyRound, title: 'مواقع واضحة', copy: 'اعرف المدينة والمحافظة المعلنة قبل بدء التواصل.' },
    { icon: Tag, title: 'نشر بسيط', copy: 'أضف الصور والسعر والحالة والوصف من حسابك.' },
    { icon: Users, title: 'سوق مفتوح', copy: 'الأفراد والتجار يمكنهم عرض ما لديهم في أقسام متعددة.' },
  ]

  return (
    <section className="deba-classified-trust" id="trust">
      <div className="deba-classified-container">
        <div className="deba-classified-section-header">
          <h2>لماذا DEBA؟</h2>
        </div>
        <div className="deba-classified-trust-grid">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <article className="deba-classified-trust-item" key={item.title}>
                <span className="deba-classified-trust-icon"><Icon size={23} aria-hidden="true" /></span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function SellerCta() {
  return (
    <section className="deba-classified-seller-cta" id="sell">
      <div className="deba-classified-container">
        <div>
          <h2>لديك شيء لا تحتاجه؟</h2>
          <p>انشر إعلانك مجانًا وابدأ في الوصول إلى مشترين من مصر.</p>
        </div>
        <div className="deba-classified-seller-actions">
          <Link href="/sell" className="deba-classified-btn deba-classified-btn-primary">
            <Camera size={17} aria-hidden="true" />
            نشر إعلان مجاني
          </Link>
          <Link href="/support" className="deba-classified-btn deba-classified-btn-secondary">
            كيف يعمل DEBA؟
          </Link>
        </div>
      </div>
    </section>
  )
}

function CommunitySection() {
  return (
    <section className="deba-classified-community">
      <div className="deba-classified-container">
        <h2>DEBA - سوق مصري للبيع والشراء والتبادل</h2>
        <div className="deba-classified-community-badges">
          <span><Tag size={22} aria-hidden="true" /> بيع</span>
          <span><Search size={22} aria-hidden="true" /> شراء</span>
          <span><HeartHandshake size={22} aria-hidden="true" /> تبادل</span>
          <span><Heart size={22} aria-hidden="true" /> تبرع</span>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="deba-classified-footer">
      <div className="deba-classified-container">
        <div className="deba-classified-footer-grid">
          <div>
            <h3>DEBA</h3>
            <p>سوق الإعلانات والبيع المباشر في مصر.</p>
            <Link href="/sell" className="deba-classified-footer-publish">+ نشر إعلان</Link>
          </div>
          <div>
            <h3>التصفح</h3>
            <Link href="#categories">الأقسام</Link>
            <Link href="#latest">أحدث الإعلانات</Link>
            <Link href="/?sort=price_low">الأقل سعرًا</Link>
            <Link href="/?sort=price_high">الأعلى سعرًا</Link>
          </div>
          <div>
            <h3>البيع على DEBA</h3>
            <Link href="/sell">ابدأ البيع</Link>
            <Link href="/profile?tab=products">إعلاناتي</Link>
            <Link href="/support">نصائح البيع</Link>
          </div>
          <div>
            <h3>المساعدة</h3>
            <Link href="/support">مركز المساعدة</Link>
            <Link href="/chat">التواصل</Link>
            <Link href="/legal">الأمان والسياسات</Link>
          </div>
          <div>
            <h3>الحساب</h3>
            <Link href="/profile">حسابي</Link>
            <Link href="/profile?tab=favorites">المفضلة</Link>
            <Link href="/chat">الرسائل</Link>
          </div>
          <div>
            <h3>سياسات الموقع</h3>
            <Link href="/legal">الخصوصية</Link>
            <Link href="/legal">الشروط والأحكام</Link>
            <Link href="/legal">قواعد النشر</Link>
          </div>
        </div>

        <div className="deba-classified-footer-bottom">
          <p>© {new Date().getFullYear()} DEBA. جميع الحقوق محفوظة.</p>
          <div>
            <Link href="/support">الدعم</Link>
            <Link href="/legal">السياسات والخصوصية</Link>
          </div>
        </div>
      </div>
    </footer>
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
    city?: SearchParamValue
    sort?: SearchParamValue
  }>
}) {
  const params = await searchParams
  const q = firstParam(params.q)
  const category = firstParam(params.category)
  const condition = firstParam(params.condition)
  const governorate = firstParam(params.governorate)
  const city = firstParam(params.city)
  const sortValue = firstParam(params.sort)
  const minPrice = parsePositiveNumber(firstParam(params.minPrice))
  const maxPrice = parsePositiveNumber(firstParam(params.maxPrice))

  const safeCondition =
    condition === 'new' || condition === 'used' || (condition && Object.hasOwn(CONDITION_LABELS, condition))
      ? condition
      : undefined

  const safeSort: SearchFilters['sort'] =
    sortValue === 'price_low' || sortValue === 'price_high' ? sortValue : 'newest'

  const safeMaxPrice =
    maxPrice !== null && (minPrice === null || maxPrice >= minPrice) ? maxPrice : null

  const data = await loadHomeData({
    q,
    category,
    condition: safeCondition,
    governorate: governorate?.trim().slice(0, 80) || undefined,
    city: city?.trim().slice(0, 100) || undefined,
    minPrice: minPrice ?? undefined,
    maxPrice: safeMaxPrice ?? undefined,
    sort: safeSort,
  })

  const hasResultsFilter = Boolean(
    q ||
      (category && category !== 'all') ||
      safeCondition ||
      governorate ||
      city ||
      minPrice !== null ||
      safeMaxPrice !== null ||
      safeSort !== 'newest',
  )

  const electronicsCategory = data.categories.find((row) => row.slug === 'electronics')
  const electronicsProducts = electronicsCategory
    ? data.products.filter((product) => product.category_id === electronicsCategory.id).slice(0, 4)
    : []

  return (
    <div className="deba-classified-shell">
      <Header
        variant="classified"
        categories={data.categories.map((row) => ({
          id: row.id,
          nameAr: row.name_ar,
          slug: row.slug,
        }))}
        initialSearch={q || ''}
        initialCategory={category || 'all'}
        promotions={data.headerAds}
      />

      <main>
        {hasResultsFilter ? (
          <>
            <section className="deba-classified-results-top">
              <div className="deba-classified-container">
                <ClassifiedFilterBar
                  q={q}
                  category={category}
                  governorate={governorate}
                  city={city}
                  condition={safeCondition}
                  minPrice={minPrice}
                  maxPrice={safeMaxPrice}
                />
              </div>
            </section>
            <SearchResults data={data} q={q} />
          </>
        ) : (
          <>
            <HeroSection products={data.products} data={data} stats={data.stats} />

            <section className="deba-classified-filter-section">
              <div className="deba-classified-container">
                <ClassifiedFilterBar />
              </div>
            </section>

            <CategoryDiscovery categories={data.categories} />

            <RealEstateSection category={data.categories.find((row) => row.slug === 'real-estate')} />

            <ListingRail
              title="أحدث الإعلانات"
              href="/?sort=newest"
              products={data.products}
              data={data}
            />

            <ListingRail
              title="إلكترونيات"
              href="/?category=electronics"
              products={electronicsProducts}
              data={data}
            />

            <TrustSection />
            <SellerCta />
            <CommunitySection />
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
