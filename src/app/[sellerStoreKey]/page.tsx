import type { Metadata } from 'next'
import { BadgeCheck, MapPin, MessageCircle, ShieldCheck, Star, Store, Trophy } from 'lucide-react'
import Link from 'next/link'
import Header, { type HeaderCategory } from '@/components/Header'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const BUCKET = 'deba-product-media'

type StorePageProps = { params: Promise<{ sellerStoreKey: string }> }

function imageUrl(supabase: Awaited<ReturnType<typeof createClient>>, value: string | null) {
  if (!value) return null
  return /^https?:\/\//i.test(value) ? value : supabase.storage.from(BUCKET).getPublicUrl(value).data.publicUrl
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { sellerStoreKey } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('display_name,bio')
    .eq('seller_store_key', sellerStoreKey)
    .eq('account_type', 'seller')
    .eq('is_public', true)
    .maybeSingle()

  if (!data) return { title: 'متجر DEBA' }
  return {
    title: data.display_name + ' — متجر DEBA',
    description: data.bio || 'متجر بائع على DEBA.',
  }
}

export default async function SellerStorePage({ params }: StorePageProps) {
  const { sellerStoreKey } = await params
  const supabase = await createClient()

  const [{ data: seller }, { data: categories }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,display_name,username,avatar_url,bio,city,governorate,is_public,account_type,seller_store_key')
      .eq('seller_store_key', sellerStoreKey)
      .eq('account_type', 'seller')
      .eq('is_public', true)
      .maybeSingle(),
    supabase
      .from('categories')
      .select('id,name_ar,slug')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  if (!seller || !seller.seller_store_key) {
    return (
      <main className="deba-detail-page" dir="rtl">
        <section className="deba-detail-state-page">
          <div className="deba-detail-state-card">
            <Store size={30} />
            <span className="deba-detail-state-kicker">DEBA STORE</span>
            <h1>المتجر غير موجود</h1>
            <p>الرابط المطلوب غير صالح أو أن المتجر غير متاح للعامة حاليًا.</p>
            <Link href="/" className="deba-detail-state-action">العودة إلى السوق</Link>
          </div>
        </section>
      </main>
    )
  }

  const [{ data: products }, { data: ratingData }, { data: claimsData }] = await Promise.all([
    supabase
      .from('products')
      .select('id,title,slug,description,listing_type,price,currency,condition_grade,city,governorate,owner_id,quantity,delivery_method,category:categories!products_category_id_fkey(id,name_ar,slug),images:product_images!product_images_product_id_fkey(id,storage_path,alt_text,sort_order,is_primary)')
      .eq('owner_id', seller.id)
      .eq('status', 'published')
      .eq('moderation_status', 'approved')
      .eq('listing_type', 'sale')
      .gt('quantity', 0)
      .gt('price', 0)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(48),
    supabase.rpc('get_seller_rating_summary', { p_seller_id: seller.id }),
    supabase.auth.getClaims(),
  ])

  const ratingSummary = (ratingData as {
    average_rating?: number
    review_count?: number
    rating_5?: number
    rating_4?: number
    rating_3?: number
    rating_2?: number
    rating_1?: number
    verified_seller?: boolean
    top_rated?: boolean
  } | null) || {}
  const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
  const productIds = (products || []).map((product) => product.id)
  const { data: favoriteRows } = userId && productIds.length
    ? await supabase.from('favorites').select('product_id').eq('user_id', userId).in('product_id', productIds)
    : { data: [] as Array<{ product_id: string }> }

  const favoriteIds = new Set((favoriteRows || []).map((row) => row.product_id))
  const mappedCategories: HeaderCategory[] = (categories || []).map((item) => ({
    id: item.id,
    nameAr: item.name_ar,
    slug: item.slug,
  }))

  const storeProducts: ProductCardItem[] = (products || []).map((product) => {
    const image = [...(product.images || [])].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
    )[0]

    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      listingType: 'sale',
      price: Number(product.price),
      currency: product.currency || 'EGP',
      conditionGrade: product.condition_grade,
      city: product.city,
      governorate: product.governorate,
      categoryName: product.category?.[0]?.name_ar || null,
      imageUrl: imageUrl(supabase, image?.storage_path || null),
      imageAlt: image?.alt_text?.trim() || product.title,
      isFavorite: favoriteIds.has(product.id),
      sellerId: seller.id,
      sellerName: seller.display_name,
      sellerAvatar: imageUrl(supabase, seller.avatar_url || null),
      sellerVerified: ratingSummary.verified_seller === true,
      quantityAvailable: product.quantity,
      deliveryMethod: product.delivery_method as ProductCardItem['deliveryMethod'],
    }
  })

  const location = [seller.city, seller.governorate].filter(Boolean).join('، ')
  const sellerReviewsResult = await supabase
    .from('reviews')
    .select('id,rating,title,body,created_at,reviewer_id,verified_purchase')
    .eq('seller_id', seller.id)
    .eq('target_type', 'seller')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(6)

  const reviewerIds = Array.from(new Set((sellerReviewsResult.data || []).map((review) => review.reviewer_id)))
  const { data: reviewerProfiles } = reviewerIds.length
    ? await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', reviewerIds)
    : { data: [] as Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }> }
  const reviewerMap = new Map((reviewerProfiles || []).map((profile) => [profile.id, profile]))
  const avatar = imageUrl(supabase, seller.avatar_url || null)

  return (
    <>
      <Header categories={mappedCategories} />
      <main className="deba-store-page" dir="rtl">
        <section className="deba-store-hero">
          <span className="deba-store-kicker">DEBA SELLER STORE</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <div className="deba-store-avatar" style={{ width: 58, height: 58, borderRadius: 16, overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'var(--deba-brand-soft)', color: 'var(--deba-brand)', flex: '0 0 auto', fontWeight: 900, fontSize: 21 }}>
              {avatar ? <img src={avatar} alt="" width={58} height={58} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : seller.display_name.charAt(0)}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ marginTop: 0 }}>{seller.display_name}</h1>
              <div className="deba-store-meta">
                {ratingSummary.verified_seller ? <span><BadgeCheck size={14} /> بائع موثق</span> : <span><ShieldCheck size={14} /> حساب بائع DEBA</span>}
                {location ? <span><MapPin size={14} /> {location}</span> : null}
                <span><Store size={14} /> {storeProducts.length} إعلان متاح</span>
              </div>
            </div>
          </div>
          {seller.bio ? <p style={{ marginTop: 15 }}>{seller.bio}</p> : <p style={{ marginTop: 15 }}>متجر بائع داخل سوق DEBA، مع دورة بيع وطلبات مرتبطة بالمنصة.</p>}
          <div className="deba-store-trust-row">
            <span className="deba-store-rating"><Star size={14} fill="currentColor" /> {ratingSummary.average_rating ? Number(ratingSummary.average_rating).toFixed(1) : '—'} · {Number(ratingSummary.review_count || 0).toLocaleString('ar-EG')} تقييم</span>
            {ratingSummary.top_rated ? <span className="deba-store-top-rated"><Trophy size={14} /> أعلى تقييمًا</span> : null}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <Link href="/chat" className="deba-profile-primary-action"><MessageCircle size={16} />المحادثات</Link>
            <Link href="/sell" className="deba-profile-ghost-action">أضف إعلانك</Link>
          </div>
        </section>

        {ratingSummary.review_count ? (
          <section className="deba-store-reviews">
            <div className="deba-related-head">
              <div>
                <span>VERIFIED FEEDBACK</span>
                <h2>تجارب المشترين مع البائع</h2>
              </div>
            </div>
            <div className="deba-store-review-grid">
              {(sellerReviewsResult.data || []).map((review) => {
                const reviewer = reviewerMap.get(review.reviewer_id)
                const reviewerName = reviewer?.display_name || reviewer?.username || 'مستخدم DEBA'
                return (
                  <article key={review.id} className="deba-store-review-card">
                    <div className="deba-store-review-head">
                      <strong>{reviewerName}</strong>
                      <span><BadgeCheck size={12} /> {review.verified_purchase ? 'شراء موثق' : 'تقييم'}</span>
                    </div>
                    <div className="deba-reviews-stars small" aria-label={review.rating + ' من 5'}>
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star key={index} size={13} fill={index < review.rating ? 'currentColor' : 'none'} />
                      ))}
                    </div>
                    {review.title ? <h3>{review.title}</h3> : null}
                    <p>{review.body || 'بدون تعليق.'}</p>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        <section style={{ marginTop: 22 }}>
          <div className="deba-related-head">
            <div>
              <span>LIVE INVENTORY</span>
              <h2>المعروض للبيع الآن</h2>
            </div>
            <strong style={{ color: 'var(--deba-text-3)', fontSize: 10 }}>{storeProducts.length.toLocaleString('ar-EG')} سلعة</strong>
          </div>
          {storeProducts.length ? (
            <div className="deba-product-grid">
              {storeProducts.map((product) => <ProductCard key={product.id} item={product} />)}
            </div>
          ) : (
            <div className="deba-market-pulse-empty">
              <Store size={23} />
              <span>لا توجد إعلانات منشورة ومتاحة للشراء في هذا المتجر الآن.</span>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
