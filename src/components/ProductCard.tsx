'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  BadgeCheck,
  MapPin,
  PackageCheck,
  Truck,
} from 'lucide-react'
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

export default function ProductCard({ item, priority = false }: ProductCardProps) {
  const location = locationText(item)
  const condition =
    (item.conditionGrade && CONDITION_LABELS[item.conditionGrade]) || 'حالة جيدة'
  const unavailable = (item.quantityAvailable ?? 1) < 1
  const lowStock = !unavailable && Boolean(item.isLowStock)
  const sellerName = item.sellerName?.trim() || null
  const addable =
    item.price !== null &&
    Boolean(item.sellerId) &&
    (item.quantityAvailable ?? 0) > 0

  const cartProduct: CartProduct | null = addable
    ? {
        id: item.id,
        title: item.title,
        slug: item.slug,
        price: item.price as number,
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
    <article className={'deba-product-card' + (unavailable ? ' is-unavailable' : '')}>
      <div className="deba-product-media">
        <Link
          href={'/products/' + encodeURIComponent(item.slug)}
          className="deba-product-image-link"
          aria-label={'عرض ' + item.title}
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.imageAlt}
              fill
              priority={priority}
              sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 280px"
            />
          ) : (
            <div className="deba-product-placeholder">
              <PackageCheck size={34} strokeWidth={1.5} aria-hidden="true" />
              <span>DEBA</span>
            </div>
          )}

          <span className="deba-product-badge sale">
            <BadgeCheck size={12} aria-hidden="true" />
            {condition}
          </span>

          {unavailable ? (
            <span className="deba-product-unavailable">
              غير متاح حالياً
            </span>
          ) : null}

          {lowStock ? (
            <span className="deba-product-low-stock">
              كمية محدودة
            </span>
          ) : null}
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
          {location ? (
            <span className="deba-product-location">
              <MapPin size={12} aria-hidden="true" />
              {location}
            </span>
          ) : null}
        </div>

        <Link
          href={'/products/' + encodeURIComponent(item.slug)}
          className="deba-product-title"
        >
          {item.title}
        </Link>

        {item.description ? (
          <p className="deba-product-description">
            {item.description.length > 92
              ? item.description.slice(0, 92) + '…'
              : item.description}
          </p>
        ) : null}

        <div className="deba-product-price">
          <div>
            <span>السعر</span>
            <strong>{formatPrice(item)}</strong>
          </div>
        </div>

        {sellerName ? (
          <div className="deba-product-seller">
            <div className="deba-product-seller-avatar">
              {item.sellerAvatar ? (
                <img
                  src={item.sellerAvatar}
                  alt=""
                  width={28}
                  height={28}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                (sellerName.charAt(0) || 'D').toUpperCase()
              )}
            </div>
            <span className="deba-product-seller-name">{sellerName}</span>
            {item.sellerVerified ? (
              <BadgeCheck
                size={15}
                className="deba-product-verified"
                aria-label="بائع موثق"
              />
            ) : null}
          </div>
        ) : null}

        {deliveryLabel(item.deliveryMethod) ? (
          <div className="deba-product-delivery">
            <Truck size={14} aria-hidden="true" />
            <span>{deliveryLabel(item.deliveryMethod)}</span>
          </div>
        ) : null}

        {cartProduct ? (
          <AddToCartButton
            product={cartProduct}
            disabled={unavailable}
          />
        ) : (
          <Link
            href={'/products/' + encodeURIComponent(item.slug)}
            className="deba-product-action"
          >
            <PackageCheck size={16} aria-hidden="true" />
            {unavailable ? 'غير متاح' : 'عرض المنتج'}
          </Link>
        )}
      </div>
    </article>
  )
}
