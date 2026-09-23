import type { Metadata } from 'next'
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
  Sparkles,
  Tag,
  Truck,
  Wrench,
} from 'lucide-react'
import Header from '@/components/Header'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'
import type { HeaderPromo } from '@/components/HeaderReelsRail'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'DEBA | Marketplace مصري حديث لبيع وشراء المنتجات',
  description: 'اكتشف المنتجات المنشورة فعليًا على DEBA، وقارن التفاصيل والسعر والحالة، أو أضف ما لا تحتاجه للبيع.',
}

const BUCKET = 'deba-product-media'
const PRODUCT_LIMIT = 24

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

const CONDITION_LABELS: Record<string, string> = {
  new: 'جديد',
  like_new: 'كالجديد',
  excellent: 'ممتاز',
  good: 'جيد',
  fair: 'مقبول',
  poor: 'يحتاج عناية',
  for_parts: 'للقطع / الإصلاح',
}

const CATEGORY_PRESENTATION: { slug: string; icon: typeof Smartphone; label: string }[] = [
  { slug: 'electronics', icon: Smartphone, label: 'إلكترونيات' },
  { slug: 'furniture-home', icon: Sofa, label: 'أثاث' },
  { slug: 'home-appliances', icon: Plug, label: 'أجهزة منزلية' },
  { slug: 'fashion', icon: Tag, label: 'أزياء' },
  { slug: 'books-education', icon: BookOpen, label: 'كتب وتعليم' },
  { slug: 'tools-equipment', icon: Wrench, label: 'أدوات ومعدات' },
  { slug: 'collectibles-antiques', icon: Palette, label: 'تحف ومقتنيات' },
  { slug: 'other', icon: Layers3, label: 'أخرى' },
]

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
  const categoryValue = filters.category

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

  const [imagesResponse, profilesResponse] = await Promise.all([
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
  ])

  const imageByProduct = new Map<string, ImageRow>()
  for (const image of (imagesResponse.data || []) as ImageRow[]) {
    if (!imageByProduct.has(image.product_id)) imageByProduct.set(image.product_id, image)
  }

  const profileById = new Map(
    (profilesResponse.data || []).map((profile) => [profile.id, profile as ProfileRow]),
  )

  const headerAds: HeaderPromo[] = (headerAdsResponse.data || []).flatMap((row) => {
    if (row.media_type !== 'image' && row.media_type !== 'video') return []
    if (!row.media_url || !row.target_url || !row.title) return []
    if (!isSafeMediaUrl(row.media_url) || !isSafeTargetUrl(row.target_url)) return []

    return [{
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      mediaType: row.media_type,
      mediaUrl: row.media_url,
      posterUrl: row.poster_url,
      targetUrl: row.target_url,
      ctaLabel: row.cta_label || 'اكتشف الآن',
      altText: row.alt_text || row.title,
    }]
  })

  return {
    categories,
    products,
    headerAds,
    imageByProduct,
    profileById,
    stats: {
      products: productCountResponse.count || 0,
      members: membersCountResponse.count || 0,
      sellers: sellerCountResponse.count || 0,
    },
  }
}

function ProductShowcase({
  product,
  imageUrl,
  imageAlt,
}: {
  product: ProductRow
  imageUrl: string | null
  imageAlt: string
}) {
  return (
    <Link
      href={'/products/' + encodeURIComponent(product.slug)}
      className="fm-showcase-card"
      aria-label={'عرض ' + product.title}
    >
      <div className="fm-showcase-media">
        {imageUrl ? (
          <img src={imageUrl} alt={imageAlt} loading="lazy" />
        ) : (
          <div className="fm-showcase-placeholder">
            <ShoppingBag size={30} aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="fm-showcase-body">
        <strong className="fm-showcase-title">{product.title}</strong>
        <span className="fm-showcase-price">
          {normalizePrice(product.price) !== null
            ? new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(normalizePrice(product.price) as number) + ' ' + (product.currency || 'EGP')
            : 'السعر عند التواصل'}
        </span>
        <span className="fm-showcase-meta">
          <PackageCheck size={13} aria-hidden="true" />
          {product.condition_grade ? CONDITION_LABELS[product.condition_grade] || 'حالة موضحة' : 'حالة غير محددة'}
        </span>
      </div>
    </Link>
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
    sortValue === 'price_low' || sortValue === 'price_high'
      ? sortValue
      : 'newest'

  const data = await loadHomeData({
    q,
    category,
    condition: condition && Object.hasOwn(CONDITION_LABELS, condition) ? condition : undefined,
    governorate: governorate?.trim().slice(0, 80) || undefined,
    minPrice: minPrice ?? undefined,
    maxPrice:
      maxPrice !== null && (minPrice === null || maxPrice >= minPrice)
        ? maxPrice
        : undefined,
    sort: safeSort,
  })

  const categoryMap = new Map(data.categories.map((item) => [item.slug, item]))
  const presentationCategories = CATEGORY_PRESENTATION.map((presentation) => ({
    ...presentation,
    row: categoryMap.get(presentation.slug) || {
      id: 'static-' + presentation.slug,
      name_ar: presentation.label,
      name_en: null,
      slug: presentation.slug,
      sort_order: 0,
    },
  }))

  const heroProducts = data.products.slice(0, 3)
  const hasResultsFilter = Boolean(
    q ||
      category ||
      condition ||
      governorate ||
      minPrice !== null ||
      maxPrice !== null ||
      safeSort !== 'newest',
  )

  return (
    <div className="deba-future-home">
      <div className="fm-announcement">
        <span>تجربة DEBA الجديدة: اكتشف، قارن، واشترِ أو أضف ما تملك في سوق واحد.</span>
      </div>

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
        <section className="fm-hero">
          <div className="fm-shell">
            <div className="fm-hero-grid">
              <div className="fm-hero-copy">
                <span className="fm-eyebrow">DEBA MARKETPLACE</span>
                <h1 className="fm-hero-title">
                  تسوق <span className="fm-gradient">بذكاء</span>
                  <br />
                  بع <span className="fm-gradient">بثقة</span>
                  <br />
                  وعِش تجربة <span className="fm-gradient">مستقبلية</span>
                </h1>
                <p className="fm-hero-lead">
                  سوق مصري حديث يجمع المنتجات المنشورة فعليًا مع تجربة بحث واضحة، تفاصيل
                  قابلة للمقارنة، ومسارات بيع وشراء متصلة بحسابك.
                </p>

                <div className="fm-hero-actions">
                  <Link href="#featured" className="fm-btn fm-btn-primary">
                    <Search size={19} aria-hidden="true" />
                    ابدأ الاستكشاف
                  </Link>
                  <Link href="/sell" className="fm-btn fm-btn-secondary">
                    <Tag size={18} aria-hidden="true" />
                    أضف إعلانك
                  </Link>
                </div>

                <div className="fm-stats" aria-label="إحصاءات المنصة">
                  <div className="fm-stat">
                    <strong>{data.stats.products.toLocaleString('ar-EG')}+</strong>
                    <span>منتج منشور</span>
                  </div>
                  <div className="fm-stat">
                    <strong>{data.stats.sellers.toLocaleString('ar-EG')}+</strong>
                    <span>بائع معلن</span>
                  </div>
                  <div className="fm-stat">
                    <strong>{data.stats.members.toLocaleString('ar-EG')}+</strong>
                    <span>عضو عام</span>
                  </div>
                </div>
              </div>

              <div className="fm-showcase" aria-label="منتجات من السوق">
                <div className="fm-orb" aria-hidden="true" />
                <div className="fm-showcase-grid">
                  {heroProducts.map((product) => (
                    <ProductShowcase
                      key={product.id}
                      product={product}
                      imageUrl={getImageUrl(data.imageByProduct.get(product.id)?.storage_path || null)}
                      imageAlt={data.imageByProduct.get(product.id)?.alt_text?.trim() || product.title}
                    />
                  ))}

                  {!heroProducts.length ? (
                    <div className="fm-showcase-empty">
                      <ShoppingBag size={44} aria-hidden="true" />
                      <strong>السوق يتشكل الآن</strong>
                      <span>ستظهر المنتجات هنا تلقائيًا عند نشرها واعتمادها.</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        {data.products.length ? (
          <section className="fm-section fm-section-muted" id="deals">
            <div className="fm-shell">
              <div className="fm-section-heading">
                <div className="fm-heading-copy">
                  <span className="fm-section-kicker">QUICK DISCOVERY</span>
                  <h2 className="fm-section-title">اختيارات سريعة من السوق</h2>
                  <p className="fm-section-subtitle">
                    منتجات منشورة فعليًا وفق ترتيب العرض الحالي — بدون تقييمات أو نسب خصم مصطنعة.
                  </p>
                </div>
                <Link href="#featured" className="fm-section-link">
                  عرض كل النتائج <ArrowLeft size={15} aria-hidden="true" />
                </Link>
              </div>

              <div className="fm-deal-banner">
                <div className="fm-deal-banner-copy">
                  <span className="fm-deal-icon">
                    <Sparkles size={21} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>نركز على ما يستحق أن تراه</strong>
                    <span>التصفية والترتيب والبحث مرتبطة مباشرة بكتالوج DEBA المنشور.</span>
                  </div>
                </div>
                <span className="fm-privacy-note">لا ندّعي وجود عرض أو ندرة ما لم توجد في البيانات.</span>
              </div>

              <div className="products-grid">
                {data.products.slice(0, 4).map((product, index) => {
                  const image = data.imageByProduct.get(product.id)
                  const seller = product.owner_id ? data.profileById.get(product.owner_id) : null

                  const item: ProductCardItem = {
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
                      data.categories.find((categoryRow) => categoryRow.id === product.category_id)?.name_ar || null,
                    imageUrl: getImageUrl(image?.storage_path || null),
                    imageAlt: image?.alt_text?.trim() || product.title,
                    sellerId: product.owner_id,
                    sellerName: seller?.display_name || seller?.username || 'عضو DEBA',
                    sellerAvatar:
                      seller?.avatar_url && /^https?:\/\//i.test(seller.avatar_url)
                        ? seller.avatar_url
                        : null,
                    sellerVerified: false,
                    quantityAvailable: product.quantity,
                    isLowStock: product.quantity > 0 && product.quantity <= 3,
                    deliveryMethod: product.delivery_method,
                  }

                  return <ProductCard key={product.id} item={item} priority={index < 2} />
                })}
              </div>
            </div>
          </section>
        ) : null}

        <section className="fm-section" id="categories">
          <div className="fm-shell">
            <div className="fm-section-heading">
              <div className="fm-heading-copy">
                <span className="fm-section-kicker">EXPLORE</span>
                <h2 className="fm-section-title">تصفح الأقسام</h2>
                <p className="fm-section-subtitle">ابدأ من المجال الذي تبحث فيه بدل التمرير بلا نهاية.</p>
              </div>
              <Link href="#featured" className="fm-section-link">
                مشاهدة المنتجات <ArrowLeft size={15} aria-hidden="true" />
              </Link>
            </div>

            <div className="categories-grid">
              {presentationCategories.map((item) => (
                <Link
                  key={item.row.id}
                  href={'/?category=' + encodeURIComponent(item.row.slug) + '#featured'}
                  className="category-card"
                >
                  <span className="category-icon" aria-hidden="true">
                    <item.icon size={23} />
                  </span>
                  <span className="category-name">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="fm-shell" aria-label="بحث وتصفية المنتجات">
          <div className="deba-search-filters">
            <div className="deba-search-filters-head">
              <div>
                <span>SMART SEARCH</span>
                <h2>صل لما تريده أسرع</h2>
              </div>
              <span>{data.products.length.toLocaleString('ar-EG')} نتيجة معروضة</span>
            </div>

            <form action="/" method="get" className="deba-search-filters-form">
              <input
                name="minPrice"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="أقل سعر"
                defaultValue={minPrice ?? ''}
                aria-label="أقل سعر"
              />
              <input
                name="maxPrice"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="أعلى سعر"
                defaultValue={maxPrice ?? ''}
                aria-label="أعلى سعر"
              />
              <select name="condition" defaultValue={condition || ''} aria-label="حالة المنتج">
                <option value="">كل الحالات</option>
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
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
              {q ? <input type="hidden" name="q" value={q} /> : null}
              {category ? <input type="hidden" name="category" value={category} /> : null}

              <button type="submit">
                <Search size={16} aria-hidden="true" />
                تطبيق
              </button>

              {hasResultsFilter ? (
                <Link href="/#featured" className="deba-search-filter-reset">
                  مسح الفلاتر
                </Link>
              ) : null}
            </form>
          </div>
        </section>

        <section className="products fm-section" id="featured">
          <div className="fm-shell">
            <div className="fm-section-heading">
              <div className="fm-heading-copy">
                <span className="fm-section-kicker">LIVE CATALOG</span>
                <h2 className="fm-section-title">
                  {q ? 'نتائج البحث' : 'منتجات منشورة الآن'}
                </h2>
                <p className="fm-section-subtitle">
                  {q
                    ? 'نتائج مرتبطة بعبارة البحث الحالية ويمكن تضييقها من الفلاتر.'
                    : 'الكتالوج يتحدث من قاعدة البيانات الفعلية للمنتجات المنشورة والمعتمدة.'}
                </p>
              </div>
              <Link href="?sort=newest#featured" className="fm-section-link">
                الأحدث أولًا <ArrowLeft size={15} aria-hidden="true" />
              </Link>
            </div>

            {data.products.length ? (
              <div className="products-grid">
                {data.products.slice(0, PRODUCT_LIMIT).map((product, index) => {
                  const image = data.imageByProduct.get(product.id)
                  const seller = product.owner_id ? data.profileById.get(product.owner_id) : null

                  const item: ProductCardItem = {
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
                      data.categories.find((categoryRow) => categoryRow.id === product.category_id)?.name_ar || null,
                    imageUrl: getImageUrl(image?.storage_path || null),
                    imageAlt: image?.alt_text?.trim() || product.title,
                    sellerId: product.owner_id,
                    sellerName: seller?.display_name || seller?.username || 'عضو DEBA',
                    sellerAvatar:
                      seller?.avatar_url && /^https?:\/\//i.test(seller.avatar_url)
                        ? seller.avatar_url
                        : null,
                    sellerVerified: false,
                    quantityAvailable: product.quantity,
                    isLowStock: product.quantity > 0 && product.quantity <= 3,
                    deliveryMethod: product.delivery_method,
                  }

                  return <ProductCard key={product.id} item={item} priority={index < 4} />
                })}
              </div>
            ) : (
              <div className="fm-empty-state">
                <span className="fm-empty-icon">
                  <PackageCheck size={42} aria-hidden="true" />
                </span>
                <h3>لا توجد منتجات تطابق العرض الحالي</h3>
                <p>
                  {q
                    ? 'جرّب تعديل عبارة البحث أو إزالة بعض الفلاتر.'
                    : 'ستظهر المنتجات هنا تلقائيًا بعد نشرها واعتمادها.'}
                </p>
                <div className="fm-hero-actions">
                  <Link href="/sell" className="fm-btn fm-btn-primary">
                    <Tag size={17} aria-hidden="true" />
                    أضف أول إعلان
                  </Link>
                  {hasResultsFilter ? (
                    <Link href="/#featured" className="fm-btn fm-btn-secondary">
                      مسح البحث
                    </Link>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="fm-trust" id="trust">
          <div className="fm-shell">
            <div className="fm-section-heading">
              <div className="fm-heading-copy">
                <span className="fm-section-kicker">WHY DEBA</span>
                <h2 className="fm-section-title">تجربة مبنية على الوضوح</h2>
                <p className="fm-section-subtitle">
                  التصميم الجيد لا يضغط على المستخدم؛ بل يجعل القرار أسهل وأكثر قابلية للفهم.
                </p>
              </div>
            </div>

            <div className="fm-trust-grid">
              <article className="fm-trust-card">
                <span className="fm-trust-icon"><ShieldCheck size={28} aria-hidden="true" /></span>
                <h3>حالة نشر واضحة</h3>
                <p>السوق العام يعتمد على حالة النشر والمراجعة بدل عرض بيانات غير معتمدة للمشتري.</p>
              </article>
              <article className="fm-trust-card">
                <span className="fm-trust-icon"><BadgeCheck size={28} aria-hidden="true" /></span>
                <h3>بيانات قابلة للفحص</h3>
                <p>السعر والحالة والموقع والصورة الأساسية تُسحب من الإعلان الحقيقي بدل fixtures تصميمية.</p>
              </article>
              <article className="fm-trust-card">
                <span className="fm-trust-icon"><Truck size={28} aria-hidden="true" /></span>
                <h3>توصيل مفهوم</h3>
                <p>وسيلة التوصيل تظهر حسب ما حدده البائع في الإعلان بدل وعود شحن عامة غير مرتبطة بالمنتج.</p>
              </article>
              <article className="fm-trust-card">
                <span className="fm-trust-icon"><HeartHandshake size={28} aria-hidden="true" /></span>
                <h3>تجربة بيع وشراء متصلة</h3>
                <p>الإعلان والحساب والسلة والطلبات مبنية على مسارات التطبيق الحالية وليست واجهة منفصلة.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="fm-seller" id="sell">
          <div className="fm-shell">
            <div className="fm-seller-card">
              <div className="fm-seller-content">
                <span className="fm-section-kicker">FOR SELLERS</span>
                <h2>حوّل ما لا تحتاجه إلى قيمة</h2>
                <p>
                  أضف إعلانًا واضحًا، ارفع الصور، حدد السعر والحالة ووسيلة التوصيل، ثم أدر
                  الإعلان من حسابك داخل DEBA.
                </p>
                <div className="fm-seller-tags">
                  <span className="fm-seller-tag"><Camera size={13} /> صور المنتج</span>
                  <span className="fm-seller-tag"><Tag size={13} /> السعر والحالة</span>
                  <span className="fm-seller-tag"><Truck size={13} /> وسيلة التوصيل</span>
                  <span className="fm-seller-tag"><ShieldCheck size={13} /> مسار المراجعة</span>
                </div>
                <Link href="/sell" className="fm-btn fm-btn-primary">
                  <Tag size={18} aria-hidden="true" />
                  أضف إعلانك الآن
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>عن DEBA</h4>
            <ul>
              <li><Link href="/">الرئيسية</Link></li>
              <li><Link href="#trust">لماذا DEBA</Link></li>
              <li><Link href="#categories">الفئات</Link></li>
              <li><Link href="#featured">المنتجات</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>للبائعين</h4>
            <ul>
              <li><Link href="/sell">ابدأ البيع</Link></li>
              <li><Link href="/profile">حساب البائع</Link></li>
              <li><Link href="/profile?tab=products">إعلاناتي</Link></li>
              <li><Link href="/profile?tab=orders">الطلبات</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>للمشترين</h4>
            <ul>
              <li><Link href="#featured">تصفح المنتجات</Link></li>
              <li><Link href="/?type=sale#featured">السلع للبيع</Link></li>
              <li><Link href="/profile?tab=favorites">المفضلة</Link></li>
              <li><Link href="/cart">السلة</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>الحساب</h4>
            <ul>
              <li><Link href="/profile">حسابي</Link></li>
              <li><Link href="/profile?tab=favorites">المفضلة</Link></li>
              <li><Link href="/profile?tab=settings">الإعدادات</Link></li>
              <li><Link href="/profile?tab=orders">الطلبات</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>DEBA</h4>
            <ul>
              <li><Link href="/">Marketplace المصري</Link></li>
              <li><Link href="#community">مجتمع DEBA</Link></li>
              <li><Link href="/support">الدعم</Link></li>
              <li><Link href="/legal">السياسات والخصوصية</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} DEBA. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  )
}
