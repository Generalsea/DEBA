import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Heart,
  MapPin,
  MessageCircle,
  PackageCheck,
  Repeat2,
  ShieldCheck,
} from 'lucide-react'
import Header from '@/components/Header'
import { createClient } from '@/utils/supabase/server'

const BUCKET = 'deba-product-media'

type ProductPageProps = {
  params: Promise<{
    slug: string
  }>
}

type ProductImage = {
  id: string
  storage_path: string
  alt_text: string | null
  sort_order: number
  is_primary: boolean
}

type ProductDetails = {
  id: string
  owner_id: string | null
  category_id: string | null
  title: string
  slug: string
  description: string | null
  listing_type: 'sale' | 'donation' | 'free'
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
  created_at: string
  category:
    | {
        id: string
        name_ar: string
        name_en: string | null
        slug: string
      }
    | null
  images: ProductImage[] | null
}

type SellerProfile = {
  display_name: string | null
  username: string | null
  avatar_url: string | null
  city: string | null
  governorate: string | null
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params

  return {
    title: 'DEBA — ' + slug,
    description: 'تفاصيل السلعة على DEBA Marketplace.',
  }
}

function imageUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
) {
  if (/^https?:\/\//i.test(storagePath)) return storagePath
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

function conditionLabel(product: ProductDetails) {
  if (product.listing_type === 'donation') return 'تبرع مجاني'

  const labels: Record<string, string> = {
    new: 'جديد',
    like_new: 'مستعمل - كالجديد',
    excellent: 'مستعمل - ممتاز',
    good: 'مستعمل - جيد',
    fair: 'مستعمل - مقبول',
    poor: 'مستعمل - يحتاج عناية',
    for_parts: 'للقطع / الإصلاح',
  }

  return (
    (product.condition_grade && labels[product.condition_grade]) ||
    'حالة جيدة'
  )
}

function formatPrice(product: ProductDetails) {
  if (product.listing_type === 'donation') return 'مجاني'

  if (product.price === null) {
    return product.is_negotiable ? 'قابل للتفاوض' : 'تواصل للسعر'
  }

  const price = Number(product.price)

  return (
    new Intl.NumberFormat('ar-EG', {
      maximumFractionDigits: 0,
    }).format(Number.isFinite(price) ? price : 0) +
    ' ' +
    product.currency
  )
}

export default async function ProductDetailsPage({
  params,
}: ProductPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: productData, error } = await supabase
    .from('products')
    .select(
      'id,owner_id,category_id,title,slug,description,listing_type,status,moderation_status,condition_grade,condition_details,price,currency,is_negotiable,minimum_offer_amount,quantity,city,governorate,district,delivery_method,created_at,category:categories!products_category_id_fkey(id,name_ar,name_en,slug),images:product_images!product_images_product_id_fkey(id,storage_path,alt_text,sort_order,is_primary)',
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .maybeSingle()

  if (error || !productData) {
    notFound()
  }

  const product = productData as unknown as ProductDetails

  let seller: SellerProfile | null = null

  if (product.owner_id) {
    const { data: sellerData } = await supabase
      .from('profiles')
      .select('display_name,username,avatar_url,city,governorate')
      .eq('id', product.owner_id)
      .eq('is_public', true)
      .maybeSingle()

    seller = sellerData as SellerProfile | null
  }

  const images = [...(product.images || [])].sort(
    (left, right) =>
      Number(right.is_primary) - Number(left.is_primary) ||
      left.sort_order - right.sort_order,
  )

  const primaryImage = images[0]
  const primaryImageUrl = primaryImage
    ? imageUrl(supabase, primaryImage.storage_path)
    : null

  const isDonation = product.listing_type === 'donation'
  const location = [product.city, product.governorate]
    .filter(Boolean)
    .join('، ')

  return (
    <>
      <Header />

      <main className="product-detail-page">
        <div className="product-detail-breadcrumbs">
          <Link href="/">الرئيسية</Link>
          <span>←</span>
          {product.category && (
            <>
              <Link href={'/?category=' + encodeURIComponent(product.category.name_ar)}>
                {product.category.name_ar}
              </Link>
              <span>←</span>
            </>
          )}
          <span>{product.title}</span>
        </div>

        <div className="product-detail-shell">
          <section className="product-detail-gallery">
            <div className="product-detail-main-image">
              {primaryImageUrl ? (
                <Image
                  src={primaryImageUrl}
                  alt={primaryImage?.alt_text?.trim() || product.title}
                  fill
                  priority
                  sizes="(max-width: 900px) 100vw, 58vw"
                />
              ) : (
                <div className="product-detail-placeholder">
                  <PackageCheck size={58} strokeWidth={1.5} />
                  <span>DEBA</span>
                </div>
              )}

              <span className={'product-detail-badge ' + (isDonation ? 'donation' : '')}>
                {conditionLabel(product)}
              </span>

              <button
                type="button"
                className="product-detail-favorite"
                aria-label="إضافة إلى المفضلة"
              >
                <Heart size={20} />
              </button>
            </div>

            {images.length > 1 && (
              <div className="product-detail-thumbs">
                {images.map((image) => (
                  <div key={image.id} className="product-detail-thumb">
                    <Image
                      src={imageUrl(supabase, image.storage_path)}
                      alt={image.alt_text?.trim() || product.title}
                      fill
                      sizes="88px"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="product-detail-info">
            <div className="product-detail-topline">
              <span>{product.category?.name_ar || 'أخرى'}</span>

              {location && (
                <span>
                  <MapPin size={14} />
                  {location}
                </span>
              )}
            </div>

            <h1>{product.title}</h1>

            <div className="product-detail-price">
              <strong>{formatPrice(product)}</strong>

              {!isDonation && product.is_negotiable && (
                <span>
                  <Repeat2 size={14} />
                  السعر قابل للتفاوض
                </span>
              )}
            </div>

            <div className="product-detail-divider" />

            <div className="product-detail-section">
              <h2>عن السلعة</h2>
              <p>
                {product.description ||
                  'لا يوجد وصف إضافي لهذه السلعة في الوقت الحالي.'}
              </p>

              {product.condition_details && (
                <p className="product-detail-condition">
                  {product.condition_details}
                </p>
              )}
            </div>

            <div className="product-detail-specs">
              <div>
                <span>الكمية</span>
                <strong>{product.quantity}</strong>
              </div>

              <div>
                <span>التوصيل</span>
                <strong>{product.delivery_method}</strong>
              </div>

              <div>
                <span>النشر</span>
                <strong>
                  {new Date(product.created_at).toLocaleDateString('ar-EG')}
                </strong>
              </div>
            </div>

            <div className="product-detail-seller">
              <div className="product-detail-seller-avatar">
                {seller?.avatar_url ? (
                  <Image
                    src={seller.avatar_url}
                    alt={seller.display_name || 'بائع DEBA'}
                    fill
                    sizes="52px"
                  />
                ) : (
                  <span>
                    {(seller?.display_name || seller?.username || 'D')
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <strong>
                  {seller?.display_name || seller?.username || 'عضو DEBA'}
                </strong>
                <span>
                  {seller?.city || seller?.governorate
                    ? [seller.city, seller.governorate]
                        .filter(Boolean)
                        .join('، ')
                    : 'عضو على منصة DEBA'}
                </span>
              </div>

              <ShieldCheck size={19} />
            </div>

            <div className="product-detail-actions">
              {isDonation ? (
                <Link
                  href="/login"
                  className="product-detail-primary donation"
                >
                  <MessageCircle size={18} />
                  طلب التبرع
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="product-detail-primary"
                >
                  <MessageCircle size={18} />
                  تقديم عرض سعر
                </Link>
              )}

              <Link href="/login" className="product-detail-secondary">
                تواصل مع صاحب الإعلان
              </Link>
            </div>

            <p className="product-detail-note">
              لتقديم عرض أو طلب تبرع، سجّل الدخول إلى حسابك أولًا.
            </p>

            <Link href="/" className="product-detail-back">
              <ArrowRight size={16} />
              العودة إلى السوق
            </Link>
          </section>
        </div>
      </main>
    </>
  )
}
