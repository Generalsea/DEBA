import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'سوق | Marketplace مصري - بيع، شراء، تبرع',
  description: 'سوق — منصة مصرية للبيع والشراء والتبرع بالسلع غير المستخدمة.',
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
  is_negotiable: boolean
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
}

type CharityRow = {
  id: string
  name_ar: string
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

const CATEGORY_ICONS: Record<string, string> = {
  electronics: '📱',
  'furniture-home': '🛋️',
  'home-appliances': '🔌',
  fashion: '👕',
  'books-education': '📚',
  'toys-hobbies': '🎮',
  'vehicles-parts': '🚗',
  'tools-equipment': '🔧',
  'collectibles-antiques': '🎨',
  'baby-kids': '🧸',
  'sports-fitness': '⚽',
  other: '📦',
}

const HEADER_CATEGORY_ORDER = [
  'electronics',
  'furniture-home',
  'home-appliances',
  'fashion',
  'books-education',
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

function formatProductPrice(product: ProductRow) {
  if (product.listing_type === 'donation') return 'تبرع'
  if (product.listing_type === 'free') return 'مجاني'

  const price = normalizePrice(product.price)
  if (price === null) return product.is_negotiable ? 'قابل للتفاوض' : 'السعر عند التواصل'

  return (
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(price) +
    ' ' +
    (product.currency || 'EGP')
  )
}

function locationText(product: ProductRow) {
  return [product.city, product.governorate].filter(Boolean).join('، ') || 'مصر'
}

function badgeFor(product: ProductRow) {
  if (product.listing_type === 'donation') {
    return { label: 'تبرع', className: '' }
  }

  if (product.listing_type === 'free') {
    return { label: 'مجاني', className: 'new' }
  }

  if (product.condition_grade === 'new') {
    return { label: 'جديد', className: 'new' }
  }

  return { label: '✓ موثق', className: 'verified' }
}

async function loadHomeData(
  searchValue: string | undefined,
  categoryValue: string | undefined,
  typeValue: string | undefined,
) {
  const supabase = await createClient()
  const searchTerm = cleanSearch(searchValue)

  let categoryId: string | null = null
  if (categoryValue && categoryValue !== 'all') {
    const response = await supabase
      .from('categories')
      .select('id')
      .eq('slug', categoryValue)
      .eq('is_active', true)
      .maybeSingle()

    categoryId = response.data?.id || null
  }

  const requestedType =
    typeValue === 'sale' || typeValue === 'free' || typeValue === 'donation'
      ? typeValue
      : null

  let productQuery = supabase
    .from('products')
    .select(
      'id,owner_id,title,slug,description,listing_type,price,currency,condition_grade,city,governorate,is_negotiable,moderation_status,published_at,created_at,category_id',
    )
    .in('listing_type', requestedType ? [requestedType] : ['sale', 'free', 'donation'])
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(requestedType === 'donation' ? 3 : PRODUCT_LIMIT)

  if (categoryId) productQuery = productQuery.eq('category_id', categoryId)

  if (searchTerm) {
    const pattern = '%' + searchTerm + '%'
    productQuery = productQuery.or(
      'title.ilike.' + pattern + ',description.ilike.' + pattern,
    )
  }

  const [
    categoriesResponse,
    productsResponse,
    productCountResponse,
    activeSellerCountResponse,
    happyBuyerCountResponse,
    completedDonationCountResponse,
    donationListingCountResponse,
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
      .from('products')
      .select('owner_id')
      .eq('status', 'published')
      .eq('moderation_status', 'approved')
      .not('owner_id', 'is', null),
    supabase
      .from('orders')
      .select('buyer_id')
      .in('status', ['completed'])
      .limit(1000),
    supabase
      .from('donations')
      .select('id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'delivered']),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('listing_type', 'donation')
      .eq('status', 'published')
      .eq('moderation_status', 'approved'),
    supabase
      .from('charities')
      .select(
        'id,name_ar,description_ar,logo_url,website_url,city,governorate',
      )
      .eq('verification_status', 'verified')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const categories = (categoriesResponse.data || []) as CategoryRow[]
  const products = (productsResponse.data || []) as ProductRow[]

  const uniqueSellerIds = new Set(
    ((activeSellerCountResponse.data || []) as Pick<ProductRow, 'owner_id'>[])
      .map((item) => item.owner_id)
      .filter(Boolean),
  )

  const uniqueBuyerIds = new Set(
    ((happyBuyerCountResponse.data || []) as { buyer_id: string }[]).map(
      (item) => item.buyer_id,
    ),
  )

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

  const [imagesResponse, profilesResponse, categoryRowsResponse] =
    await Promise.all([
      productIds.length
        ? supabase
            .from('product_images')
            .select(
              'id,product_id,storage_path,alt_text,sort_order,is_primary',
            )
            .in('product_id', productIds)
            .order('is_primary', { ascending: false })
            .order('sort_order', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      ownerIds.length
        ? supabase
            .from('profiles')
            .select('id,display_name,username')
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
    categories,
    products,
    imageByProduct,
    profileById,
    categoryById,
    charities: (charityResponse.data || []) as CharityRow[],
    stats: {
      products: productCountResponse.count || 0,
      sellers: uniqueSellerIds.size,
      buyers: uniqueBuyerIds.size,
      donationCompleted: completedDonationCountResponse.count || 0,
      donationListings: donationListingCountResponse.count || 0,
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

  const categoryMap = new Map(data.categories.map((item) => [item.slug, item]))

  const headerCategories = [
    ...HEADER_CATEGORY_ORDER.map((slug) => categoryMap.get(slug)).filter(
      (item): item is CategoryRow => Boolean(item),
    ),
    ...data.categories.filter(
      (item) => !HEADER_CATEGORY_ORDER.includes(item.slug),
    ),
  ]

  const products = data.products.filter((product) =>
    type === 'donation'
      ? product.listing_type === 'donation'
      : product.listing_type !== 'donation',
  )

  const featuredProducts = products.slice(0, PRODUCT_LIMIT)

  return (
    <div dir="rtl">
      <header className="header">
        <div className="header-top">
          <div className="header-top-content">
            <span>🚚 شحن مجاني للطلبات فوق 500 جنيه</span>
            <span>📞 دعم العملاء: 19999</span>
          </div>
        </div>

        <div className="header-main">
          <Link href="/" className="logo">
            <div className="logo-icon">🛍️</div>
            <span>سوق</span>
          </Link>

          <form action="/" method="get" className="search-bar" role="search">
            <input
              name="q"
              type="search"
              defaultValue={q || ''}
              placeholder="ابحث عن منتجات، بائعين، أو فئات..."
              aria-label="البحث في سوق"
            />
            {category && category !== 'all' && (
              <input type="hidden" name="category" value={category} />
            )}
            {type && <input type="hidden" name="type" value={type} />}
            <button className="search-btn" type="submit" aria-label="بحث">
              🔍
            </button>
          </form>

          <div className="header-actions">
            <Link href="/login" className="header-btn btn-outline">
              تسجيل الدخول
            </Link>
            <Link href="/login" className="header-btn btn-primary">
              ابدأ البيع
            </Link>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-content">
            <Link
              href="/"
              className={'nav-item' + (!category && !type ? ' active' : '')}
            >
              الرئيسية
            </Link>

            {headerCategories.map((item) => (
              <Link
                key={item.id}
                href={'/?category=' + encodeURIComponent(item.slug)}
                className={'nav-item' + (category === item.slug ? ' active' : '')}
              >
                {item.name_ar}
              </Link>
            ))}

            <Link
              href="/?type=donation#donations"
              className={'nav-item' + (type === 'donation' ? ' active' : '')}
            >
              تبرعات
            </Link>

            <Link href="/login" className="nav-item">
              البائعون
            </Link>
          </div>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-content">
          <h1>أكبر Marketplace مصري للتجارة والتبرعات</h1>
          <p>بيع، اشتري، أو تبرع بأغراضك غير المستخدمة في منصة واحدة موثوقة</p>
          <Link
            href="#featured"
            className="header-btn btn-primary"
            style={{ fontSize: '1.1rem', padding: '14px 32px' }}
          >
            ابدأ التسوق الآن
          </Link>

          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-number">
                {data.stats.products.toLocaleString('ar-EG')}+
              </div>
              <div className="stat-label">منتج متاح</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">
                {data.stats.sellers.toLocaleString('ar-EG')}+
              </div>
              <div className="stat-label">بائع نشط</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">
                {data.stats.buyers.toLocaleString('ar-EG')}+
              </div>
              <div className="stat-label">مشتري سعيد</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">
                {data.stats.donationCompleted.toLocaleString('ar-EG')}+
              </div>
              <div className="stat-label">تبرع مكتمل</div>
            </div>
          </div>
        </div>
      </section>

      <section className="categories" id="categories">
        <div className="section-header">
          <h2 className="section-title">تصفح الفئات</h2>
          <a href="#featured" className="section-link">
            عرض الكل ←
          </a>
        </div>

        <div className="categories-grid">
          {data.categories.map((category) => (
            <Link
              key={category.id}
              href={
                '/?category=' + encodeURIComponent(category.slug) + '#featured'
              }
              className="category-card"
            >
              <div className="category-icon">
                {CATEGORY_ICONS[category.slug] || '📦'}
              </div>
              <div className="category-name">{category.name_ar}</div>
            </Link>
          ))}

          <Link
            href="/?type=donation#donations"
            className="category-card"
          >
            <div className="category-icon">🎁</div>
            <div className="category-name">تبرعات</div>
          </Link>
        </div>
      </section>

      <section className="products" id="featured">
        <div className="section-header">
          <h2 className="section-title">منتجات مميزة</h2>
          <Link href="/?type=sale#featured" className="section-link">
            عرض المزيد ←
          </Link>
        </div>

        <div className="products-grid">
          {featuredProducts.length ? (
            featuredProducts.map((product) => {
              const image = data.imageByProduct.get(product.id)
              const seller = product.owner_id
                ? data.profileById.get(product.owner_id)
                : null
              const sellerName =
                seller?.display_name || seller?.username || 'بائع DEBA'
              const itemBadge = badgeFor(product)

              return (
                <Link
                  key={product.id}
                  href={'/products/' + encodeURIComponent(product.slug)}
                  className="product-card"
                >
                  <div className="product-image">
                    {image?.storage_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getImageUrl(image.storage_path) || ''}
                        alt={image.alt_text?.trim() || product.title}
                        loading="lazy"
                      />
                    ) : null}

                    <span className={'product-badge ' + itemBadge.className}>
                      {itemBadge.label}
                    </span>
                  </div>

                  <div className="product-info">
                    <h3 className="product-title">{product.title}</h3>

                    <div className="product-meta">
                      <span className="product-condition">
                        {(product.condition_grade &&
                          CONDITION_LABELS[product.condition_grade]) ||
                          'حالة غير محددة'}
                      </span>
                      <span>📍 {locationText(product)}</span>
                    </div>

                    <div className="product-price">
                      {formatProductPrice(product)}
                    </div>

                    <div className="product-seller">
                      <div className="seller-avatar">
                        {sellerName.trim().charAt(0) || 'س'}
                      </div>
                      <span>{sellerName}</span>
                      <span className="trust-badge">✓ موثق</span>
                    </div>
                  </div>
                </Link>
              )
            })
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 36 }}>
              <h3>لا توجد منتجات منشورة حاليًا</h3>
              <p>ستظهر المنتجات هنا تلقائيًا بعد النشر والمراجعة.</p>
            </div>
          )}
        </div>
      </section>

      <section className="donation-section" id="donations">
        <div className="donation-content">
          <div className="donation-info">
            <h2>تبرع بأغراضك لمن يحتاجها</h2>
            <p>
              ساهم في إعادة تدوير القيمة الاجتماعية والاقتصادية للأغراض غير المستخدمة.
              تبرعك يصل مباشرة لجمعيات موثقة.
            </p>
            <Link
              href="/login"
              className="header-btn"
              style={{
                background: 'white',
                color: 'var(--accent)',
                fontSize: '1.1rem',
                padding: '14px 32px',
              }}
            >
              تبرع الآن
            </Link>

            <div className="donation-stats">
              <div className="donation-stat">
                <div className="donation-stat-number">
                  {data.stats.donationCompleted.toLocaleString('ar-EG')}+
                </div>
                <div className="donation-stat-label">تبرع مكتمل</div>
              </div>
              <div className="donation-stat">
                <div className="donation-stat-number">
                  {data.charities.length.toLocaleString('ar-EG')}+
                </div>
                <div className="donation-stat-label">جمعية موثقة</div>
              </div>
              <div className="donation-stat">
                <div className="donation-stat-number">
                  {data.stats.sellers.toLocaleString('ar-EG')}+
                </div>
                <div className="donation-stat-label">مستفيد</div>
              </div>
            </div>
          </div>

          <div className="donation-visual">
            {data.charities.length ? (
              data.charities.map((charity, index) => {
                const icon = ['🏥', '📚', '🍽️'][index] || '🎁'
                const description =
                  charity.description_ar ||
                  [charity.city, charity.governorate]
                    .filter(Boolean)
                    .join('، ') ||
                  'جمعية موثقة على سوق'

                const content = (
                  <>
                    <div className="charity-logo">
                      {charity.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={charity.logo_url}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 12,
                          }}
                        />
                      ) : (
                        icon
                      )}
                    </div>
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
                    {content}
                  </a>
                ) : (
                  <div key={charity.id} className="charity-card">
                    {content}
                  </div>
                )
              })
            ) : (
              <>
                <div className="charity-card">
                  <div className="charity-logo">🏥</div>
                  <div className="charity-info">
                    <h4>لا توجد جمعية موثقة بعد</h4>
                    <p>سيظهر هذا القسم تلقائيًا عند إضافة جمعية موثقة.</p>
                  </div>
                </div>
                <div className="charity-card">
                  <div className="charity-logo">📚</div>
                  <div className="charity-info">
                    <h4>الجمعيات الموثقة</h4>
                    <p>بيانات الجمعيات تُعرض من قاعدة بيانات سوق مباشرة.</p>
                  </div>
                </div>
                <div className="charity-card">
                  <div className="charity-logo">🍽️</div>
                  <div className="charity-info">
                    <h4>شراكات المجتمع</h4>
                    <p>المحتوى الحقيقي سيظهر هنا بعد اعتماد الجهات.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="trust-section">
        <div className="section-header">
          <h2 className="section-title">لماذا سوق؟</h2>
        </div>

        <div className="trust-grid">
          <div className="trust-card">
            <div className="trust-icon">🛡️</div>
            <h3>طبقة الثقة</h3>
            <p>نظام تحقق متعدد المستويات للبائعين والمشترين مع تقييمات حقيقية</p>
          </div>

          <div className="trust-card">
            <div className="trust-icon">🔍</div>
            <h3>معاينة المنتجات</h3>
            <p>خدمة فحص احترافية للمنتجات عالية القيمة قبل الشراء</p>
          </div>

          <div className="trust-card">
            <div className="trust-icon">🚚</div>
            <h3>شحن موثوق</h3>
            <p>شراكة مع شركات شحن معتمدة مع تتبع مباشر للطلبات</p>
          </div>

          <div className="trust-card">
            <div className="trust-icon">💳</div>
            <h3>دفع آمن</h3>
            <p>تكامل مع بوابات دفع مرخصة من البنك المركزي المصري</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>عن سوق</h4>
            <ul>
              <li><Link href="/">من نحن</Link></li>
              <li><Link href="#trust">كيف نعمل</Link></li>
              <li><Link href="/login">الوظائف</Link></li>
              <li><Link href="/login">الصحافة</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>للبائعين</h4>
            <ul>
              <li><Link href="/login">ابدأ البيع</Link></li>
              <li><Link href="/login">مركز البائعين</Link></li>
              <li><Link href="/login">الاشتراكات</Link></li>
              <li><Link href="/login">الإعلانات المميزة</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>للمشترين</h4>
            <ul>
              <li><Link href="#featured">كيف تشتري</Link></li>
              <li><Link href="#trust">حماية المشتري</Link></li>
              <li><Link href="/login">الإرجاع والاسترداد</Link></li>
              <li><Link href="/login">الأسئلة الشائعة</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>التبرعات</h4>
            <ul>
              <li><Link href="#donations">تبرع بأغراض</Link></li>
              <li><Link href="#donations">الجمعيات الموثقة</Link></li>
              <li><Link href="#donations">تتبع تبرعك</Link></li>
              <li><Link href="#trust">شراكات CSR</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>قانوني</h4>
            <ul>
              <li><Link href="/login">شروط الاستخدام</Link></li>
              <li><Link href="/login">سياسة الخصوصية</Link></li>
              <li><Link href="#donations">سياسة التبرعات</Link></li>
              <li><Link href="/login">المنتجات الممنوعة</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>تواصل معنا</h4>
            <ul>
              <li><a href="tel:19999">📞 19999</a></li>
              <li><a href="mailto:support@souq.eg">📧 support@souq.eg</a></li>
              <li><Link href="/login">💬 واتساب</Link></li>
              <li><span>📍 القاهرة، مصر</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 سوق. جميع الحقوق محفوظة. | مرخص من الجهات المصرية المختصة</p>
        </div>
      </footer>
    </div>
  )
}
