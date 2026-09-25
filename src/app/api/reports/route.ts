import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { consumeApiRateLimit } from '@/utils/rateLimit'

const ALLOWED_REASONS = new Set([
  'spam',
  'fraud',
  'prohibited_item',
  'misleading',
  'other',
])

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول للإبلاغ عن إعلان.' }, { status: 401 })
    }

    const rateLimit = await consumeApiRateLimit(
      supabase,
      userData.user.id,
      'reports:create',
      5,
      3600,
    )
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'تم تجاوز حد البلاغات مؤقتًا. حاول لاحقًا.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.windowSeconds) } },
      )
    }

    const body = (await request.json().catch(() => null)) as {
      productId?: string
      reason?: string
      description?: string
    } | null

    const productId = body?.productId?.trim() || ''
    const rawReason = body?.reason?.trim() || ''
    const reasonAliasMap: Record<string, string> = {
      scam: 'fraud',
      prohibited: 'prohibited_item',
      duplicate: 'spam',
    }
    const reason = reasonAliasMap[rawReason] || rawReason
    const description = body?.description?.trim().slice(0, 2000) || null

    if (!productId || !reason || !ALLOWED_REASONS.has(reason)) {
      return NextResponse.json({ error: 'اختر سببًا صحيحًا للإبلاغ.' }, { status: 400 })
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id,owner_id')
      .eq('id', productId)
      .maybeSingle()

    if (productError) {
      console.error('DEBA report product lookup failed', productError)
      return NextResponse.json({ error: 'تعذر التحقق من الإعلان.' }, { status: 500 })
    }

    if (!product) {
      return NextResponse.json({ error: 'الإعلان غير موجود.' }, { status: 404 })
    }

    if (product.owner_id === userData.user.id) {
      return NextResponse.json({ error: 'لا يمكنك الإبلاغ عن إعلانك الخاص.' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', userData.user.id)
      .eq('product_id', productId)
      .eq('status', 'open')
      .limit(1)
      .maybeSingle()

    if (existingError) {
      console.error('DEBA report duplicate lookup failed', existingError)
      return NextResponse.json({ error: 'تعذر التحقق من البلاغات السابقة.' }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json(
        { error: 'تم تسجيل بلاغ مفتوح لهذا الإعلان بالفعل.', reportId: existing.id },
        { status: 409 },
      )
    }

    const { data: report, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: userData.user.id,
        product_id: productId,
        reported_user_id: product.owner_id,
        reason,
        description,
        status: 'open',
      })
      .select('id,product_id,reason,status,created_at')
      .single()

    if (error) {
      console.error('DEBA report creation failed', error)
      return NextResponse.json({ error: 'تعذر إرسال البلاغ الآن.' }, { status: 500 })
    }

    return NextResponse.json({ report }, { status: 201 })
  } catch (error) {
    console.error('DEBA reports POST failed', error)
    return NextResponse.json({ error: 'تعذر إرسال البلاغ.' }, { status: 500 })
  }
}
