import type { Metadata } from 'next'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header, { type HeaderCategory } from '@/components/Header'
import CheckoutForm from '@/components/CheckoutForm'
import { createClient } from '@/utils/supabase/server'

type Product = {
  id: string
  owner_id: string | null
  title: string
  slug: string
  listing_type: 'sale' | 'free'
  price: number | string | null
  currency: string
  quantity: number
  delivery_method: string
  category: {
    id: string
    name_ar: string
    name_en: string | null
    slug: string
  } | null
}

const SELECT =
  'id,owner_id,title,slug,listing_type,price,currency,quantity,delivery_method,category:categories!products_category_id_fkey(id,name_ar,name_en,slug)'

function normalizePrice(value: number | string | null) {
  const numberValue = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function formatMoney(value: number, currency: string) {
  return (
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value) +
    ' ' +
    currency
  )
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
    .select('title')
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .in('listing_type', ['sale', 'free'])
    .maybeSingle()

  return {
    title: data?.title ? 'إتمام شراء ' + data.title + ' — DEBA' : 'إتمام الشراء — DEBA',
  }
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const [{ data: product, error }, { data: categories }, { data: claimsData }] =
    await Promise.all([
      supabase
        .from('products')
        .select(SELECT)
        .eq('slug', slug)
        .eq('status', 'published')
        .eq('moderation_status', 'approved')
        .in('listing_type', ['sale', 'free'])
        .maybeSingle(),
      supabase
        .from('categories')
        .select('id,name_ar,name_en,slug')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase.auth.getClaims(),
    ])

  if (error) {
    throw new Error('تعذر تحميل المنتج لإتمام الشراء.')
  }

  if (!product) notFound()

  const row = product as unknown as Product
  const price = normalizePrice(row.price)
  const isAuthenticated = Boolean(claimsData?.claims?.sub)

  const mappedCategories = ((categories || []) as HeaderCategory[]).map((item) => ({
    id: item.id,
    nameAr: (item as unknown as { name_ar: string }).name_ar,
    slug: item.slug,
  }))

  const sellerCanBuy =
    Boolean(row.owner_id) && row.quantity > 0 && !isAuthenticated

  return (
    <>
      <Header categories={mappedCategories} />

      <main className="deba-checkout-page" dir="rtl">
        <div className="deba-checkout-breadcrumbs">
          <Link href="/">
            <ArrowRight size={15} />
            السوق
          </Link>
          <span>/</span>
          <Link href={'/products/' + encodeURIComponent(row.slug)}>
            {row.title}
          </Link>
          <span>/</span>
          <strong>إتمام الشراء</strong>
        </div>

        <div className="deba-checkout-layout">
          <section className="deba-checkout-intro">
            <span>DEBA CHECKOUT</span>
            <h1>{row.listing_type === 'free' ? 'طلب المنتج' : 'إتمام شراء المنتج'}</h1>
            <p>
              راجع المنتج مرة أخيرة، اختر طريقة الاستلام، ثم سجّل الطلب داخل حساب
              DEBA.
            </p>

            <div className="deba-checkout-product">
              <div>
                <span>المنتج</span>
                <strong>{row.title}</strong>
              </div>
              <div>
                <span>السعر</span>
                <strong>
                  {row.listing_type === 'free'
                    ? 'مجاني'
                    : formatMoney(price, row.currency)}
                </strong>
              </div>
              <div>
                <span>المتاح الآن</span>
                <strong>{row.quantity.toLocaleString('ar-EG')} وحدة</strong>
              </div>
            </div>

            <div className="deba-checkout-note-card">
              <ShieldCheck size={18} />
              <div>
                <strong>مهم قبل التأكيد</strong>
                <span>
                  تسجيل الطلب لا يعني خصمًا إلكترونيًا. حالة الدفع تبقى
                  «غير مدفوع إلكترونيًا» حتى يتم ربط بوابة الدفع الفعلية.
                </span>
              </div>
            </div>
          </section>

          <section className="deba-checkout-form-column">
            <CheckoutForm
              productId={row.id}
              productSlug={row.slug}
              productTitle={row.title}
              listingType={row.listing_type}
              price={price}
              currency={row.currency || 'EGP'}
              productDeliveryMethod={row.delivery_method}
              isAuthenticated={isAuthenticated}
            />

            {!row.owner_id && (
              <div className="deba-checkout-blocker">
                لا يوجد بائع مرتبط بهذا الإعلان، لذلك لا يمكن إنشاء طلب شراء حاليًا.
              </div>
            )}

            {sellerCanBuy && (
              <div className="deba-checkout-inline-hint">
                سجّل الدخول أولًا حتى يرتبط الطلب بحسابك.
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
