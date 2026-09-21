'use client'

import Image from 'next/image'

export type ProductGridItem = {
  id: string
  slug: string
  title: string
  description: string | null
  listingType: 'sale' | 'donation'
  price: number | null
  currency: string
  isNegotiable: boolean
  conditionGrade: string | null
  city: string | null
  governorate: string | null
  categoryName: string | null
  imageUrl: string | null
  imageAlt: string
}

type ProductGridProps = {
  products: ProductGridItem[]
  donations: ProductGridItem[]
}

function formatPrice(item: ProductGridItem) {
  if (item.listingType === 'donation') {
    return 'تبرع'
  }

  if (item.price === null) {
    return item.isNegotiable ? 'قابل للتفاوض' : 'السعر عند التواصل'
  }

  return (
    new Intl.NumberFormat('ar-EG', {
      maximumFractionDigits: 0,
    }).format(item.price) +
    ' ' +
    item.currency
  )
}

function locationText(item: ProductGridItem) {
  return [item.city, item.governorate].filter(Boolean).join('، ')
}

function Card({ item }: { item: ProductGridItem }) {
  return (
    <article className="product-card">
      <a href={'/products/' + item.slug} className="product-image">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.imageAlt}
            fill
            sizes="(max-width: 680px) 100vw, (max-width: 980px) 50vw, 25vw"
          />
        ) : (
          <div className="image-placeholder" aria-label="لا توجد صورة">
            <span>DEBA</span>
          </div>
        )}

        <span
          className={
            item.listingType === 'donation'
              ? 'listing-badge donation'
              : 'listing-badge'
          }
        >
          {item.listingType === 'donation' ? 'تبرع' : 'للبيع'}
        </span>
      </a>

      <div className="product-content">
        <div className="product-meta">
          <span>{item.categoryName || 'أخرى'}</span>
          {item.conditionGrade && <span>{item.conditionGrade}</span>}
        </div>

        <h3>{item.title}</h3>

        {item.description && (
          <p>
            {item.description.length > 92
              ? item.description.slice(0, 92) + '…'
              : item.description}
          </p>
        )}

        <div className="product-footer">
          <strong>{formatPrice(item)}</strong>
          {locationText(item) && <span>{locationText(item)}</span>}
        </div>
      </div>
    </article>
  )
}

function EmptyState({ type }: { type: 'sale' | 'donation' }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">DEBA</span>
      <h3>
        {type === 'sale'
          ? 'لا توجد منتجات منشورة للبيع بعد'
          : 'لا توجد فرص تبرع منشورة بعد'}
      </h3>
      <p>ستظهر الإعلانات المعتمدة هنا تلقائيًا.</p>
    </div>
  )
}

export default function ProductGrid({
  products,
  donations,
}: ProductGridProps) {
  return (
    <div className="listing-sections">
      <section id="marketplace">
        <div className="section-heading">
          <div>
            <span>MARKETPLACE</span>
            <h2>منتجات معروضة للبيع</h2>
          </div>
          <a href="#marketplace">عرض الكل ←</a>
        </div>

        {products.length > 0 ? (
          <div className="product-grid">
            {products.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState type="sale" />
        )}
      </section>

      <section id="donations">
        <div className="section-heading">
          <div>
            <span>DEBA IMPACT</span>
            <h2>تبرعات تحتاج إلى من يكمل أثرها</h2>
          </div>
          <a href="#donations">عرض الكل ←</a>
        </div>

        {donations.length > 0 ? (
          <div className="product-grid">
            {donations.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState type="donation" />
        )}
      </section>
    </div>
  )
}
