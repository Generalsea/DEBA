import { NextResponse } from 'next/server'
import { embeddingToPgVector, generateEmbedding } from '@/lib/embeddings/provider'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

function cleanQuery(value: unknown) {
  if (typeof value !== 'string') return null

  const query = value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)

  return query || null
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Origin غير مسموح.' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const query = cleanQuery(
    body && typeof body === 'object'
      ? (body as Record<string, unknown>).query
      : null,
  )

  if (!query) {
    return NextResponse.json({ error: 'Search query is required.' }, { status: 400 })
  }

  try {
    const generated = await generateEmbedding(query)
    const { data, error } = await supabase.rpc('search_marketplace_hybrid', {
      p_query: query,
      p_query_embedding: embeddingToPgVector(generated.embedding),
      p_limit: 36,
      p_offset: 0,
      p_category_slug: null,
      p_min_price: null,
      p_max_price: null,
      p_condition: null,
      p_governorate: null,
      p_city: null,
      p_rrf_k: 60,
    })

    if (error) {
      console.error('DEBA hybrid vector search failed', error)
      return NextResponse.json(
        { error: 'تعذر تنفيذ البحث الدلالي الهجين.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      query,
      embeddingModel: generated.model,
      results: data || [],
    })
  } catch (error) {
    console.error('DEBA hybrid vector search embedding failed', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'تعذر إنشاء Embedding لطلب البحث.',
      },
      { status: 503 },
    )
  }
}
