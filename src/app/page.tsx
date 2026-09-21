import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'DEBA | Marketplace مصري - بيع، شراء، تبرع',
  description: 'DEBA — منصة مصرية للبيع والشراء والتبرع بالسلع غير المستخدمة.',
}

const BUCKET = 'deba-product-media'
const PRODUCT_LIMIT = 6

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
  listing_type: 'sale' | 'donation' | 'free'
  price: number | string | null
  currency: string
  condition_grade: string | null
  city: string | null
  governorate: string | null
  moderation_status: string
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

type CharityRow = {
  id: string
  name_ar: string
  name_en: string | null
  slug: string
  description_ar: string | null
  logo_url: string | null
  website_url: string | null
  city: string | null
  governorate: string | null
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

const CATEGORY_PRESENTATION: { slug: string; icon: string }[] = [
  { slug: 'electronics', icon: '📱' },
  { slug: 'furniture-home', icon: '🛋️' },
  { slug: 'home-appliances', icon: '🔌' },
  { slug: 'fashion', icon: '👕' },
  { slug: 'books-education', icon: '📚' },
  { slug: 'tools-equipment', icon: '🔧' },
  { slug: 'collectibles-antiques', icon: '🎨' },
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

function formatPrice(product: ProductRow) {
  const price = normalizePrice(product.price)

  if (product.listing_type !== 'sale') return 'مجاني'
  if (price === null) return 'السعر عند التواصل'

  return (
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(price) +
    ' ' +
    (product.currency || 'EGP')
  )
}

function locationText(product: ProductRow) {
  return [product.city, product.governorate].filter(Boolean).join('، ') || 'مصر'
}

async function loadHomeData(searchValue: string | undefined, categoryValue: string | undefined) {
  const supabase = await createClient()
  const searchTerm = cleanSearch(searchValue)

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
      'id,owner_id,title,slug,description,listing_type,price,currency,condition_grade,city,governorate,moderation_status,published_at,created_at,category_id',
    )
    .in('listing_type', ['sale', 'donation', 'free'])
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(PRODUCT_LIMIT)

  if (categoryId) productQuery = productQuery.eq('category_id', categoryId)

  if (searchTerm) {
    const pattern = '%' + searchTerm + '%'
    productQuery = productQuery.or('title.ilike.' + pattern + ',description.ilike.' + pattern)
  }

  const [
    categoryResponse,
    productsResponse,
    productCountResponse,
    membersCountResponse,
    verifiedCharitiesCountResponse,
    donationListingCountResponse,
    featuredDonationsResponse,
    charityResponse,
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
      .eq('status', 'published')
      .eq('moderation_status', 'approved'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true),
    supabase
      .from('charities')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'verified')
      .eq('is_active', true),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .in('listing_type', ['donation', 'free'])
      .eq('status', 'published')
      .eq('moderation_status', 'approved'),
    supabase
      .from('products')
      .select(
        'id,owner_id,title,slug,description,listing_type,price,currency,condition_grade,city,governorate,moderation_status,published_at,created_at,category_id',
      )
      .in('listing_type', ['donation', 'free'])
      .eq('status', 'published')
      .eq('moderation_status', 'approved')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('charities')
      .select('id,name_ar,name_en,slug,description_ar,logo_url,website_url,city,governorate')
      .eq('verification_status', 'verified')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const categories = (categoryResponse.data || []) as CategoryRow[]
  const products = (productsResponse.data || []) as ProductRow[]
  const featuredDonations = (featuredDonationsResponse.data || []) as ProductRow[]

  const allProductIds = Array.from(
    new Set([...products, ...featuredDonations].map((product) => product.id)),
  )
  const ownerIds = Array.from(
    new Set(
      [...products, ...featuredDonations]
        .map((product) => product.owner_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  const categoryIds = Array.from(
    new Set(
      [...products, ...featuredDonations]
        .map((product) => product.category_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )

  const [imagesResponse, profilesResponse, categoryRowsResponse] = await Promise.all([
    allProductIds.length
      ? supabase
          .from('product_images')
          .select('id,product_id,storage_path,alt_text,sort_order,is_primary')
          .in('product_id', allProductIds)
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
    if (!imageByProduct.has(image.product_id)) {
      imageByProduct.set(image.product_id, image)
    }
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]))

  return {
    supabase,
    categories,
    products,
    featuredDonations,
    charities: (charityResponse.data || []) as CharityRow[],
    imageByProduct,
    profileById,
    categoryById,
    stats: {
      products: productCountResponse.count || 0,
      members: membersCountResponse.count || 0,
      charities: verifiedCharitiesCountResponse.count || 0,
      donationListings: donationListingCountResponse.count || 0,
    },
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: SearchParamValue
    category?: SearchParamValue
  }>
}) {
  const params = await searchParams
  const q = firstParam(params.q)
  const category = firstParam(params.category)
  const data = await loadHomeData(q, category)

  const categoryMap = new Map(data.categories.map((item) => [item.slug, item]))
  const presentationCategories = CATEGORY_PRESENTATION
    .map((presentation) => ({
      ...presentation,
      row: categoryMap.get(presentation.slug),
    }))
    .filter((item): item is { slug: string; icon: string; row: CategoryRow } => Boolean(item.row))

  const donationCategory = {
    id: 'donations',
    slug: '__donations__',
    name_ar: 'تبرعات',
    name_en: 'Donations',
    sort_order: 10000,
  }

  const categoryFilterHref = (slug: string) =>
    slug === '__donations__'
      ? '/?type=donation#donations'
      : '/?category=' + encodeURIComponent(slug) + '#featured'

  const productRows = q || category
    ? data.products
    : data.products.filter((product) => product.listing_type === 'sale')

  const donationRows = data.featuredDonations

  return (
    <>
      <header className="header">
        <div className="header-top">
          <div className="header-top-content">
            <span>🚚 الاستلام وخيارات التوصيل موضحة داخل كل إعلان</span>
            <span>💬 التفاوض والطلبات من داخل حساب DEBA</span>
          </div>
        </div>

        <div className="header-main">
          <Link href="/" className="logo">
            <div className="logo-icon">🛍️</div>
            <span>DEBA</span>
          </Link>

          <form action="/" method="get" className="search-bar" role="search">
            <input
              name="q"
              type="search"
              defaultValue={q || ''}
              placeholder="ابحث عن منتجات، بائعين، أو فئات..."
              aria-label="البحث في DEBA"
            />
            {category && category !== 'all' && (
              <input type="hidden" name="category" value={category} />
            )}
            <button className="search-btn" type="submit" aria-label="بحث">🔍</button>
          </form>

          <div className="header-actions">
            <Link href="/login" className="header-btn btn-outline">تسجيل الدخول</Link>
            <Link href="/login" className="header-btn btn-primary">ابدأ البيع</Link>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-content">
            <Link href="/" className={'nav-item' + (!category ? ' active' : '')}>الرئيسية</Link>

            {presentationCategories.slice(0, 6).map((item) => (
              <Link
                key={item.row.id}
                href={'/?category=' + encodeURIComponent(item.row.slug) + '#featured'}
                className={'nav-item' + (category === item.row.slug ? ' active' : '')}
              >
                {item.row.name_ar}
              </Link>
            ))}

            <Link
              href="/?type=donation#donations"
              className="nav-item"
            >
              تبرعات
            </Link>

            <Link href="/login" className="nav-item">البائعون</Link>
          </div>
        </nav>
      </header>

      <section className="hero fade-in">
        <div className="hero-content">
          <h1>Marketplace مصري للتجارة والتبرعات</h1>
          <p>بيع، اشتري، أو تبرع بأغراضك غير المستخدمة في منصة DEBA واحدة موثوقة</p>
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
              <div className="stat-label">منتج متاح</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{data.stats.members.toLocaleString('ar-EG')}+</div>
              <div className="stat-label">عضو عام</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{data.stats.charities.toLocaleString('ar-EG')}+</div>
              <div className="stat-label">جمعية موثقة</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{data.stats.donationListings.toLocaleString('ar-EG')}+</div>
              <div className="stat-label">إعلان تبرع متاح</div>
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
              href={categoryFilterHref(item.row.slug)}
              className="category-card"
            >
              <div className="category-icon">{item.icon}</div>
              <div className="category-name">{item.row.name_ar}</div>
            </Link>
          ))}

          <Link href="/?type=donation#donations" className="category-card">
            <div className="category-icon">🎁</div>
            <div className="category-name">{donationCategory.name_ar}</div>
          </Link>
        </div>
      </section>

      <section className="products" id="featured">
        <div className="section-header">
          <h2 className="section-title">منتجات مميزة</h2>
          <Link href="/?type=sale#featured" className="section-link">عرض المزيد ←</Link>
        </div>

        {productRows.length ? (
          <div className="products-grid">
            {productRows.slice(0, PRODUCT_LIMIT).map((product) => {
              const image = data.imageByProduct.get(product.id)
              const seller = product.owner_id ? data.profileById.get(product.owner_id) : null
              const productCategory = product.category_id ? data.categoryById.get(product.category_id) : null
              const sellerName =
                seller?.display_name ||
                seller?.username ||
                'عضو DEBA'
              const sellerInitial = (sellerName.trim().charAt(0) || 'D').toUpperCase()
              const isNew = product.condition_grade === 'new'
              const condition =
                (product.condition_grade && CONDITION_LABELS[product.condition_grade]) ||
                'غير محددة'

              return (
                <Link
                  key={product.id}
                  href={'/products/' + encodeURIComponent(product.slug)}
                  className="product-card"
                  style={{
                    display: 'block',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  <div className="product-image">
                    {getImageUrl(image?.storage_path || null) ? (
                      <img
                        src={getImageUrl(image?.storage_path || null) || ''}
                        alt={image?.alt_text?.trim() || product.title}
                        loading="lazy"
                      />
                    ) : null}

                    <span className={'product-badge ' + (isNew ? 'new' : 'verified')}>
                      {isNew ? 'جديد' : '✓ معتمد'}
                    </span>
                  </div>

                  <div className="product-info">
                    <h3 className="product-title">{product.title}</h3>

                    <div className="product-meta">
                      <span className="product-condition">
                        {condition}
                      </span>
                      <span>📍 {locationText(product)}</span>
                    </div>

                    <div className="product-price">{formatPrice(product)}</div>

                    <div className="product-seller">
                      <div className="seller-avatar">{sellerInitial}</div>
                      <span>{sellerName}</span>
                      <span className="trust-badge">✓ DEBA</span>
                    </div>

                    {productCategory && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: '0.75rem',
                          color: 'var(--gray)',
                        }}
                      >
                        {productCategory.name_ar}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
            <div className="empty-icon">📦</div>
            <h3>لا توجد منتجات منشورة حاليًا</h3>
            <p>
              {q
                ? 'لم نجد سلعًا منشورة تطابق بحثك.'
                : 'ستظهر المنتجات هنا تلقائيًا بعد النشر والمراجعة.'}
            </p>
            <Link href="/login" className="header-btn btn-primary" style={{ marginTop: 16 }}>
              أضف أول إعلان
            </Link>
          </div>
        )}
      </section>

      <section className="donation-section" id="donations">
        <div className="donation-content">
          <div className="donation-info">
            <h2>تبرع بأغراضك لمن يحتاجها</h2>
            <p>
              ساهم في إعادة توجيه قيمة الأغراض غير المستخدمة. التبرعات والسلع
              المجانية المنشورة في DEBA تظهر للمستخدمين داخل نفس المنصة.
            </p>

            <Link
              href="/login"
              className="header-btn"
              style={{ background: 'white', color: 'var(--accent)', fontSize: '1.1rem', padding: '14px 32px' }}
            >
              تبرع الآن
            </Link>

            <div className="donation-stats">
              <div className="donation-stat">
                <div className="donation-stat-number">{data.stats.donationListings.toLocaleString('ar-EG')}</div>
                <div className="donation-stat-label">إعلان تبرع متاح</div>
              </div>
              <div className="donation-stat">
                <div className="donation-stat-number">{data.stats.charities.toLocaleString('ar-EG')}</div>
                <div className="donation-stat-label">جمعية موثقة</div>
              </div>
              <div className="donation-stat">
                <div className="donation-stat-number">{data.stats.members.toLocaleString('ar-EG')}</div>
                <div className="donation-stat-label">عضو عام</div>
              </div>
            </div>
          </div>

          <div className="donation-visual">
            {data.charities.length ? (
              data.charities.map((charity, index) => {
                const icon = ['🏥', '📚', '🎁'][index] || '🤝'
                const description =
                  charity.description_ar ||
                  [charity.city, charity.governorate].filter(Boolean).join('، ') ||
                  'جمعية موثقة ونشطة على DEBA'

                const cardContent = (
                  <>
                    <div className="charity-logo">{icon}</div>
                    <div className="charity-info">
                      <h4>{charity.name_ar}</h4>
                      <p>{description}</p>
                    </div>
                  </>
                )

                return charity.website_url ? (
                  <a
                    key={charity.id}
                    href={charity.website_url}
                    className="charity-card"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {cardContent}
                  </a>
                ) : (
                  <div key={charity.id} className="charity-card">
                    {cardContent}
                  </div>
                )
              })
            ) : (
              <div className="charity-card">
                <div className="charity-logo">🤝</div>
                <div className="charity-info">
                  <h4>لا توجد جمعيات موثقة بعد</h4>
                  <p>ستظهر الجمعيات هنا تلقائيًا بعد التحقق منها داخل DEBA.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="trust-section" id="trust">
        <div className="section-header">
          <h2 className="section-title">لماذا DEBA؟</h2>
        </div>

        <div className="trust-grid">
          <div className="trust-card">
            <div className="trust-icon">🛡️</div>
            <h3>إعلانات معتمدة</h3>
            <p>المنتجات الظاهرة في السوق العام تظهر بعد النشر والمراجعة.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon">💬</div>
            <h3>تفاوض داخل المنصة</h3>
            <p>تقديم العروض وطلبات السلع المجانية مرتبط بحساب DEBA.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon">📦</div>
            <h3>بيانات المنتج واضحة</h3>
            <p>السعر والحالة والموقع والصور المعروضة تأتي من الإعلان نفسه.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon">💚</div>
            <h3>التبرعات جزء من السوق</h3>
            <p>التبرعات والسلع المجانية لها مسار منفصل داخل نفس التجربة.</p>
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
              <li><Link href="/login">ابدأ البيع</Link></li>
              <li><Link href="/login">حساب البائع</Link></li>
              <li><Link href="/login">إعلاناتي</Link></li>
              <li><Link href="/login">العروض</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>للمشترين</h4>
            <ul>
              <li><Link href="#featured">تصفح المنتجات</Link></li>
              <li><Link href="/?type=sale#featured">السلع للبيع</Link></li>
              <li><Link href="/?type=donation#donations">التبرعات</Link></li>
              <li><Link href="/login">حسابي</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>التبرعات</h4>
            <ul>
              <li><Link href="/?type=donation#donations">تبرعات وسلع مجانية</Link></li>
              <li><Link href="#donations">الجمعيات الموثقة</Link></li>
              <li><Link href="/login">قدّم تبرعًا</Link></li>
              <li><Link href="#trust">كيف تعمل DEBA</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>الحساب</h4>
            <ul>
              <li><Link href="/login">تسجيل الدخول</Link></li>
              <li><Link href="/login">المفضلة</Link></li>
              <li><Link href="/login">التفاوض والعروض</Link></li>
              <li><Link href="/login">الطلبات</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>DEBA</h4>
            <ul>
              <li><Link href="/">Marketplace المصري</Link></li>
              <li><Link href="#categories">تصفح الفئات</Link></li>
              <li><Link href="#featured">منتجات مميزة</Link></li>
              <li><Link href="#donations">Impact & Donations</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 DEBA. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </>
  )
}
