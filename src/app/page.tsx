import type { Metadata } from 'next'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Layers3,
  Palette,
  Plug,
  Shirt,
  Smartphone,
  Sofa,
  Wrench,
  ShieldCheck,
  Compass,
  PackageCheck,
  Tag,
  TrendingUp,
} from 'lucide-react'
import Header from '@/components/Header'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'
import type { HeaderPromo } from '@/components/HeaderReelsRail'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'DEBA | Marketplace المصري - بيع وشراء المنتجات',
  description: 'DEBA — Marketplace مصري حديث لبيع وشراء المنتجات داخل تجربة موثوقة وشفافة.',
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

const CATEGORY_PRESENTATION: { slug: string; icon: LucideIcon; label: string }[] = [
  { slug: 'electronics', icon: Smartphone, label: 'إلكترونيات' },
  { slug: 'furniture-home', icon: Sofa, label: 'أثاث' },
  { slug: 'home-appliances', icon: Plug, label: 'أجهزة منزلية' },
  { slug: 'fashion', icon: Shirt, label: 'ملابس' },
  { slug: 'books-education', icon: BookOpen, label: 'كتب' },
  { slug: 'tools-equipment', icon: Wrench, label: 'أدوات' },
  { slug: 'collectibles-antiques', icon: Palette, label: 'تحف' },
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
  return isSafeMediaUrl(value) || value.startsWith('#')
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

  if (filters.minPrice !== undefined) {
    productQuery = productQuery.gte('price', filters.minPrice)
  }

  if (filters.maxPrice !== undefined) {
    productQuery = productQuery.lte('price', filters.maxPrice)
  }

  if (filters.condition) {
    productQuery = productQuery.eq('condition_grade', filters.condition)
  }

  if (filters.governorate) {
    productQuery = productQuery.ilike('governorate', filters.governorate)
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

  return (
    <>
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

      <section className="hero fade-in">
        <div className="hero-content">
          <span className="section-eyebrow">DEBA MARKETPLACE</span>
          <h1>Marketplace مصري لبيع وشراء المنتجات</h1>
          <p>اكتشف المنتجات، بع ما تملك، وتسوق عبر تجربة DEBA الحديثة</p>
          <Link
            href={category || q ? '/#featured' : '#featured'}
            className="header-btn btn-primary"
            style={{ fontSize: '1.1rem', padding: '14px 32px' }}
          >
            ابدأ التسوق الآن
          </Link>

          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-number">{data.stats.products.toLocaleString('ar-EG')}+</div>
              <div className="stat-label">منتج منشور</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{data.stats.sellers.toLocaleString('ar-EG')}+</div>
              <div className="stat-label">بائع على DEBA</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{data.stats.members.toLocaleString('ar-EG')}+</div>
              <div className="stat-label">عضو في المنصة</div>
            </div>
          </div>
        </div>
      </section>

      <section className="categories" id="categories">
        <div className="section-header">
          <h2 className="section-title">تصفح الفئات</h2>
          <Link href="#featured" className="section-link">عرض الكل ←</Link>
        </div>

        <div className="categories-grid">
          {presentationCategories.map((item) => (
            <Link
              key={item.row.id}
              href={'/?category=' + encodeURIComponent(item.row.slug) + '#featured'}
              className="category-card"
            >
              <div className="category-icon" aria-hidden="true"><item.icon size={30} /></div>
              <div className="category-name">{item.label}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="deba-search-filters" aria-label="خيارات البحث المتقدم">
        <div className="deba-search-filters-head">
          <div>
            <span>ADVANCED SEARCH</span>
            <h2>صفِّ النتائج كما تريد</h2>
          </div>
          <span>{data.products.length.toLocaleString('ar-EG')} نتيجة ظاهرة</span>
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
          <select name="condition" defaultValue={condition || ''} aria-label="الحالة">
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
          <button type="submit">تطبيق</button>
          {q || category || condition || governorate || minPrice !== null || maxPrice !== null || safeSort !== 'newest' ? (
            <Link href="/#featured" className="deba-search-filter-reset">مسح الفلاتر</Link>
          ) : null}
        </form>
      </section>

      <section className="products" id="featured">
        <div className="section-header">
          <h2 className="section-title">منتجات مميزة</h2>
          <Link href="/?type=sale#featured" className="section-link">عرض المزيد ←</Link>
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

              return (
                <ProductCard
                  key={product.id}
                  item={item}
                  priority={index < 4}
                />
              )
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
            <div className="empty-icon">
              <PackageCheck size={42} aria-hidden="true" />
            </div>
            <h3>لا توجد منتجات منشورة حاليًا</h3>
            <p>
              {q
                ? 'لم نجد سلعًا منشورة تطابق بحثك.'
                : 'ستظهر المنتجات هنا تلقائيًا بعد النشر والمراجعة.'}
            </p>
            <Link href="/sell" className="header-btn btn-primary" style={{ marginTop: 16 }}>
              أضف أول إعلان
            </Link>
          </div>
        )}
      </section>

      <section className="community-section" id="community">
        <div className="community-content">
          <div className="community-info">
            <span className="section-eyebrow" style={{ color: 'white' }}>DEBA COMMUNITY</span>
            <h2>سوق واحد. قيمة أكبر.</h2>
            <p>
              في DEBA تتحول المنتجات غير المستخدمة إلى فرص جديدة. اكتشف منتجات واضحة التفاصيل،
              تواصل مع البائعين، وأدر مشترياتك وإعلاناتك من حساب واحد.
            </p>

            <Link
              href="#featured"
              className="header-btn"
              style={{ background: 'white', color: 'var(--accent)', fontSize: '1.1rem', padding: '14px 32px' }}
            >
              استكشف السوق
            </Link>
          </div>

          <div className="community-visual">
            <div className="community-card">
              <div className="community-icon"><PackageCheck size={30} aria-hidden="true" /></div>
              <div className="community-card-info">
                <h4>اكتشف منتجات تستحقها</h4>
                <p>تفاصيل واضحة، أسعار محددة، وتجربة شراء مصممة لتكون بسيطة واحترافية.</p>
              </div>
            </div>
            <div className="community-card">
              <div className="community-icon"><Tag size={30} aria-hidden="true" /></div>
              <div className="community-card-info">
                <h4>حوّل ما لا تحتاجه إلى قيمة</h4>
                <p>أضف إعلانك، قدّم بيانات دقيقة، ووصل إلى مجتمع DEBA المهتم بما تعرضه.</p>
              </div>
            </div>
            <div className="community-card">
              <div className="community-icon"><ShieldCheck size={30} aria-hidden="true" /></div>
              <div className="community-card-info">
                <h4>ثقة تبدأ من التفاصيل</h4>
                <p>معلومات المنتج والحالة والموقع والصور جزء أساسي من تجربة المنصة.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-section" id="trust">
        <div className="section-header">
          <h2 className="section-title">لماذا DEBA؟</h2>
        </div>

        <div className="trust-grid">
          <div className="trust-card">
            <div className="trust-icon"><ShieldCheck size={30} aria-hidden="true" /></div>
            <h3>إعلانات مُراجعة</h3>
            <p>المنتجات الظاهرة في السوق العام تمر عبر حالة نشر ومراجعة قبل عرضها.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon"><Compass size={30} aria-hidden="true" /></div>
            <h3>تجربة موحدة</h3>
            <p>تصفح، اشترِ، أو أضف إعلانك من تجربة واحدة مصممة للسوق المصري.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon"><PackageCheck size={30} aria-hidden="true" /></div>
            <h3>بيانات المنتج واضحة</h3>
            <p>السعر والحالة والموقع والصور المعروضة تأتي من الإعلان نفسه.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon"><TrendingUp size={30} aria-hidden="true" /></div>
            <h3>قيمة مستدامة</h3>
            <p>نساعد المنتجات على الوصول إلى أصحابها الجدد بدل بقائها بلا استخدام.</p>
          </div>
        </div>
      </section>

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
              <li><Link href="/profile?tab=orders">طلبات العملاء</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>للمشترين</h4>
            <ul>
              <li><Link href="#featured">تصفح المنتجات</Link></li>
              <li><Link href="/?type=sale#featured">السلع للبيع</Link></li>
              <li><Link href="/profile?tab=favorites">المفضلة</Link></li>
              <li><Link href="/profile?tab=orders">طلباتي</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>مجتمع DEBA</h4>
            <ul>
              <li><Link href="#featured">اكتشف المنتجات</Link></li>
              <li><Link href="#categories">تصفح الفئات</Link></li>
              <li><Link href="/sell">أضف إعلانك</Link></li>
              <li><Link href="#trust">لماذا DEBA</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>الحساب</h4>
            <ul>
              <li><Link href="/profile">حسابي</Link></li>
              <li><Link href="/profile?tab=favorites">المفضلة</Link></li>
              <li><Link href="/profile?tab=settings">إعدادات الحساب</Link></li>
              <li><Link href="/profile?tab=orders">الطلبات</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>DEBA</h4>
            <ul>
              <li><Link href="/">Marketplace المصري</Link></li>
              <li><Link href="#categories">تصفح الفئات</Link></li>
              <li><Link href="#featured">منتجات مميزة</Link></li>
              <li><Link href="#community">DEBA Community</Link></li>
              <li><Link href="/legal">السياسات والخصوصية</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} DEBA. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </>
  )
}
