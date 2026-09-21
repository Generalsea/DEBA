import Link from 'next/link'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'

export type ProductGridItem = ProductCardItem

type ProductGridProps = {
  products: ProductGridItem[]
  donations: ProductGridItem[]
}

function EmptyState({ type }: { type: 'sale' | 'donation' }) {
  return (
    <div className="market-empty-state">
      <span className="market-empty-icon">{type === 'sale' ? 'سوق' : 'أثر'}</span>
      <h3>
        {type === 'sale'
          ? 'لا توجد منتجات منشورة للبيع بعد'
          : 'لا توجد تبرعات منشورة بعد'}
      </h3>
      <p>ستظهر الإعلانات المعتمدة هنا تلقائيًا.</p>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  href,
}: {
  eyebrow: string
  title: string
  href: string
}) {
  return (
    <div className="market-section-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>

      <Link href={href} className="market-section-link">
        مشاهدة الكل ←
      </Link>
    </div>
  )
}

export default function ProductGrid({
  products,
  donations,
}: ProductGridProps) {
  return (
    <div className="market-listing-sections">
      <section id="marketplace">
        <SectionHeading
          eyebrow="الأكثر طلبًا"
          title="منتجات مميزة للبيع"
          href="/?type=sale"
        />

        {products.length > 0 ? (
          <div className="market-product-grid">
            {products.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState type="sale" />
        )}
      </section>

      <section id="donations">
        <SectionHeading
          eyebrow="DEBA IMPACT"
          title="تبرعات عاجلة تحتاج من يكمل أثرها"
          href="/?type=donation"
        />

        {donations.length > 0 ? (
          <div className="market-product-grid">
            {donations.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState type="donation" />
        )}
      </section>
    </div>
  )
}
