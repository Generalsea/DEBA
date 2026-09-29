import { NextResponse } from 'next/server'
import { generateEmbedding, embeddingToPgVector } from '@/lib/embeddings/provider'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function POST(
  request: Request,
  { params }: RouteParams,
) {
  const { id: productId } = await params

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

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id,owner_id')
    .eq('id', productId)
    .maybeSingle()

  if (productError) {
    console.error('DEBA semantic embedding product lookup failed', productError)
    return NextResponse.json({ error: 'تعذر تحميل الإعلان.' }, { status: 500 })
  }

  if (!product || product.owner_id !== user.id) {
    return NextResponse.json({ error: 'لا تملك صلاحية فهرسة هذا الإعلان.' }, { status: 403 })
  }

  try {
    const admin = createAdminClient()
    const { data: source, error: sourceError } = await admin.rpc(
      'get_product_embedding_source',
      { p_product_id: productId },
    )

    if (sourceError || typeof source !== 'string' || !source.trim()) {
      console.error('DEBA semantic embedding source lookup failed', sourceError)
      return NextResponse.json(
        { error: 'تعذر تجهيز نص الإعلان للفهرسة الدلالية.' },
        { status: 500 },
      )
    }

    const generated = await generateEmbedding(source)

    const { data: stored, error: storeError } = await admin.rpc(
      'upsert_product_embedding',
      {
        p_product_id: productId,
        p_embedding: embeddingToPgVector(generated.embedding),
        p_model: generated.model,
      },
    )

    if (storeError) {
      console.error('DEBA semantic embedding persistence failed', storeError)
      return NextResponse.json(
        { error: 'تعذر حفظ الـEmbedding.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      ...stored,
    })
  } catch (error) {
    console.error('DEBA semantic embedding generation failed', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'تعذر إنشاء الـEmbedding.',
      },
      { status: 503 },
    )
  }
}
