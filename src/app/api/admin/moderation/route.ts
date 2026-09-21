import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type ActionBody = {
  action?:
    | 'approve_product'
    | 'reject_product'
    | 'publish_review'
    | 'hide_review'
    | 'resolve_report'
    | 'dismiss_report'
  id?: string
  note?: string
}

async function requireModerator() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return { supabase, user: null, allowed: false }

  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'moderator'])
    .limit(1)
    .maybeSingle()

  return { supabase, user, allowed: Boolean(role) }
}

export async function GET() {
  try {
    const { user, allowed } = await requireModerator()
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    if (!allowed) return NextResponse.json({ error: 'لا تملك صلاحية الإدارة.' }, { status: 403 })

    const admin = createAdminClient()

    const [productsResult, reviewsResult, reportsResult] = await Promise.all([
      admin
        .from('products')
        .select(
          'id,title,slug,owner_id,price,currency,listing_type,status,moderation_status,details_schema_version,created_at,updated_at',
        )
        .eq('moderation_status', 'pending')
        .order('created_at', { ascending: true })
        .limit(100),
      admin
        .from('reviews')
        .select(
          'id,order_id,reviewer_id,product_id,seller_id,rating,title,body,status,verified_purchase,created_at',
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(100),
      admin
        .from('reports')
        .select(
          'id,reporter_id,product_id,reported_user_id,reason,description,status,resolution_note,created_at,updated_at',
        )
        .eq('status', 'open')
        .order('created_at', { ascending: true })
        .limit(100),
    ])

    if (productsResult.error || reviewsResult.error || reportsResult.error) {
      console.error('DEBA moderation queue lookup failed', {
        products: productsResult.error,
        reviews: reviewsResult.error,
        reports: reportsResult.error,
      })
      return NextResponse.json({ error: 'تعذر تحميل قائمة المراجعة.' }, { status: 500 })
    }

    const userIds = Array.from(
      new Set([
        ...(productsResult.data || []).map((row) => row.owner_id).filter(Boolean),
        ...(reviewsResult.data || []).map((row) => row.reviewer_id).filter(Boolean),
        ...(reportsResult.data || []).map((row) => row.reporter_id).filter(Boolean),
        ...(reportsResult.data || []).map((row) => row.reported_user_id).filter(Boolean),
      ]),
    ) as string[]

    const productIds = Array.from(
      new Set([
        ...(reviewsResult.data || []).map((row) => row.product_id).filter(Boolean),
        ...(reportsResult.data || []).map((row) => row.product_id).filter(Boolean),
      ]),
    ) as string[]

    const [profilesResult, productsByIdResult] = await Promise.all([
      userIds.length
        ? admin.from('profiles').select('id,username,display_name').in('id', userIds)
        : Promise.resolve({ data: [] as Array<{ id: string; username: string | null; display_name: string | null }> }),
      productIds.length
        ? admin.from('products').select('id,title,slug').in('id', productIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string; slug: string }> }),
    ])

    const profileMap = new Map(
      (profilesResult.data || []).map((profile) => [profile.id, profile]),
    )
    const productMap = new Map(
      (productsByIdResult.data || []).map((product) => [product.id, product]),
    )

    return NextResponse.json({
      products: productsResult.data || [],
      reviews: (reviewsResult.data || []).map((review) => ({
        ...review,
        reviewer: profileMap.get(review.reviewer_id) || null,
        product: review.product_id ? productMap.get(review.product_id) || null : null,
      })),
      reports: (reportsResult.data || []).map((report) => ({
        ...report,
        reporter: report.reporter_id ? profileMap.get(report.reporter_id) || null : null,
        reportedUser: report.reported_user_id
          ? profileMap.get(report.reported_user_id) || null
          : null,
        product: report.product_id ? productMap.get(report.product_id) || null : null,
      })),
    })
  } catch (error) {
    console.error('DEBA moderation GET failed', error)
    return NextResponse.json({ error: 'تعذر تحميل قائمة المراجعة.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    const requestOrigin = new URL(request.url).origin
    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 403 })
    }

    const body = (await request.json()) as ActionBody
    const action = body.action
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const note =
      typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : ''

    if (!action || !id) {
      return NextResponse.json({ error: 'بيانات العملية غير مكتملة.' }, { status: 400 })
    }

    const { user, allowed } = await requireModerator()
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    if (!allowed) return NextResponse.json({ error: 'لا تملك صلاحية الإدارة.' }, { status: 403 })

    const admin = createAdminClient()
    let entityType = ''
    let beforeData: Record<string, unknown> | null = null
    let afterData: Record<string, unknown> | null = null
    let table = ''

    if (action === 'approve_product' || action === 'reject_product') {
      table = 'product'
      const { data: product, error } = await admin
        .from('products')
        .select('id,title,status,moderation_status,published_at,sold_at')
        .eq('id', id)
        .maybeSingle()

      if (error || !product) {
        return NextResponse.json({ error: 'الإعلان غير موجود.' }, { status: 404 })
      }

      beforeData = product
      const approved = action === 'approve_product'
      const update = approved
        ? {
            moderation_status: 'approved',
            status: product.status === 'sold' ? 'sold' : 'published',
            published_at: product.published_at || new Date().toISOString(),
          }
        : {
            moderation_status: 'rejected',
            status: 'draft',
          }

      const { data: updated, error: updateError } = await admin
        .from('products')
        .update(update)
        .eq('id', id)
        .select('id,title,status,moderation_status,published_at,sold_at')
        .single()

      if (updateError || !updated) {
        console.error('DEBA product moderation update failed', updateError)
        return NextResponse.json(
          { error: 'تعذر تحديث حالة الإعلان.' },
          { status: 500 },
        )
      }

      afterData = updated
      entityType = 'product'
    } else if (action === 'publish_review' || action === 'hide_review') {
      table = 'review'
      const { data: review, error } = await admin
        .from('reviews')
        .select('id,status,rating,product_id,seller_id')
        .eq('id', id)
        .maybeSingle()

      if (error || !review) {
        return NextResponse.json({ error: 'التقييم غير موجود.' }, { status: 404 })
      }

      beforeData = review
      const { data: updated, error: updateError } = await admin
        .from('reviews')
        .update({ status: action === 'publish_review' ? 'published' : 'hidden' })
        .eq('id', id)
        .select('id,status,rating,product_id,seller_id')
        .single()

      if (updateError || !updated) {
        console.error('DEBA review moderation update failed', updateError)
        return NextResponse.json(
          { error: 'تعذر تحديث حالة التقييم.' },
          { status: 500 },
        )
      }

      afterData = updated
      entityType = 'review'
    } else if (action === 'resolve_report' || action === 'dismiss_report') {
      table = 'report'
      const { data: report, error } = await admin
        .from('reports')
        .select('id,status,resolution_note,product_id,reported_user_id')
        .eq('id', id)
        .maybeSingle()

      if (error || !report) {
        return NextResponse.json({ error: 'البلاغ غير موجود.' }, { status: 404 })
      }

      beforeData = report
      const { data: updated, error: updateError } = await admin
        .from('reports')
        .update({
          status: action === 'resolve_report' ? 'resolved' : 'dismissed',
          resolution_note: note || null,
        })
        .eq('id', id)
        .select('id,status,resolution_note,product_id,reported_user_id')
        .single()

      if (updateError || !updated) {
        console.error('DEBA report moderation update failed', updateError)
        return NextResponse.json(
          { error: 'تعذر تحديث حالة البلاغ.' },
          { status: 500 },
        )
      }

      afterData = updated
      entityType = 'report'
    } else {
      return NextResponse.json({ error: 'عملية إدارية غير معروفة.' }, { status: 400 })
    }

    await admin.from('admin_logs').insert({
      actor_user_id: user.id,
      action: action,
      entity_type: entityType,
      entity_id: id,
      before_data: beforeData,
      after_data: afterData,
      metadata: {
        note,
        source: 'admin_moderation',
        table,
      },
    })

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'moderation.' + action,
      entity_type: entityType,
      entity_id: id,
      before_data: beforeData,
      after_data: afterData,
      metadata: { note },
    })

    return NextResponse.json({ ok: true, id, action })
  } catch (error) {
    console.error('DEBA moderation POST failed', error)
    return NextResponse.json({ error: 'تعذر تنفيذ العملية الإدارية.' }, { status: 500 })
  }
}
