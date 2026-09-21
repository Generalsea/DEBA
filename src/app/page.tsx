import type { Metadata } from 'next'
import Link from 'next/link'
import HomeAuthActions from '@/components/HomeAuthActions'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'DEBA | Marketplace المصري - بيع وشراء المنتجات',
  description: 'DEBA — Marketplace مصري حديث لبيع وشراء المنتجات داخل تجربة موثوقة وشفافة.',
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

const CATEGORY_PRESENTATION: { slug: string; icon: string; label: string }[] = [
  { slug: 'electronics', icon: '📱', label: 'إلكترونيات' },
  { slug: 'furniture-home', icon: '🛋️', label: 'أثاث' },
  { slug: 'home-appliances', icon: '🔌', label: 'أجهزة منزلية' },
  { slug: 'fashion', icon: '👕', label: 'ملابس' },
  { slug: 'books-education', icon: '📚', label: 'كتب' },
  { slug: 'tools-equipment', icon: '🔧', label: 'أدوات' },
  { slug: 'collectibles-antiques', icon: '🎨', label: 'تحف' },
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
    .eq('listing_type', 'sale')
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
    sellerCountResponse,
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

  return {
    categories,
    products,
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
  }>
}) {
  const params = await searchParams
  const q = firstParam(params.q)
  const category = firstParam(params.category)
  const data = await loadHomeData(q, category)

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
      <header className="header">
        <div className="header-top">
          <div className="header-top-content">
            <span>🚚 الاستلام وخيارات التوصيل موضحة داخل كل إعلان</span>
            <span>💬 تجربة شراء وبيع موثوقة من داخل حساب DEBA</span>
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

          <HomeAuthActions />
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
                {item.label}
              </Link>
            ))}

            <Link href="#featured" className="nav-item">البائعون</Link>
          </div>
        </nav>
      </header>

      <section className="hero fade-in">
        <div className="hero-content">
          <span className="section-eyebrow">DEBA MARKETPLACE</span>
          <h1>Marketplace مصري لبيع وشراء المنتجات</h1>
          <p>اكتشف منتجاتك القادمة، بع ما تملك، واشترِ بثقة عبر تجربة DEBA الحديثة</p>
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
              <div className="category-icon">{item.icon}</div>
              <div className="category-name">{item.label}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="products" id="featured">
        <div className="section-header">
          <h2 className="section-title">منتجات مميزة</h2>
          <Link href="/?type=sale#featured" className="section-link">عرض المزيد ←</Link>
        </div>

        {data.products.length ? (
          <div className="products-grid">
            {data.products.slice(0, PRODUCT_LIMIT).map((product) => {
              const image = data.imageByProduct.get(product.id)
              const seller = product.owner_id ? data.profileById.get(product.owner_id) : null
              const sellerName = seller?.display_name || seller?.username || 'عضو DEBA'
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
                  style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
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
                      <span className="product-condition">{condition}</span>
                      <span>📍 {locationText(product)}</span>
                    </div>
                    <div className="product-price">{formatPrice(product)}</div>
                    <div className="product-seller">
                      <div className="seller-avatar">
                        {seller?.avatar_url && /^https?:\/\//i.test(seller.avatar_url) ? (
                          <img src={seller.avatar_url} alt="" />
                        ) : (
                          sellerInitial
                        )}
                      </div>
                      <span>{sellerName}</span>
                      <span className="trust-badge">✓ DEBA</span>
                    </div>
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
            <Link href="/sell" className="header-btn btn-primary" style={{ marginTop: 16 }}>
              أضف أول إعلان
            </Link>
          </div>
        )}
      </section>

      <section className="donation-section" id="community">
        <div className="donation-content">
          <div className="donation-info">
            <span className="section-eyebrow" style={{ color: 'white' }}>DEBA COMMUNITY</span>
            <h2>سوق واحد. قيمة أكبر.</h2>
            <p>
              في DEBA تتحول المنتجات غير المستخدمة إلى فرص جديدة. اكتشف منتجات موثقة التفاصيل،
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

          <div className="donation-visual">
            <div className="charity-card">
              <div className="charity-logo">🛍️</div>
              <div className="charity-info">
                <h4>اكتشف منتجات تستحقها</h4>
                <p>تفاصيل واضحة، أسعار محددة، وتجربة شراء مصممة لتكون بسيطة واحترافية.</p>
              </div>
            </div>
            <div className="charity-card">
              <div className="charity-logo">🏷️</div>
              <div className="charity-info">
                <h4>حوّل ما لا تحتاجه إلى قيمة</h4>
                <p>أضف إعلانك، قدّم بيانات دقيقة، ووصل إلى مجتمع DEBA المهتم بما تعرضه.</p>
              </div>
            </div>
            <div className="charity-card">
              <div className="charity-logo">🛡️</div>
              <div className="charity-info">
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
            <div className="trust-icon">🛡️</div>
            <h3>إعلانات معتمدة</h3>
            <p>المنتجات الظاهرة في السوق العام تظهر بعد النشر والمراجعة.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon">🧭</div>
            <h3>تجربة موحدة</h3>
            <p>تصفح، اشترِ، أو أضف إعلانك من تجربة واحدة مصممة للسوق المصري.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon">📦</div>
            <h3>بيانات المنتج واضحة</h3>
            <p>السعر والحالة والموقع والصور المعروضة تأتي من الإعلان نفسه.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon">📈</div>
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
