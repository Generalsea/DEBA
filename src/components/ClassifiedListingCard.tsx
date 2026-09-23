'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart, MapPin, MessageCircle, PackageSearch, Tag, UserRound } from 'lucide-react'
import FavoriteButton from '@/components/FavoriteButton'

export type ClassifiedListingItem = {
  id: string
  slug: string
  title: string
  price: number | null
  currency: string
  conditionLabel: string
  city: string | null
  governorate: string | null
  categoryName: string | null
  imageUrl: string | null
  imageAlt: string
  sellerName: string
  sellerAvatar: string | null
  ratingValue?: number | null
  ratingCount?: number
  publishedAt?: string | null
}

function formatPrice(value: number | null, currency: string) {
  if (value === null) return 'السعر عند التواصل'
  return (
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value) +
    ' ' +
    (currency || 'جنيه')
  )
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return 'حديثًا'

  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 'حديثًا'

  const diff = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'الآن'
  if (minutes < 60) return 'منذ ' + minutes + ' دقيقة'
  if (hours < 24) return 'منذ ' + hours + ' ساعة'
  if (days === 1) return 'منذ يوم'
  if (days < 7) return 'منذ ' + days + ' أيام'
  if (days < 30) return 'منذ ' + Math.floor(days / 7) + ' أسبوع'
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(timestamp)
}

function listingLocation(item: ClassifiedListingItem) {
  return [item.city, item.governorate].filter(Boolean).join('، ') || 'مصر'
}

export default function ClassifiedListingCard({
  item,
  priority = false,
}: {
  item: ClassifiedListingItem
  priority?: boolean
}) {
  const detailHref = '/products/' + encodeURIComponent(item.slug)
  const chatHref = '/chat?product=' + encodeURIComponent(item.id)

  return (
    <article className="deba-classified-listing-card">
      <div className="deba-classified-listing-image">
        <Link href={detailHref} aria-label={'عرض ' + item.title}>
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.imageAlt}
              fill
              priority={priority}
              sizes="(max-width: 480px) 46vw, (max-width: 768px) 47vw, (max-width: 1200px) 31vw, 280px"
            />
          ) : (
            <div className="deba-classified-listing-placeholder">
              <PackageSearch size={34} strokeWidth={1.6} aria-hidden="true" />
              <span>DEBA</span>
            </div>
          )}
        </Link>

        <FavoriteButton
          productId={item.id}
          initialFavorite={false}
          label="أضف الإعلان إلى المفضلة"
          className="deba-classified-listing-favorite"
        />

        <span
          className={
            'deba-classified-listing-badge' +
            (item.conditionLabel === 'جديد' ? ' condition-new' : ' condition-used')
          }
        >
          {item.conditionLabel}
        </span>
      </div>

      <div className="deba-classified-listing-info">
        <Link href={detailHref} className="deba-classified-listing-title">
          {item.title}
        </Link>

        <div className="deba-classified-listing-price">
          {formatPrice(item.price, item.currency).replace(/\s?EGP$/, ' جنيه')}
          {item.price !== null ? <span className="currency">جنيه</span> : null}
        </div>

        <div className="deba-classified-listing-meta">
          <span className="deba-classified-listing-location">
            <MapPin size={12} strokeWidth={2} aria-hidden="true" />
            {listingLocation(item)}
          </span>
          <span>{formatRelativeTime(item.publishedAt)}</span>
        </div>

        <div className="deba-classified-listing-seller">
          <span className="deba-classified-seller-avatar">
            {item.sellerAvatar ? (
              <img
                src={item.sellerAvatar}
                alt=""
                width={32}
                height={32}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <UserRound size={15} aria-hidden="true" />
            )}
          </span>

          <span className="deba-classified-seller-info">
            <span className="deba-classified-seller-name">{item.sellerName}</span>
            {item.ratingValue !== null && item.ratingValue !== undefined && (item.ratingCount ?? 0) > 0 ? (
              <span className="deba-classified-seller-rating">
                ⭐ {item.ratingValue.toLocaleString('ar-EG', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                ({item.ratingCount?.toLocaleString('ar-EG')})
              </span>
            ) : (
              <span className="deba-classified-seller-rating">عضو في DEBA</span>
            )}
          </span>
        </div>

        <div className="deba-classified-listing-actions">
          <Link href={chatHref} className="deba-classified-btn-contact">
            <MessageCircle size={15} aria-hidden="true" />
            تواصل مع البائع
          </Link>

          <Link
            href={chatHref}
            className="deba-classified-btn-offer"
            title="ابدأ التفاوض مع البائع"
          >
            <Tag size={14} aria-hidden="true" />
            عرض
          </Link>
        </div>
      </div>
    </article>
  )
}
