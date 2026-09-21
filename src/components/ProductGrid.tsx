import Link from 'next/link'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'
import { ArrowLeft, Gift, ShoppingBag } from 'lucide-react'

export type ProductGridItem = ProductCardItem

type ProductGridProps = {
  products: ProductGridItem[]
  donations: ProductGridItem[]
  mode?: 'all' | 'sale' | 'donation'
}

function EmptyState({ type }: { type: 'sale' | 'donation' }) {
  const sale = type === 'sale'

  return (
    <div className="deba-empty-state">
      <span className="deba-empty-icon">{sale ? <ShoppingBag size={24} /> : <Gift size={24} />}</span>
      <h3>{sale ? 'لا توجد سلع منشورة للبيع حاليًا' : 'لا توجد تبرعات منشورة حاليًا'}</h3>
      <p>ستظهر هنا الإعلانات المعتمدة تلقائيًا بمجرد نشرها.</p>
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  count,
  href,
}: {
  eyebrow: string
  title: string
  count: number
  href: string
}) {
  return (
    <div className="deba-section-header">
      <div>
        <span className="deba-section-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>

      <div className="deba-section-header-side">
        <span>{count.toLocaleString('ar-EG')} عنصر</span>
        <Link href={href}>
          مشاهدة الكل
          <ArrowLeft size={15} />
        </Link>
      </div>
    </div>
  )
}

export default function ProductGrid({
  products,
  donations,
  mode = 'all',
}: ProductGridProps) {
  const showSales = mode !== 'donation'
  const showDonations = mode !== 'sale'

  return (
    <div className="deba-product-sections">
      {showSales && (
        <section id="marketplace" className="deba-product-section">
          <SectionHeader
            eyebrow="DEBA MARKET"
            title="أحدث السلع والعروض"
            count={products.length}
            href="/?type=sale"
          />

          {products.length ? (
            <div className="deba-product-grid">
              {products.map((item, index) => (
                <ProductCard key={item.id} item={item} priority={index < 4} />
              ))}
            </div>
          ) : (
            <EmptyState type="sale" />
          )}
        </section>
      )}

      {showDonations && (
        <section id="donations" className="deba-product-section">
          <SectionHeader
            eyebrow="DEBA IMPACT"
            title="تبرعات مجانية جاهزة لمن يحتاجها"
            count={donations.length}
            href="/?type=donation"
          />

          {donations.length ? (
            <div className="deba-product-grid">
              {donations.map((item, index) => (
                <ProductCard key={item.id} item={item} priority={!showSales && index < 4} />
              ))}
            </div>
          ) : (
            <EmptyState type="donation" />
          )}
        </section>
      )}
    </div>
  )
}
