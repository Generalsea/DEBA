import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const ALLOWED_REASONS = new Set([
  'spam',
  'scam',
  'prohibited',
  'misleading',
  'duplicate',
  'other',
])

const REASON_LABELS: Record<string, string> = {
  spam: 'إعلان مزعج أو مكرر',
  scam: 'اشتباه احتيال',
  prohibited: 'محتوى أو سلعة محظورة',
  misleading: 'وصف أو سعر مضلل',
  duplicate: 'إعلان مكرر',
  other: 'سبب آخر',
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول للإبلاغ عن إعلان.' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as {
      productId?: string
      reason?: string
      description?: string
    } | null

    const productId = body?.productId?.trim() || ''
    const reason = body?.reason?.trim() || ''
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
        reason: reason + ': ' + REASON_LABELS[reason],
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
