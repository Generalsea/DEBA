import Image from 'next/image'
import Link from 'next/link'
import {
  Heart,
  MapPin,
  MessageCircle,
  PackageCheck,
  Repeat2,
} from 'lucide-react'

export type ProductCardItem = {
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

type ProductCardProps = {
  item: ProductCardItem
}

function formatPrice(item: ProductCardItem) {
  if (item.listingType === 'donation') {
    return 'مجاني'
  }

  if (item.price === null) {
    return item.isNegotiable ? 'قابل للتفاوض' : 'تواصل للسعر'
  }

  return (
    new Intl.NumberFormat('ar-EG', {
      maximumFractionDigits: 0,
    }).format(item.price) +
    ' ' +
    item.currency
  )
}

function conditionLabel(item: ProductCardItem) {
  if (item.listingType === 'donation') return 'تبرع مجاني'
  if (item.conditionGrade) return item.conditionGrade
  return 'حالة جيدة'
}

function locationText(item: ProductCardItem) {
  return [item.city, item.governorate].filter(Boolean).join('، ')
}

export default function ProductCard({ item }: ProductCardProps) {
  const isDonation = item.listingType === 'donation'

  return (
    <article className="market-product-card">
      <Link href={'/products/' + item.slug} className="market-product-media">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.imageAlt}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          />
        ) : (
          <div className="market-product-placeholder">
            <PackageCheck size={34} strokeWidth={1.7} />
            <span>DEBA</span>
          </div>
        )}

        <span className={'market-product-badge ' + (isDonation ? 'donation' : '')}>
          {conditionLabel(item)}
        </span>

        <span className="market-product-favorite" aria-label="إضافة للمفضلة">
          <Heart size={17} />
        </span>
      </Link>

      <div className="market-product-body">
        <div className="market-product-category">
          <span>{item.categoryName || 'أخرى'}</span>
          {locationText(item) && (
            <span className="market-product-location">
              <MapPin size={12} />
              {locationText(item)}
            </span>
          )}
        </div>

        <Link href={'/products/' + item.slug} className="market-product-title">
          {item.title}
        </Link>

        {item.description && (
          <p className="market-product-description">
            {item.description.length > 84
              ? item.description.slice(0, 84) + '…'
              : item.description}
          </p>
        )}

        <div className="market-product-price-row">
          <div>
            <strong>{formatPrice(item)}</strong>
            {!isDonation && item.isNegotiable && (
              <span className="market-product-negotiable">
                <Repeat2 size={12} />
                قابل للتفاوض
              </span>
            )}
          </div>
        </div>

        <Link
          href={
            isDonation
              ? '/products/' + item.slug + '?action=request'
              : '/products/' + item.slug + '?action=offer'
          }
          className={'market-product-action ' + (isDonation ? 'donation' : '')}
        >
          <MessageCircle size={16} />
          {isDonation ? 'اطلب التبرع' : 'قدّم عرضك'}
        </Link>
      </div>
    </article>
  )
}
