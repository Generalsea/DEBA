import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LegacyCheckoutRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let normalizedSlug = slug
  try {
    normalizedSlug = decodeURIComponent(slug)
  } catch {
    // Keep the original route value when decoding is not possible.
  }

  redirect('/products/' + encodeURIComponent(normalizedSlug))
}
