import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DEBA | Marketplace مصري - بيع، شراء، تبرع',
  description: 'DEBA — منصة مصرية للبيع والشراء والتبرع بالسلع غير المستخدمة.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="theme-color" content="#FF6B35" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
