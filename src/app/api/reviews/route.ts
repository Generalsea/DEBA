import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type ReviewBody = {
  orderId?: string
  targetType?: 'product' | 'seller'
  targetId?: string
  rating?: number
  title?: string
  body?: string
  idempotencyKey?: string
}

type ReviewRow = {
  id: string
  order_id: string
  reviewer_id: string
  target_type: 'product' | 'seller'
  target_id: string
  product_id: string | null
  seller_id: string | null
  rating: number
  title: string | null
  body: string | null
  status: 'pending' | 'published' | 'hidden'
  verified_purchase: boolean
  created_at: string
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function mapError(message: string) {
  const value = message.toLowerCase()

  if (value.includes('order not found') || value.includes('product was not part')) {
    return { status: 404, error: 'لا يمكن ربط التقييم بهذا الطلب.' }
  }

  if (
    value.includes('reviewer is required') ||
    value.includes('not allowed') ||
    value.includes('available after order completion')
  ) {
    return { status: 403, error: 'لا يمكنك إضافة هذا التقييم في حالة الطلب الحالية.' }
  }

  if (value.includes('rating') || value.includes('target') || value.includes('idempotency')) {
    return { status: 400, error: 'بيانات التقييم غير صالحة.' }
  }

  return { status: 500, error: 'تعذر حفظ التقييم الآن.' }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const productId = clean(url.searchParams.get('productId'), 64)

    if (!productId) {
      return NextResponse.json({ error: 'معرّف المنتج غير صالح.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_product_review_feed', {
      p_product_id: productId,
    })

    if (error) {
      console.error('DEBA review feed lookup failed', error)
      return NextResponse.json({ error: 'تعذر تحميل التقييمات.' }, { status: 500 })
    }

    const feed = (data as {
      reviews?: Array<{
        id: string
        rating: number
        title: string | null
        body: string | null
        verifiedPurchase: boolean
        createdAt: string
        reviewer?: {
          display_name: string | null
          username: string | null
          avatar_url: string | null
        } | null
      }>
      average_rating?: number
      review_count?: number
      breakdown?: Array<{ rating: number; count: number }>
      can_review?: boolean
      review_order_id?: string | null
      pending_mine?: boolean
    } | null) || {}

    return NextResponse.json({
      reviews: Array.isArray(feed.reviews) ? feed.reviews : [],
      averageRating: Number(feed.average_rating || 0),
      reviewCount: Number(feed.review_count || 0),
      breakdown: Array.isArray(feed.breakdown) ? feed.breakdown : [],
      canReview: feed.can_review === true,
      reviewOrderId: feed.review_order_id || null,
      pendingMine: feed.pending_mine === true,
    })
  } catch (error) {
    console.error('DEBA reviews GET failed', error)
    return NextResponse.json({ error: 'تعذر تحميل التقييمات.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    const requestOrigin = new URL(request.url).origin

    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
    }

    const body = (await request.json()) as ReviewBody
    const orderId = clean(body.orderId, 64)
    const targetId = clean(body.targetId, 64)
    const targetType = body.targetType
    const title = clean(body.title, 120)
    const reviewBody = clean(body.body, 2000)
    const idempotencyKey =
      clean(request.headers.get('idempotency-key'), 128) ||
      clean(body.idempotencyKey, 128)

    const rating =
      typeof body.rating === 'number' && Number.isInteger(body.rating)
        ? body.rating
        : 0

    if (
      !orderId ||
      !targetId ||
      (targetType !== 'product' && targetType !== 'seller') ||
      rating < 1 ||
      rating > 5 ||
      idempotencyKey.length < 16 ||
      !reviewBody
    ) {
      return NextResponse.json(
        { error: 'أدخل تقييمًا صحيحًا وتعليقًا مرتبطًا بالطلب.' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول لإضافة تقييم.' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('create_review', {
      p_order_id: orderId,
      p_target_type: targetType,
      p_target_id: targetId,
      p_rating: rating,
      p_title: title || null,
      p_body: reviewBody,
      p_idempotency_key: idempotencyKey,
    })

    if (error) {
      console.error('DEBA review creation failed', error)
      const mapped = mapError(error.message || '')
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('DEBA reviews POST failed', error)
    return NextResponse.json({ error: 'تعذر حفظ التقييم.' }, { status: 500 })
  }
}
