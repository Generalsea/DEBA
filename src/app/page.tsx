import type { Metadata } from 'next'
import Header from '@/components/Header'
import ProductGrid, { type ProductGridItem } from '@/components/ProductGrid'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'DEBA — Marketplace',
  description: 'سوق DEBA للبيع والتبادل والتبرع في مصر.',
}

const BUCKET = 'deba-product-media'
const LIMIT = 24

type ProductRow = {
  id: string
  title: string
  slug: string
  description: string | null
  listing_type: 'sale' | 'donation' | 'free'
  price: number | string | null
  currency: string
  is_negotiable: boolean
  condition_grade: string | null
  city: string | null
  governorate: string | null
  published_at: string | null
  created_at: string
  category:
    | {
        id: string
        name_ar: string
        name_en: string | null
        slug: string
      }
    | null
  images:
    | {
        id: string
        storage_path: string
        alt_text: string | null
        sort_order: number
        is_primary: boolean
      }[]
    | null
}

const PRODUCT_SELECT =
  'id,title,slug,description,listing_type,price,currency,is_negotiable,condition_grade,city,governorate,published_at,created_at,category:categories!products_category_id_fkey(id,name_ar,name_en,slug),images:product_images!product_images_product_id_fkey(id,storage_path,alt_text,sort_order,is_primary)'

function normalizePrice(value: number | string | null) {
  if (value === null) return null

  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function getImageUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string | null,
) {
  if (!storagePath) return null
  if (/^https?:\/\//i.test(storagePath)) return storagePath

  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

function mapRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: ProductRow,
): ProductGridItem {
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
    listingType: row.listing_type === 'donation' ? 'donation' : 'sale',
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

async function fetchListings() {
  const empty = {
    products: [] as ProductGridItem[],
    donations: [] as ProductGridItem[],
  }

  try {
    const supabase = await createClient()

    const query = (listingType: 'sale' | 'donation') =>
      supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('listing_type', listingType)
        .eq('status', 'published')
        .eq('moderation_status', 'approved')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(LIMIT)

    const [sales, donations] = await Promise.all([
      query('sale'),
      query('donation'),
    ])

    if (sales.error || donations.error) {
      console.error(
        'DEBA listings query failed',
        sales.error?.message,
        donations.error?.message,
      )
      return empty
    }

    return {
      products: (sales.data as unknown as ProductRow[]).map((row) =>
        mapRow(supabase, row),
      ),
      donations: (donations.data as unknown as ProductRow[]).map((row) =>
        mapRow(supabase, row),
      ),
    }
  } catch (error) {
    console.error('DEBA homepage data load failed', error)
    return empty
  }
}

export default async function HomePage() {
  const { products, donations } = await fetchListings()

  return (
    <>
      <Header />

      <main className="market-home">
        <section className="market-hero">
          <div className="market-hero-content">
            <span className="market-hero-kicker">DEBA / MARKETPLACE</span>

            <h1>
              اشترِ بذكاء.
              <br />
              بع، بدّل، وتبرّع.
            </h1>

            <p>
              كل ما تحتاجه في سوق واحد: سلع مختارة، عروض محلية، وتبرعات تصل إلى
              من يحتاجها فعلًا.
            </p>

            <div className="market-hero-actions">
              <a href="#marketplace" className="market-hero-primary">
                تسوق الآن
              </a>
              <a href="#donations" className="market-hero-secondary">
                اكتشف التبرعات
              </a>
            </div>

            <div className="market-hero-trust">
              <span>✓ إعلانات معتمدة</span>
              <span>✓ تفاوض مباشر</span>
              <span>✓ تبرعات مجانية</span>
            </div>
          </div>

          <div className="market-hero-offer">
            <span>عرض الأسبوع</span>
            <strong>حوّل الأشياء غير المستخدمة إلى قيمة.</strong>
            <p>أضف سلعتك في دقائق وابدأ استقبال العروض أو طلبات التبرع.</p>
            <a href="/login">أضف أول إعلان ←</a>
          </div>
        </section>

        <section className="market-home-content">
          <div className="market-service-strip">
            <div>
              <span>01</span>
              <strong>بيع محلي</strong>
              <small>اعرض سلعتك واجعل التفاوض مباشرًا</small>
            </div>
            <div>
              <span>02</span>
              <strong>تبرع مؤثر</strong>
              <small>امنح ما لا تحتاجه لمن يحتاجه</small>
            </div>
            <div>
              <span>03</span>
              <strong>اكتشف بسهولة</strong>
              <small>فئات واضحة وبحث أسرع</small>
            </div>
            <div>
              <span>04</span>
              <strong>EGP</strong>
              <small>السوق مصمم للمستخدم المصري</small>
            </div>
          </div>

          <ProductGrid products={products} donations={donations} />
        </section>
      </main>
    </>
  )
}
