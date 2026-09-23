'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, MapPin, PackageCheck, Star, Truck } from 'lucide-react'
import FavoriteButton from '@/components/FavoriteButton'
import AddToCartButton from '@/components/AddToCartButton'
import type { CartProduct } from '@/lib/types'

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
  sellerId?: string | null
  sellerName?: string | null
  sellerAvatar?: string | null
  sellerVerified?: boolean
  quantityAvailable?: number
  isLowStock?: boolean
  deliveryMethod?: CartProduct['deliveryMethod'] | null
  ratingValue?: number | null
  ratingCount?: number
}

type ProductCardProps = {
  item: ProductCardItem
  priority?: boolean
  compact?: boolean
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
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(item.price) +
    ' ' +
    item.currency
  )
}

function locationText(item: ProductCardItem) {
  return [item.city, item.governorate].filter(Boolean).join('، ')
}

function deliveryLabel(method: ProductCardItem['deliveryMethod']) {
  switch (method) {
    case 'seller_delivery':
    case 'platform_delivery':
      return 'شحن متاح'
    case 'both':
      return 'استلام أو شحن'
    case 'pickup':
      return 'استلام من الموقع'
    default:
      return null
  }
}

export default function ProductCard({ item, priority = false, compact = false }: ProductCardProps) {
  const location = locationText(item)
  const condition =
    (item.conditionGrade && CONDITION_LABELS[item.conditionGrade]) || 'غير محددة'
  const unavailable = (item.quantityAvailable ?? 1) < 1
  const lowStock = !unavailable && Boolean(item.isLowStock)
  const sellerName = item.sellerName?.trim() || null

  const cartProduct: CartProduct | null =
    item.price !== null &&
    Boolean(item.sellerId) &&
    (item.quantityAvailable ?? 0) > 0
      ? {
          id: item.id,
          title: item.title,
          slug: item.slug,
          price: item.price,
          currency: item.currency || 'EGP',
          conditionGrade: item.conditionGrade,
          listingType: 'sale',
          quantityAvailable: Math.max(0, item.quantityAvailable ?? 0),
          sellerId: item.sellerId as string,
          sellerName: sellerName || 'عضو DEBA',
          sellerAvatar: item.sellerAvatar || null,
          imageUrl: item.imageUrl,
          imageAlt: item.imageAlt,
          deliveryMethod: item.deliveryMethod || 'pickup',
        }
      : null

  return (
    <article className={'deba-market-card' + (compact ? ' is-compact' : '') + (unavailable ? ' is-unavailable' : '')}>
      <div className="deba-market-card-media">
        <Link
          href={'/products/' + encodeURIComponent(item.slug)}
          className="deba-market-card-image"
          aria-label={'عرض ' + item.title}
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.imageAlt}
              fill
              priority={priority}
              sizes="(max-width: 640px) 48vw, (max-width: 1024px) 31vw, 260px"
            />
          ) : (
            <div className="deba-market-card-placeholder">
              <PackageCheck size={33} aria-hidden="true" />
              <span>DEBA</span>
            </div>
          )}

          <div className="deba-market-card-badges">
            <span>{condition}</span>
            {lowStock ? <span className="is-warning">كمية محدودة</span> : null}
          </div>

          {unavailable ? <div className="deba-market-card-unavailable">غير متاح حاليًا</div> : null}
        </Link>

        <FavoriteButton
          productId={item.id}
          initialFavorite={Boolean(item.isFavorite)}
          label="إضافة إلى المفضلة"
          className="deba-market-card-favorite"
        />
      </div>

      <div className="deba-market-card-body">
        <div className="deba-market-card-category">
          <span>{item.categoryName || 'أخرى'}</span>
          {location ? (
            <span>
              <MapPin size={12} aria-hidden="true" />
              {location}
            </span>
          ) : null}
        </div>

        <Link href={'/products/' + encodeURIComponent(item.slug)} className="deba-market-card-title">
          {item.title}
        </Link>

        {!compact && item.description ? (
          <p className="deba-market-card-description">
            {item.description.length > 105 ? item.description.slice(0, 105) + '…' : item.description}
          </p>
        ) : null}

        {item.ratingValue !== null && item.ratingValue !== undefined && (item.ratingCount ?? 0) > 0 ? (
          <div
            className="deba-market-card-rating"
            aria-label={item.ratingValue + ' من 5، ' + item.ratingCount + ' تقييم'}
          >
            <Star size={13} fill="currentColor" aria-hidden="true" />
            <strong>
              {item.ratingValue.toLocaleString('ar-EG', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </strong>
            <span>({(item.ratingCount ?? 0).toLocaleString('ar-EG')})</span>
          </div>
        ) : null}

        <div className="deba-market-card-price">
          <span>السعر</span>
          <strong>{formatPrice(item)}</strong>
        </div>

        {sellerName ? (
          <div className="deba-market-card-seller">
            <span className="deba-market-card-seller-avatar">
              {item.sellerAvatar ? (
                <img src={item.sellerAvatar} alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                sellerName.charAt(0).toUpperCase()
              )}
            </span>
            <span className="deba-market-card-seller-name">{sellerName}</span>
            {item.sellerVerified ? <BadgeCheck size={14} aria-label="بائع موثق" /> : null}
          </div>
        ) : null}

        {deliveryLabel(item.deliveryMethod) ? (
          <div className="deba-market-card-delivery">
            <Truck size={14} aria-hidden="true" />
            <span>{deliveryLabel(item.deliveryMethod)}</span>
          </div>
        ) : null}

        <div className="deba-market-card-actions">
          {cartProduct ? (
            <AddToCartButton product={cartProduct} disabled={unavailable} />
          ) : (
            <Link href={'/products/' + encodeURIComponent(item.slug)} className="deba-product-action">
              <PackageCheck size={15} aria-hidden="true" />
              {unavailable ? 'غير متاح' : 'عرض التفاصيل'}
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
