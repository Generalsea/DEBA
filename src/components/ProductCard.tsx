import Image from 'next/image'
import Link from 'next/link'
import {
  BadgeCheck,
  Heart,
  MapPin,
  MessageCircle,
  PackageCheck,
  Repeat2,
  Sparkles,
} from 'lucide-react'
import FavoriteButton from '@/components/FavoriteButton'

export type ProductCardItem = {
  id: string
  slug: string
  title: string
  description: string | null
  listingType: 'sale' | 'free'
  price: number | null
  currency: string
  isNegotiable: boolean
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
  if (item.listingType === 'free') return 'مجاني'
  if (item.price === null) return item.isNegotiable ? 'قابل للتفاوض' : 'السعر عند التواصل'

  return (
    new Intl.NumberFormat('ar-EG', {
      maximumFractionDigits: 0,
    }).format(item.price) +
    ' ' +
    item.currency
  )
}

function badge(item: ProductCardItem) {
  if (item.listingType === 'free') return { label: 'متاح مجانًا', tone: 'free' }
  return {
    label: (item.conditionGrade && CONDITION_LABELS[item.conditionGrade]) || 'حالة جيدة',
    tone: 'sale',
  }
}

function locationText(item: ProductCardItem) {
  return [item.city, item.governorate].filter(Boolean).join('، ')
}

export default function ProductCard({ item, priority = false }: ProductCardProps) {
  const itemBadge = badge(item)
  const isFree = item.listingType === 'free'
  const location = locationText(item)

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

          <span className={'deba-product-badge ' + itemBadge.tone}>
            {isFree ? <Sparkles size={12} /> : <BadgeCheck size={12} />}
            {itemBadge.label}
          </span>
        </Link>

        <FavoriteButton
          productId={item.id}
          initialFavorite={Boolean(item.isFavorite)}
          label="إضافة إلى المفضلة"
          className="deba-product-favorite"
        />

        {item.isNegotiable && !isFree && (
          <span className="deba-negotiable-chip">
            <Repeat2 size={12} />
            قابل للتفاوض
          </span>
        )}
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
            <span>{isFree ? 'قيمة DEBA' : 'السعر'}</span>
            <strong>{formatPrice(item)}</strong>
          </div>
          {item.listingType === 'sale' && <Heart size={16} aria-hidden="true" />}
        </div>

        <Link
          href={
            '/products/' +
            item.slug +
            (isFree ? '/checkout' : '/checkout')
          }
          className={'deba-product-action ' + (isFree ? 'is-green' : '')}
        >
          <MessageCircle size={16} />
          {isFree ? 'اطلبها الآن' : 'إتمام الشراء'}
        </Link>
      </div>
    </article>
  )
}
