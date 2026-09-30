import 'server-only'

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hasEqualSecret(actual: string, expected: string) {
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)

  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export async function POST(request: Request) {
  const configuredSecret = process.env.DEBA_BUYER_INTENT_WEBHOOK_SECRET?.trim()

  if (!configuredSecret) {
    return NextResponse.json({ error: 'محرك المطابقة الداخلية غير مهيأ.' }, { status: 503 })
  }

  const receivedSecret =
    request.headers.get('x-deba-buyer-intent-secret')?.trim() || ''

  if (!receivedSecret || !hasEqualSecret(receivedSecret, configuredSecret)) {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 })
  }

  let payload: { product_id?: unknown }
  try {
    payload = (await request.json()) as { product_id?: unknown }
  } catch {
    return NextResponse.json({ error: 'Payload غير صالح.' }, { status: 400 })
  }

  const productId =
    typeof payload.product_id === 'string' ? payload.product_id.trim() : ''

  if (!productId) {
    return NextResponse.json({ error: 'معرّف الإعلان مطلوب.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('process_buyer_intent_matches', {
    p_product_id: productId,
    p_limit: 500,
  })

  if (error) {
    console.error('DEBA buyer intent processor failed', error)
    return NextResponse.json({ error: 'تعذر معالجة مطابقات المشترين.' }, { status: 503 })
  }

  return NextResponse.json({
    ok: true,
    productId,
    matchesCreated: Number(data || 0),
  })
}
