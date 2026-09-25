import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, CalendarDays, MapPin, ShieldCheck, Star, Store, Trophy, UserRound } from 'lucide-react'
import Header, { type HeaderCategory } from '@/components/Header'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ username: string }>
}

const BUCKET = 'deba-product-media'

function imageUrl(supabase: Awaited<ReturnType<typeof createClient>>, value: string | null) {
  if (!value) return null
  return /^https?:\/\//i.test(value)
    ? value
    : supabase.storage.from(BUCKET).getPublicUrl(value).data.publicUrl
}

function dateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-EG', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('display_name,username,bio,is_public,account_type')
    .eq('username', username)
    .eq('is_public', true)
    .maybeSingle()

  if (!data) return { title: 'العضو غير متاح — DEBA' }

  return {
    title: (data.display_name || data.username || 'عضو DEBA') + ' — DEBA',
    description: data.bio || 'ملف عام لعضو في DEBA.',
  }
}

export default async function PublicMemberProfilePage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const [{ data: member }, { data: categories }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,display_name,username,avatar_url,bio,city,governorate,is_public,account_type,seller_store_key,created_at')
      .eq('username', username)
      .eq('is_public', true)
      .maybeSingle(),
    supabase
      .from('categories')
      .select('id,name_ar,slug')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  if (!member) {
    return (
      <main className="deba-detail-page" dir="rtl">
        <section className="deba-detail-state-page">
          <div className="deba-detail-state-card">
            <UserRound size={30} />
            <span className="deba-detail-state-kicker">DEBA PROFILE</span>
            <h1>الملف غير متاح</h1>
            <p>هذا الملف غير موجود أو اختار صاحبه عدم إتاحته للعامة.</p>
            <Link href="/" className="deba-detail-state-action">العودة إلى السوق</Link>
          </div>
        </section>
      </main>
    )
  }

  const isSeller = member.account_type === 'seller'

  const [
    { data: ratingData },
    { data: sellerProducts },
  ] = isSeller
    ? await Promise.all([
        supabase.rpc('get_seller_rating_summary', { p_seller_id: member.id }),
        supabase
          .from('products')
          .select('id,title,slug,description,listing_type,price,currency,condition_grade,city,governorate,quantity,delivery_method,category:categories!products_category_id_fkey(id,name_ar,slug),images:product_images!product_images_product_id_fkey(id,storage_path,alt_text,sort_order,is_primary)')
          .eq('owner_id', member.id)
          .eq('status', 'published')
          .eq('moderation_status', 'approved')
          .eq('listing_type', 'sale')
          .gt('quantity', 0)
          .gt('price', 0)
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(12),
      ])
    : [{ data: null }, { data: [] as Array<never> }]

  const ratingSummary = (ratingData as {
    average_rating?: number
    review_count?: number
    verified_seller?: boolean
    top_rated?: boolean
  } | null) || {}

  const storeProducts: ProductCardItem[] = (sellerProducts || []).map((product) => {
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
      sellerId: member.id,
      sellerName: member.display_name,
      sellerAvatar: imageUrl(supabase, member.avatar_url || null),
      sellerVerified: ratingSummary.verified_seller === true,
      quantityAvailable: product.quantity,
      deliveryMethod: product.delivery_method as ProductCardItem['deliveryMethod'],
    }
  })

  const mappedCategories: HeaderCategory[] = (categories || []).map((item) => ({
    id: item.id,
    nameAr: item.name_ar,
    slug: item.slug,
  }))

  const location = [member.city, member.governorate].filter(Boolean).join('، ')
  const avatarUrl = imageUrl(supabase, member.avatar_url || null)
  const displayName = member.display_name || member.username || 'عضو DEBA'

  return (
    <>
      <Header categories={mappedCategories} />
      <main className="deba-public-profile-page" dir="rtl">
        <section className="deba-public-profile-hero">
          <div className="deba-public-profile-avatar">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill sizes="88px" />
            ) : (
              displayName.charAt(0)
            )}
          </div>

          <div className="deba-public-profile-copy">
            <span className="deba-store-kicker">DEBA PUBLIC PROFILE</span>
            <h1>{displayName}</h1>
            <p className="deba-public-profile-handle">@{member.username || 'deba-member'}</p>

            <div className="deba-public-profile-badges">
              <span>
                {isSeller ? <Store size={14} /> : <UserRound size={14} />}
                {isSeller ? 'بائع' : 'مشتري'}
              </span>
              {isSeller && ratingSummary.verified_seller ? (
                <span><BadgeCheck size={14} /> بائع موثق</span>
              ) : null}
              {isSeller && ratingSummary.top_rated ? (
                <span><Trophy size={14} /> أعلى تقييمًا</span>
              ) : null}
              {isSeller && ratingSummary.review_count ? (
                <span><Star size={14} fill="currentColor" /> {Number(ratingSummary.average_rating).toFixed(1)} · {Number(ratingSummary.review_count).toLocaleString('ar-EG')} تقييم</span>
              ) : null}
              {location ? <span><MapPin size={14} /> {location}</span> : null}
              <span><CalendarDays size={14} /> عضو منذ {dateLabel(member.created_at)}</span>
            </div>

            <p className="deba-public-profile-bio">
              {member.bio || (isSeller ? 'بائع داخل سوق DEBA.' : 'عضو في مجتمع DEBA.')}
            </p>

            <div className="deba-public-profile-actions">
              {isSeller && member.seller_store_key ? (
                <Link href={'/store/' + encodeURIComponent(member.seller_store_key)} className="deba-profile-primary-action">
                  <Store size={16} /> فتح المتجر
                </Link>
              ) : null}
              <Link href="/chat" className="deba-profile-ghost-action">المحادثات</Link>
            </div>
          </div>
        </section>

        {isSeller ? (
          <section className="deba-public-profile-section">
            <div className="deba-related-head">
              <div>
                <span>PUBLIC INVENTORY</span>
                <h2>إعلانات البائع النشطة</h2>
              </div>
              <strong>{storeProducts.length.toLocaleString('ar-EG')} سلعة</strong>
            </div>

            {storeProducts.length ? (
              <div className="deba-product-grid">
                {storeProducts.map((product) => (
                  <ProductCard key={product.id} item={product} />
                ))}
              </div>
            ) : (
              <div className="deba-market-pulse-empty">
                <ShieldCheck size={23} />
                <span>لا توجد إعلانات منشورة ومتاحة للشراء الآن.</span>
              </div>
            )}
          </section>
        ) : (
          <section className="deba-public-profile-section">
            <div className="deba-public-profile-note">
              <ShieldCheck size={22} />
              <div>
                <strong>ملف عام محدود وآمن</strong>
                <span>يعرض DEBA فقط البيانات التي اختار العضو إتاحتها للعامة، ولا يعرض العنوان أو بيانات الطلبات أو بيانات التحقق الخاصة.</span>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  )
}
