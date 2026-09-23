import type { MetadataRoute } from 'next'
import { createClient } from '@/utils/supabase/server'

function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  return (configured && /^https?:\/\//i.test(configured) ? configured : 'http://localhost:3000').replace(/\/$/, '')
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from('products')
    .select('slug,published_at,updated_at')
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .eq('listing_type', 'sale')
    .not('slug', 'is', null)
    .order('published_at', { ascending: false })
    .range(0, 49999)

  if (error) {
    console.error('DEBA sitemap product lookup failed', error)
  }

  const base = siteUrl()
  const now = new Date()

  return [
    {
      url: base + '/',
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    ...((products || []).map((product) => ({
      url: base + '/products/' + encodeURIComponent(product.slug),
      lastModified: product.updated_at || product.published_at || now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))),
  ]
}
