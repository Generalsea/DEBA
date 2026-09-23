import type { MetadataRoute } from 'next'

function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  return (configured && /^https?:\/\//i.test(configured) ? configured : 'http://localhost:3000').replace(/\/$/, '')
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/profile',
          '/cart',
          '/checkout',
          '/orders/',
          '/sell',
          '/support',
          '/payment/',
          '/login',
        ],
      },
    ],
    sitemap: base + '/sitemap.xml',
  }
}
