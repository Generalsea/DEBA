'use client'

import Image from 'next/image'
import { Check, ChevronLeft, ChevronRight, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'

export type ProductGalleryImage = {
  id: string
  url: string
  alt: string
}

type ProductGalleryProps = {
  images: ProductGalleryImage[]
  productTitle: string
}

export default function ProductGallery({ images, productTitle }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)

  const activeImage = images[activeIndex] || null

  async function shareProduct() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (!url) return

    try {
      if (navigator.share) {
        await navigator.share({ title: productTitle, url })
        return
      }

      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // User cancelled native share or clipboard permission was denied.
    }
  }

  function changeIndex(delta: number) {
    if (!images.length) return
    setActiveIndex((current) => (current + delta + images.length) % images.length)
    setIsZoomed(false)
  }

  return (
    <section className="deba-gallery" aria-label="صور المنتج">
      <div className="deba-gallery-main">
        {activeImage ? (
          <Image
            src={activeImage.url}
            alt={activeImage.alt}
            fill
            priority
            onClick={() => setIsZoomed((value) => !value)}
            className={'deba-gallery-main-image' + (isZoomed ? ' is-zoomed' : '')}
            sizes="(max-width: 900px) 100vw, 58vw"
          />
        ) : (
          <div className="deba-gallery-fallback">
            <span>DEBA</span>
            <small>لا توجد صور إضافية لهذا المنتج</small>
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              className="deba-gallery-arrow deba-gallery-arrow-right"
              aria-label="الصورة التالية"
              onClick={() => changeIndex(1)}
            >
              <ChevronRight size={20} />
            </button>
            <button
              type="button"
              className="deba-gallery-arrow deba-gallery-arrow-left"
              aria-label="الصورة السابقة"
              onClick={() => changeIndex(-1)}
            >
              <ChevronLeft size={20} />
            </button>
          </>
        )}

        {activeImage && (
          <button
            type="button"
            className="deba-gallery-zoom"
            onClick={() => setIsZoomed((value) => !value)}
            aria-label={isZoomed ? 'تصغير الصورة' : 'تكبير الصورة'}
          >
            {isZoomed ? 'تصغير' : 'تكبير'}
          </button>
        )}

        <button type="button" className="deba-gallery-share" onClick={shareProduct}>
          {copied ? <Check size={16} /> : <Share2 size={16} />}
          <span>{copied ? 'تم نسخ الرابط' : 'مشاركة'}</span>
        </button>
      </div>

      {images.length > 1 && (
        <div className="deba-gallery-thumbs">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className={'deba-gallery-thumb' + (index === activeIndex ? ' is-active' : '')}
              onClick={() => {
                setActiveIndex(index)
                setIsZoomed(false)
              }}
              aria-label={'عرض صورة ' + (index + 1)}
              aria-pressed={index === activeIndex}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="96px"
              />
            </button>
          ))}
        </div>
      )}

      <div className="deba-gallery-meta">
        <span>صور المنتج {images.length ? images.length.toLocaleString('ar-EG') : '٠'}</span>
        <button type="button" onClick={shareProduct}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'الرابط منسوخ' : 'نسخ رابط المنتج'}
        </button>
      </div>
    </section>
  )
}
