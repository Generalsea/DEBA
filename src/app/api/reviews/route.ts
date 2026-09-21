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
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id || null

    const { data: rows, error } = await supabase
      .from('reviews')
      .select(
        'id,order_id,reviewer_id,target_type,target_id,product_id,seller_id,rating,title,body,status,verified_purchase,created_at',
      )
      .eq('product_id', productId)
      .eq('target_type', 'product')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('DEBA review lookup failed', error)
      return NextResponse.json({ error: 'تعذر تحميل التقييمات.' }, { status: 500 })
    }

    const reviewRows = (rows || []) as ReviewRow[]
    const publicRows = reviewRows.filter((row) => row.status === 'published')
    const userRows = userId
      ? reviewRows.filter((row) => row.reviewer_id === userId)
      : []

    let canReview = false
    let reviewOrderId: string | null = null

    if (userId) {
      const { data: completedOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('buyer_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(100)

      if (!ordersError && completedOrders?.length) {
        const orderIds = completedOrders.map((row) => row.id)
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id')
          .in('order_id', orderIds)
          .eq('product_id', productId)
          .limit(1)

        reviewOrderId = items?.[0]?.order_id || null

        if (reviewOrderId) {
          canReview = !userRows.some(
            (row) =>
              row.order_id === reviewOrderId &&
              row.target_type === 'product' &&
              row.target_id === productId,
          )
        }
      }
    }

    const breakdown = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: publicRows.filter((row) => row.rating === rating).length,
    }))

    const averageRating = publicRows.length
      ? publicRows.reduce((sum, row) => sum + row.rating, 0) / publicRows.length
      : 0

    const reviewerIds = Array.from(
      new Set(publicRows.map((row) => row.reviewer_id)),
    )

    const { data: profiles } = reviewerIds.length
      ? await supabase
          .from('profiles')
          .select('id,display_name,username,avatar_url')
          .in('id', reviewerIds)
      : { data: [] as Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }> }

    const profileMap = new Map(
      (profiles || []).map((profile) => [profile.id, profile]),
    )

    return NextResponse.json({
      reviews: publicRows.map((row) => ({
        id: row.id,
        orderId: row.order_id,
        rating: row.rating,
        title: row.title,
        body: row.body,
        verifiedPurchase: row.verified_purchase,
        createdAt: row.created_at,
        reviewer: profileMap.get(row.reviewer_id) || {
          id: row.reviewer_id,
          display_name: null,
          username: null,
          avatar_url: null,
        },
      })),
      averageRating: Number(averageRating.toFixed(2)),
      reviewCount: publicRows.length,
      breakdown,
      canReview,
      reviewOrderId,
      pendingMine: userRows.some((row) => row.status === 'pending'),
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
      body.targetType !== 'product' ||
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
      p_target_type: 'product',
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
