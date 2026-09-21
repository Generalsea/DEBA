import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Package,
  Repeat2,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound,
} from 'lucide-react'
import { notFound } from 'next/navigation'
import Header, { type HeaderCategory } from '@/components/Header'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'
import FavoriteButton from '@/components/FavoriteButton'
import OfferForm from '@/components/OfferForm'
import ProductGallery, { type ProductGalleryImage } from '@/components/ProductGallery'
import { createClient } from '@/utils/supabase/server'

const BUCKET = 'deba-product-media'

type RouteParams = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ action?: string | string[] | undefined }>
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
  listing_type: 'sale' | 'free'
  status: string
  moderation_status: string
  condition_grade: string | null
  condition_details: string | null
  price: number | string | null
  currency: string
  is_negotiable: boolean
  minimum_offer_amount: number | string | null
  quantity: number
  city: string | null
  governorate: string | null
  district: string | null
  delivery_method: string
  metadata: ProductMetadata | null
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
      }
    | null
}

const SELECT =
  'id,owner_id,title,slug,description,listing_type,status,moderation_status,condition_grade,condition_details,price,currency,is_negotiable,minimum_offer_amount,quantity,city,governorate,district,delivery_method,metadata,published_at,created_at,category:categories!products_category_id_fkey(id,name_ar,name_en,slug),images:product_images!product_images_product_id_fkey(id,storage_path,alt_text,sort_order,is_primary)'

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

const METADATA_LABELS: Record<string, string> = {
  model: 'الموديل',
  storage_capacity: 'السعة التخزينية',
  color: 'اللون',
  battery_health: 'صحة البطارية',
  usage_duration: 'مدة الاستخدام',
  accessories: 'الملحقات',
  invoice: 'الفاتورة',
  box: 'الكرتونة',
  repair_status: 'حالة الإصلاح',
  face_id: 'Face ID',
  inspection_location_note: 'المعاينة',
  dimensions: 'الأبعاد',
  material: 'الخامة',
  brand: 'العلامة التجارية',
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
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
    isNegotiable: row.is_negotiable,
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

function stringifyMetadataValue(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا'
  if (typeof value === 'number') {
    return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value)
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyMetadataValue(item))
      .filter(Boolean)
      .join('، ')
  }
  if (typeof value === 'object') return null
  const text = String(value).trim()
  return text || null
}

function publicMetadata(metadata: ProductMetadata | null) {
  if (!metadata) return []
  return Object.entries(metadata)
    .map(([key, value]) => ({
      key,
      label: METADATA_LABELS[key],
      value: stringifyMetadataValue(value),
    }))
    .filter(
      (item): item is { key: string; label: string; value: string } =>
        Boolean(item.label && item.value),
    )
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
    .in('listing_type', ['sale', 'free'])
    .maybeSingle()

  if (error) {
    console.error('DEBA product detail query failed', error)
    throw new Error('تعذر تحميل بيانات السلعة من Supabase.')
  }

  if (!data) return null

  const product = data as unknown as ProductRow

  const [sellerResponse, userId, categoriesResponse, relatedResponse] =
    await Promise.all([
      product.owner_id
        ? supabase
            .from('profiles')
            .select(
              'display_name,username,avatar_url,bio,city,governorate,is_public',
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
            .from('products')
            .select(SELECT)
            .eq('category_id', product.category.id)
            .neq('id', product.id)
            .eq('status', 'published')
            .eq('moderation_status', 'approved')
            .in('listing_type', ['sale', 'free'])
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
  let negotiationCount = 0

  if (userId) {
    const [favorite, favoritesCountResult, offersCountResult] = await Promise.all([
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
      supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_id', userId)
        .in('status', ['pending', 'countered']),
    ])

    isFavorite = Boolean(favorite.data)
    favoriteCount = favoritesCountResult.count || 0
    negotiationCount = offersCountResult.count || 0
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
    negotiationCount,
    categories: ((categoriesResponse.data || []) as Category[]).map(mapCategory),
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
    .in('listing_type', ['sale', 'free'])
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
  searchParams,
}: RouteParams) {
  const { slug } = await params
  const action = firstParam((await searchParams)?.action)
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

  const isFree = product.listing_type === 'free'
  const price = normalizePrice(product.price)
  const minimumOfferAmount = normalizePrice(product.minimum_offer_amount)
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
  const details = publicMetadata(product.metadata)
  const isOwner = Boolean(product.owner_id && data.userId === product.owner_id)
  const canBuy = isFree || price !== null
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
                <Repeat2 size={20} />
                <strong>التفاوض محفوظ</strong>
                <span>العروض والرسائل مرتبطة بحسابك داخل DEBA.</span>
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
                {product.is_negotiable && !isFree && (
                  <span className="deba-detail-badge is-muted">
                    <Repeat2 size={14} />
                    قابل للتفاوض
                  </span>
                )}
                {isFree && (
                  <span className="deba-detail-badge is-green">
                    <Package size={14} />
                    متاح مجانًا
                  </span>
                )}
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
                <span>{isFree ? 'القيمة' : 'السعر المعلن'}</span>
                <strong>
                  {isFree ? 'مجاني' : formatMoney(price, product.currency)}
                </strong>
              </div>
              {product.is_negotiable && !isFree && (
                <span className="deba-detail-negotiable">
                  <Repeat2 size={15} />
                  التفاوض متاح
                </span>
              )}
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
                    <span>لا يمكنك شراء منتج من إعلانك أو إرسال عرض عليه.</span>
                  </div>
                </div>
              ) : canBuy ? (
                <Link href={purchaseHref} className="deba-purchase-primary">
                  <span className="deba-purchase-primary-icon">
                    <ShoppingBag size={21} />
                  </span>
                  <span>
                    <strong>{isFree ? 'طلب المنتج مجانًا' : 'إتمام الشراء'}</strong>
                    <small>أكمل بيانات الاستلام وسجّل طلبك داخل DEBA</small>
                  </span>
                  <ArrowLeft size={20} />
                </Link>
              ) : (
                <div className="deba-owner-notice is-muted">
                  <Package size={18} />
                  <div>
                    <strong>السعر غير محدد</strong>
                    <span>استخدم نموذج التفاوض أدناه للتواصل على السعر.</span>
                  </div>
                </div>
              )}

              {!isOwner && product.is_negotiable && !isFree && (
                <a
                  href="#deba-offer-form"
                  className="deba-purchase-secondary"
                  onClick={(event) => {
                    event.preventDefault()
                    document
                      .getElementById('deba-offer-form')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                >
                  <Repeat2 size={18} />
                  تفاوض على السعر بدلًا من الشراء بالسعر المعلن
                </a>
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

            {details.length > 0 && (
              <section className="deba-metadata-section">
                <div className="deba-detail-section-title">تفاصيل المنتج</div>
                <div className="deba-metadata-grid">
                  {details.map((item) => (
                    <div key={item.key}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

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

            {product.listing_type === 'sale' && product.is_negotiable && !isOwner && (
              <OfferForm
                productId={product.id}
                ownerId={product.owner_id}
                listingType="sale"
                currency={product.currency || 'EGP'}
                price={price}
                minimumOfferAmount={minimumOfferAmount}
                productTitle={product.title}
                autoFocus={action === 'offer'}
              />
            )}

            <div className="deba-detail-security">
              <ShieldCheck size={17} />
              <span>
                لا يتم تنفيذ خصم إلكتروني من هذه الصفحة. طلب الشراء يُسجل داخل
                DEBA، ثم يتابع المشتري والبائع خطوات الاستلام والاتفاق.
              </span>
            </div>
          </div>
        </div>

        <section className="deba-purchase-steps">
          <div>
            <span>1</span>
            <strong>راجع التفاصيل</strong>
            <small>السعر والحالة والموقع والبيانات الإضافية.</small>
          </div>
          <div>
            <span>2</span>
            <strong>أتمم الطلب</strong>
            <small>اختر طريقة الاستلام وأدخل بياناتك.</small>
          </div>
          <div>
            <span>3</span>
            <strong>تابع داخل DEBA</strong>
            <small>حالة الطلب والتواصل لا تخرج عن حسابك.</small>
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
