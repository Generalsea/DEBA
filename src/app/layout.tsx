import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import './future-marketplace.css'
import './future-marketplace-overrides.css'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '')

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'DEBA | Marketplace مصري - بيع، شراء، تبرع',
    template: '%s | DEBA',
  },
  description: 'DEBA — منصة مصرية للبيع والشراء والتبادل والتبرع بالسلع غير المستخدمة.',
  alternates: {
    canonical: '/',
  },
}

const themeBootstrap = `
try {
  const saved = localStorage.getItem('deba-theme')
  const theme =
    saved === 'light' || saved === 'dark'
      ? saved
      : window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
} catch {}
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DEBA',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: SITE_URL + '/?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="theme-color" content="#FF6B35" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body>
        {children}
        <Script id="deba-theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
      </body>
    </html>
  )
}
