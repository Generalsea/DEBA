import Image from 'next/image'
import Link from 'next/link'
import {
  BadgeCheck,
  Heart,
  MapPin,
  PackageCheck,
} from 'lucide-react'
import FavoriteButton from '@/components/FavoriteButton'

export type ProductCardItem = {
  id: string
  slug: string
  title: string
  description: string | null
  listingType: 'sale'
  price: number | null
  currency: string
  conditionGrade: string | null
  city: string | null
  governorate: string | null
  categoryName: string | null
  imageUrl: string | null
  imageAlt: string
  isFavorite?: boolean
}

type ProductCardProps = {
  item: ProductCardItem
  priority?: boolean
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'جديد',
  like_new: 'كالجديد',
  excellent: 'ممتاز',
  good: 'جيد',
  fair: 'مقبول',
  poor: 'يحتاج عناية',
  for_parts: 'للقطع / الإصلاح',
}

function formatPrice(item: ProductCardItem) {
  if (item.price === null) return 'السعر عند التواصل'

  return (
    new Intl.NumberFormat('ar-EG', {
      maximumFractionDigits: 0,
    }).format(item.price) +
    ' ' +
    item.currency
  )
}

function locationText(item: ProductCardItem) {
  return [item.city, item.governorate].filter(Boolean).join('، ')
}

export default function ProductCard({ item, priority = false }: ProductCardProps) {
  const location = locationText(item)
  const condition =
    (item.conditionGrade && CONDITION_LABELS[item.conditionGrade]) || 'حالة جيدة'

  return (
    <article className="deba-product-card">
      <div className="deba-product-media">
        <Link
          href={'/products/' + item.slug}
          className="deba-product-image-link"
          aria-label={'عرض ' + item.title}
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.imageAlt}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 25vw"
            />
          ) : (
            <div className="deba-product-placeholder">
              <PackageCheck size={34} strokeWidth={1.5} />
              <span>DEBA</span>
            </div>
          )}

          <span className="deba-product-badge sale">
            <BadgeCheck size={12} />
            {condition}
          </span>
        </Link>

        <FavoriteButton
          productId={item.id}
          initialFavorite={Boolean(item.isFavorite)}
          label="إضافة إلى المفضلة"
          className="deba-product-favorite"
        />
      </div>

      <div className="deba-product-body">
        <div className="deba-product-meta">
          <span>{item.categoryName || 'أخرى'}</span>
          {location && (
            <span className="deba-product-location">
              <MapPin size={12} />
              {location}
            </span>
          )}
        </div>

        <Link href={'/products/' + item.slug} className="deba-product-title">
          {item.title}
        </Link>

        {item.description && (
          <p className="deba-product-description">
            {item.description.length > 92
              ? item.description.slice(0, 92) + '…'
              : item.description}
          </p>
        )}

        <div className="deba-product-price">
          <div>
            <span>السعر</span>
            <strong>{formatPrice(item)}</strong>
          </div>
          <Heart size={16} aria-hidden="true" />
        </div>

        <Link
          href={'/products/' + item.slug}
          className="deba-product-action"
        >
          <PackageCheck size={16} />
          اشترِ الآن
        </Link>
      </div>
    </article>
  )
}
