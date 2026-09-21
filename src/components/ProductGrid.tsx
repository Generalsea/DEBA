import Link from 'next/link'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'
import { ArrowLeft, ShoppingBag } from 'lucide-react'

export type ProductGridItem = ProductCardItem

type ProductGridProps = {
  products: ProductGridItem[]
  mode?: 'all' | 'sale'
}

function EmptyState() {
  return (
    <div className="deba-empty-state">
      <span className="deba-empty-icon"><ShoppingBag size={24} /></span>
      <h3>لا توجد منتجات منشورة حاليًا</h3>
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
}: ProductGridProps) {
  return (
    <div className="deba-product-sections">
      <section id="marketplace" className="deba-product-section">
        <SectionHeader
          eyebrow="DEBA MARKET"
          title="أحدث المنتجات"
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
          <EmptyState />
        )}
      </section>
    </div>
  )
}
