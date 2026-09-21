import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound,
} from 'lucide-react'
import { notFound } from 'next/navigation'
import Header, { type HeaderCategory } from '@/components/Header'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'
import FavoriteButton from '@/components/FavoriteButton'
import ProductGallery, { type ProductGalleryImage } from '@/components/ProductGallery'
import ProductDetailTabs, { type ProductAttributeDefinition } from '@/components/ProductDetailTabs'
import { createClient } from '@/utils/supabase/server'

const BUCKET = 'deba-product-media'

type RouteParams = {
  params: Promise<{ slug: string }>
}

type Category = {
  id: string
  name_ar: string
  name_en: string | null
  slug: string
}

type ImageRow = {
  id: string
  storage_path: string
  alt_text: string | null
  sort_order: number
  is_primary: boolean
}

type ProductMetadata = Record<string, unknown>

type ProductRow = {
  id: string
  owner_id: string | null
  title: string
  slug: string
  description: string | null
  listing_type: 'sale'
  status: string
  moderation_status: string
  condition_grade: string | null
  condition_details: string | null
  price: number | string | null
  currency: string
  quantity: number
  city: string | null
  governorate: string | null
  district: string | null
  delivery_method: string
  metadata: ProductMetadata | null
  details_schema_version: number
  details_last_completed_at: string | null
  published_at: string | null
  created_at: string
  category: Category | null
  images: ImageRow[] | null
  seller:
    | {
        display_name: string | null
        username: string | null
        avatar_url: string | null
        bio: string | null
        city: string | null
        governorate: string | null
        is_public: boolean
        account_type: 'buyer' | 'seller'
      }
    | null
}

const SELECT =
  'id,owner_id,title,slug,description,listing_type,status,moderation_status,condition_grade,condition_details,price,currency,quantity,city,governorate,district,delivery_method,metadata,details_schema_version,details_last_completed_at,published_at,created_at,category:categories!products_category_id_fkey(id,name_ar,name_en,slug),images:product_images!product_images_product_id_fkey(id,storage_path,alt_text,sort_order,is_primary)'

const CONDITION_LABELS: Record<string, string> = {
  new: 'جديد',
  like_new: 'مستعمل - كالجديد',
  excellent: 'مستعمل - ممتاز',
  good: 'مستعمل - جيد',
  fair: 'مستعمل - مقبول',
  poor: 'مستعمل - يحتاج عناية',
  for_parts: 'للقطع / الإصلاح',
}

const DELIVERY_LABELS: Record<string, string> = {
  pickup: 'استلام من البائع',
  seller_delivery: 'توصيل عبر البائع',
  platform_delivery: 'توصيل عبر DEBA',
  both: 'استلام أو توصيل',
}

function normalizePrice(value: number | string | null) {
  if (value === null) return null
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) return 'السعر عند التواصل'
  return (
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value) +
    ' ' +
    currency
  )
}

function getImageUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string | null,
) {
  if (!storagePath) return null
  if (/^https?:\/\//i.test(storagePath)) return storagePath
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

function mapCategory(row: Category): HeaderCategory {
  return {
    id: row.id,
    nameAr: row.name_ar,
    slug: row.slug,
  }
}

function mapCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: ProductRow,
): ProductCardItem {
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
    conditionGrade: row.condition_grade,
    city: row.city,
    governorate: row.governorate,
    categoryName: row.category?.name_ar || row.category?.name_en || null,
    imageUrl: getImageUrl(supabase, image?.storage_path || null),
    imageAlt: image?.alt_text?.trim() || row.title,
  }
}

async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { data } = await supabase.auth.getClaims()
    return data?.claims && typeof data.claims.sub === 'string'
      ? data.claims.sub
      : null
  } catch {
    return null
  }
}

function formatPublishedDate(value: string | null) {
  if (!value) return 'تاريخ النشر غير متاح'
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

async function getProduct(slug: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select(SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .eq('listing_type', 'sale')
    .maybeSingle()

  if (error) {
    console.error('DEBA product detail query failed', error)
    throw new Error('تعذر تحميل بيانات السلعة من Supabase.')
  }

  if (!data) return null

  const product = data as unknown as ProductRow

  const [
    sellerResponse,
    userId,
    categoriesResponse,
    attributeDefinitionsResponse,
    relatedResponse,
  ] = await Promise.all([
      product.owner_id
        ? supabase
            .from('profiles')
            .select(
              'display_name,username,avatar_url,bio,city,governorate,is_public,account_type',
            )
            .eq('id', product.owner_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      getUserId(supabase),
      supabase
        .from('categories')
        .select('id,name_ar,name_en,slug')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      product.category?.id
        ? supabase
            .from('category_attribute_definitions')
            .select('key,label_ar,label_en,data_type,unit,is_required,help_text_ar,sort_order')
            .eq('category_id', product.category.id)
            .eq('is_required', true)
            .order('sort_order', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      product.category?.id
        ? supabase
            .from('products')
            .select(SELECT)
            .eq('category_id', product.category.id)
            .neq('id', product.id)
            .eq('status', 'published')
            .eq('moderation_status', 'approved')
            .eq('listing_type', 'sale')
            .order('published_at', { ascending: false, nullsFirst: false })
            .limit(4)
        : Promise.resolve({ data: [], error: null }),
    ])

  if (sellerResponse.error) {
    console.error('DEBA seller query failed', sellerResponse.error)
  }
  product.seller = sellerResponse.data || null

  let isFavorite = false
  let favoriteCount = 0

  if (userId) {
    const [favorite, favoritesCountResult] = await Promise.all([
      supabase
        .from('favorites')
        .select('id')
        .eq('product_id', product.id)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

    isFavorite = Boolean(favorite.data)
    favoriteCount = favoritesCountResult.count || 0
  }

  const related = ((relatedResponse.data || []) as unknown as ProductRow[]).map(
    (row) => mapCard(supabase, row),
  )

  return {
    supabase,
    product,
    userId,
    isFavorite,
    favoriteCount,
    negotiationCount: 0,
    categories: ((categoriesResponse.data || []) as Category[]).map(mapCategory),
    definitions: ((attributeDefinitionsResponse.data || []) as unknown as ProductAttributeDefinition[]),
    related,
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('title,description')
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .eq('listing_type', 'sale')
    .maybeSingle()

  if (!data) {
    return { title: 'السلعة غير موجودة — DEBA' }
  }

  const description =
    data.description || 'تفاصيل المنتج والسعر والتنسيق على الاستلام عبر DEBA.'

  return {
    title: data.title + ' — DEBA',
    description,
    openGraph: {
      title: data.title + ' — DEBA',
      description,
    },
  }
}

export default async function ProductDetailPage({
  params,
}: RouteParams) {
  const { slug } = await params
  const data = await getProduct(slug)

  if (!data) notFound()

  const { product } = data
  const images: ProductGalleryImage[] = [...(product.images || [])]
    .sort(
      (left, right) =>
        Number(right.is_primary) - Number(left.is_primary) ||
        left.sort_order - right.sort_order,
    )
    .map((image) => ({
      id: image.id,
      url: getImageUrl(data.supabase, image.storage_path) || '',
      alt: image.alt_text?.trim() || product.title,
    }))
    .filter((image) => image.url)

  const price = normalizePrice(product.price)
  const sellerName =
    product.seller?.display_name ||
    product.seller?.username ||
    'عضو في مجتمع DEBA'
  const sellerLocation = [product.seller?.city, product.seller?.governorate]
    .filter(Boolean)
    .join('، ')
  const location = [product.city, product.governorate, product.district]
    .filter(Boolean)
    .join('، ')
  const condition =
    product.condition_grade
      ? CONDITION_LABELS[product.condition_grade] || 'حالة موثقة'
      : 'حالة غير محددة'
  const isOwner = Boolean(product.owner_id && data.userId === product.owner_id)
  const canBuy = price !== null && price > 0 && product.quantity > 0
  const purchaseHref = '/products/' + encodeURIComponent(product.slug) + '/checkout'

  return (
    <>
      <Header
        categories={data.categories}
        favoriteCount={data.favoriteCount}
        negotiationCount={data.negotiationCount}
      />

      <main className="deba-detail-page" dir="rtl">
        <div className="deba-breadcrumbs">
          <Link href="/">الرئيسية</Link>
          <span>/</span>
          {product.category ? (
            <Link href={'/?category=' + encodeURIComponent(product.category.slug)}>
              {product.category.name_ar}
            </Link>
          ) : (
            <span>المنتجات</span>
          )}
          <span>/</span>
          <strong>{product.title}</strong>
        </div>

        <div className="deba-detail-layout">
          <div className="deba-detail-media-column">
            <ProductGallery images={images} productTitle={product.title} />

            <section className="deba-detail-trust-grid">
              <div>
                <ShieldCheck size={20} />
                <strong>إعلان مُراجع</strong>
                <span>الإعلان اجتاز حالة المراجعة المطلوبة للظهور العام.</span>
              </div>
              <div>
                <BadgeCheck size={20} />
                <strong>سعر ثابت</strong>
                <span>السعر المعلن ثابت ويمكنك إتمام الطلب مباشرة.</span>
              </div>
              <div>
                <Truck size={20} />
                <strong>الاستلام واضح</strong>
                <span>{DELIVERY_LABELS[product.delivery_method] || product.delivery_method}</span>
              </div>
            </section>
          </div>

          <div className="deba-detail-info">
            <div className="deba-detail-topline">
              <div className="deba-detail-badges">
                <span className="deba-detail-badge">
                  <BadgeCheck size={14} />
                  {condition}
                </span>
                <span className="deba-detail-badge is-muted">
                  <CheckCircle2 size={14} />
                  سعر ثابت
                </span>
              </div>

              <FavoriteButton
                productId={product.id}
                initialFavorite={data.isFavorite}
                label="إضافة المنتج إلى المفضلة"
                className="deba-detail-favorite"
                size={20}
              />
            </div>

            <h1>{product.title}</h1>

            <div className="deba-detail-price-row">
              <div>
                <span>السعر</span>
                <strong>{formatMoney(price, product.currency)}</strong>
              </div>
              <span className="deba-detail-negotiable is-fixed-price">
                <CheckCircle2 size={15} />
                سعر ثابت
              </span>
            </div>

            <div className="deba-detail-location">
              <MapPin size={16} />
              <span>{location || 'الموقع يُحدد مع البائع'}</span>
            </div>

            <section className="deba-primary-purchase-zone">
              {isOwner ? (
                <div className="deba-owner-notice">
                  <UserRound size={18} />
                  <div>
                    <strong>هذا إعلانك</strong>
                    <span>يمكنك إدارة إعلانك، لكن لا يمكنك شراء سلعتك الخاصة.</span>
                  </div>
                </div>
              ) : canBuy ? (
                <Link href={purchaseHref} className="deba-purchase-primary">
                  <span className="deba-purchase-primary-icon">
                    <ShoppingBag size={21} />
                  </span>
                  <span>
                    <strong>اشترِ الآن</strong>
                    <small>السعر ثابت — اختر الكمية وطريقة الاستلام ثم أكد طلبك</small>
                  </span>
                  <ArrowLeft size={20} />
                </Link>
              ) : (
                <div className="deba-owner-notice is-muted">
                  <Package size={18} />
                  <div>
                    <strong>المنتج غير متاح للشراء حاليًا</strong>
                    <span>تحقق من توفر الكمية والسعر ثم حاول مرة أخرى.</span>
                  </div>
                </div>
              )}
            </section>

            <section className="deba-detail-section">
              <div className="deba-detail-section-title">عن السلعة</div>
              <p>
                {product.description ||
                  'لم يضف صاحب الإعلان وصفًا تفصيليًا بعد.'}
              </p>
              {product.condition_details && (
                <div className="deba-condition-note">
                  <CheckCircle2 size={16} />
                  <span>{product.condition_details}</span>
                </div>
              )}
            </section>

            <section className="deba-spec-card deba-spec-card-expanded">
              <div>
                <span>الحالة</span>
                <strong>{condition}</strong>
              </div>
              <div>
                <span>القسم</span>
                <strong>{product.category?.name_ar || 'غير محدد'}</strong>
              </div>
              <div>
                <span>الكمية المتاحة</span>
                <strong>{product.quantity.toLocaleString('ar-EG')}</strong>
              </div>
              <div>
                <span>الاستلام</span>
                <strong>{DELIVERY_LABELS[product.delivery_method] || product.delivery_method}</strong>
              </div>
              <div>
                <span>الموقع</span>
                <strong>{location || 'يُحدد مع البائع'}</strong>
              </div>
              <div>
                <span>تاريخ النشر</span>
                <strong>{formatPublishedDate(product.published_at || product.created_at)}</strong>
              </div>
            </section>


            <section className="deba-seller-card">
              <div className="deba-seller-avatar">
                {product.seller?.avatar_url ? (
                  <Image
                    src={product.seller.avatar_url}
                    alt={sellerName}
                    fill
                    sizes="56px"
                  />
                ) : (
                  (sellerName[0] || 'D').toUpperCase()
                )}
              </div>
              <div className="deba-seller-copy">
                <span>البائع</span>
                <strong>{sellerName}</strong>
                {sellerLocation && (
                  <small>
                    <MapPin size={12} /> {sellerLocation}
                  </small>
                )}
                {product.seller?.bio && <p>{product.seller.bio}</p>}
              </div>
              <div className="deba-seller-verified">
                <ShieldCheck size={17} />
                <span>حساب داخل DEBA</span>
              </div>
            </section>



            <div className="deba-detail-security">
              <ShieldCheck size={17} />
              <span>
                السعر الظاهر هو السعر الثابت للمنتج. طلب الشراء يُسجل داخل DEBA،
                والدفع الإلكتروني غير مفعل في النسخة الحالية.
              </span>
            </div>
          </div>
        </div>

        <ProductDetailTabs
          metadata={product.metadata}
          description={product.description}
          conditionDetails={product.condition_details}
          conditionLabel={condition}
          categoryName={product.category?.name_ar || product.category?.name_en || 'غير محدد'}
          location={location || 'يُحدد مع البائع'}
          deliveryLabel={DELIVERY_LABELS[product.delivery_method] || product.delivery_method}
          quantity={product.quantity}
          publishedDate={formatPublishedDate(product.published_at || product.created_at)}
          detailsSchemaVersion={product.details_schema_version}
          detailsLastCompletedAt={product.details_last_completed_at}
          definitions={data.definitions}
        />

        <section className="deba-purchase-steps">
          <div>
            <span>1</span>
            <strong>راجع التفاصيل</strong>
            <small>السعر والحالة والموقع والبيانات الإضافية.</small>
          </div>
          <div>
            <span>2</span>
            <strong>اختر الكمية والاستلام</strong>
            <small>حدد الكمية وطريقة الاستلام وأدخل البيانات المطلوبة.</small>
          </div>
          <div>
            <span>3</span>
            <strong>أكد طلب الشراء</strong>
            <small>يسجل الطلب بالسعر الثابت ويظهر لك رقم الطلب.</small>
          </div>
        </section>

        {data.related.length > 0 && (
          <section className="deba-related-section">
            <div className="deba-related-head">
              <div>
                <span>MORE FROM DEBA</span>
                <h2>منتجات مشابهة تستحق الاكتشاف</h2>
              </div>
              {product.category && (
                <Link href={'/?category=' + encodeURIComponent(product.category.slug)}>
                  تصفح الفئة
                  <ArrowRight size={15} />
                </Link>
              )}
            </div>

            <div className="deba-product-grid deba-related-grid">
              {data.related.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        <Link href="/" className="deba-detail-back">
          <ArrowRight size={16} />
          العودة إلى السوق
        </Link>
      </main>
    </>
  )
}
