'use client'

import { ChevronLeft, ChevronRight, ExternalLink, Play, VolumeX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './HeaderReelsRail.module.css'

export type HeaderPromo = {
  id: string
  title: string
  subtitle: string | null
  mediaType: 'image' | 'video'
  mediaUrl: string
  posterUrl: string | null
  targetUrl: string
  ctaLabel: string
  altText: string
}

type HeaderReelsRailProps = {
  items?: HeaderPromo[]
}

export default function HeaderReelsRail({ items = [] }: HeaderReelsRailProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  const safeItems = useMemo(
    () => items.filter((item) => item.mediaUrl && item.targetUrl),
    [items],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener?.('change', sync)

    return () => mediaQuery.removeEventListener?.('change', sync)
  }, [])

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, safeItems.length - 1)))
  }, [safeItems.length])

  useEffect(() => {
    if (safeItems.length < 2 || paused || reducedMotion) return

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % safeItems.length)
    }, 5500)

    return () => window.clearInterval(timer)
  }, [paused, reducedMotion, safeItems.length])

  useEffect(() => {
    const viewport = viewportRef.current
    const active = viewport?.querySelector<HTMLElement>(
      '[data-active="true"]',
    )
    if (!viewport || !active) return

    active.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeIndex, reducedMotion])

  if (!safeItems.length) return null

  const move = (direction: -1 | 1) => {
    setPaused(true)
    setActiveIndex(
      (current) => (current + direction + safeItems.length) % safeItems.length,
    )
  }

  return (
    <section
      className={styles.rail}
      aria-label="الإعلانات والعروض"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false)
        }
      }}
    >
      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>DEBA ADS</span>
            <h2>عروض وإعلانات مختارة</h2>
          </div>

          {safeItems.length > 1 ? (
            <div className={styles.controls}>
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="الإعلان السابق"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="الإعلان التالي"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        <div ref={viewportRef} className={styles.viewport}>
          {safeItems.map((item, index) => {
            const external = /^https?:\/\//i.test(item.targetUrl)
            const isActive = index === activeIndex

            const media = item.mediaType === 'video' ? (
              <video
                className={styles.media}
                src={item.mediaUrl}
                poster={item.posterUrl || undefined}
                muted
                loop
                playsInline
                autoPlay={isActive && !reducedMotion}
                preload={isActive ? 'auto' : 'metadata'}
                aria-label={item.altText}
              />
            ) : (
              <img
                className={styles.media}
                src={item.mediaUrl}
                alt={item.altText}
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            )

            const content = (
              <>
                <div className={styles.mediaWrap}>
                  {media}
                  {item.mediaType === 'video' ? (
                    <span className={styles.videoMark} aria-hidden="true">
                      <Play size={13} fill="currentColor" />
                      <VolumeX size={13} />
                    </span>
                  ) : null}
                  <span className={styles.sponsored}>إعلان</span>
                  <span className={styles.gradient} aria-hidden="true" />
                </div>

                <div className={styles.content}>
                  <strong>{item.title}</strong>
                  {item.subtitle ? <span>{item.subtitle}</span> : null}
                  <span className={styles.cta}>
                    {item.ctaLabel}
                    {external ? <ExternalLink size={13} aria-hidden="true" /> : null}
                  </span>
                </div>
              </>
            )

            return external ? (
              <a
                key={item.id}
                href={item.targetUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className={styles.card}
                data-active={isActive}
                aria-label={item.title}
                onClick={() => setActiveIndex(index)}
              >
                {content}
              </a>
            ) : (
              <a
                key={item.id}
                href={item.targetUrl}
                className={styles.card}
                data-active={isActive}
                aria-label={item.title}
                onClick={() => setActiveIndex(index)}
              >
                {content}
              </a>
            )
          })}
        </div>

        {safeItems.length > 1 ? (
          <div className={styles.dots} aria-label="التنقل بين الإعلانات">
            {safeItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === activeIndex ? styles.dotActive : styles.dot}
                aria-label={'الانتقال إلى الإعلان ' + (index + 1)}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => {
                  setPaused(true)
                  setActiveIndex(index)
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
