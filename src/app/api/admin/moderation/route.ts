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
    | 'review_dispute'
    | 'resolve_dispute_buyer'
    | 'resolve_dispute_seller'
    | 'close_dispute'
    | 'assign_ticket'
    | 'resolve_ticket'
    | 'close_ticket'
    | 'reply_ticket'
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

    const [productsResult, reviewsResult, reportsResult, disputesResult, ticketsResult] = await Promise.all([
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
      admin
        .from('disputes')
        .select(
          'id,order_id,raised_by,category,subject,description,status,priority,resolution_code,resolution_note,resolved_by,resolved_at,created_at,updated_at',
        )
        .in('status', ['open', 'under_review'])
        .order('created_at', { ascending: true })
        .limit(100),
      admin
        .from('support_tickets')
        .select(
          'id,user_id,order_id,category,subject,description,status,priority,assigned_to,last_response_at,resolved_at,created_at,updated_at',
        )
        .in('status', ['open', 'in_progress', 'waiting_user'])
        .order('updated_at', { ascending: true })
        .limit(100),
    ])

    if (
      productsResult.error ||
      reviewsResult.error ||
      reportsResult.error ||
      disputesResult.error ||
      ticketsResult.error
    ) {
      console.error('DEBA moderation queue lookup failed', {
        products: productsResult.error,
        reviews: reviewsResult.error,
        reports: reportsResult.error,
        disputes: disputesResult.error,
        tickets: ticketsResult.error,
      })
      return NextResponse.json({ error: 'تعذر تحميل قائمة المراجعة.' }, { status: 500 })
    }

    const userIds = Array.from(
      new Set([
        ...(productsResult.data || []).map((row) => row.owner_id).filter(Boolean),
        ...(reviewsResult.data || []).map((row) => row.reviewer_id).filter(Boolean),
        ...(reportsResult.data || []).map((row) => row.reporter_id).filter(Boolean),
        ...(reportsResult.data || []).map((row) => row.reported_user_id).filter(Boolean),
        ...(disputesResult.data || []).map((row) => row.raised_by).filter(Boolean),
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

    const disputeOrderIds = Array.from(
      new Set((disputesResult.data || []).map((row) => row.order_id).filter(Boolean)),
    ) as string[]

    const ticketUserIds = Array.from(
      new Set((ticketsResult.data || []).map((row) => row.user_id).filter(Boolean)),
    ) as string[]

    const [disputeOrdersResult, ticketProfilesResult] = await Promise.all([
      disputeOrderIds.length
        ? admin
            .from('orders')
            .select('id,reference_code,buyer_id,seller_id,payment_status,status,total,currency')
            .in('id', disputeOrderIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string
              reference_code: string
              buyer_id: string
              seller_id: string
              payment_status: string
              status: string
              total: number | string
              currency: string
            }>,
          }),
      ticketUserIds.length
        ? admin
            .from('profiles')
            .select('id,username,display_name')
            .in('id', ticketUserIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string
              username: string | null
              display_name: string | null
            }>,
          }),
    ])

    const disputeOrderMap = new Map(
      (disputeOrdersResult.data || []).map((order) => [order.id, order]),
    )
    const ticketProfileMap = new Map(
      (ticketProfilesResult.data || []).map((profile) => [profile.id, profile]),
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
      disputes: (disputesResult.data || []).map((dispute) => ({
        ...dispute,
        order: disputeOrderMap.get(dispute.order_id) || null,
        raisedBy: profileMap.get(dispute.raised_by) || null,
      })),
      tickets: (ticketsResult.data || []).map((ticket) => ({
        ...ticket,
        user: ticketProfileMap.get(ticket.user_id) || null,
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
    } else if (
      action === 'review_dispute' ||
      action === 'resolve_dispute_buyer' ||
      action === 'resolve_dispute_seller' ||
      action === 'close_dispute'
    ) {
      table = 'dispute'

      const { data: dispute, error: disputeError } = await admin
        .from('disputes')
        .select('id,order_id,status,resolution_code,resolution_note,resolved_by,resolved_at')
        .eq('id', id)
        .maybeSingle()

      if (disputeError || !dispute) {
        return NextResponse.json({ error: 'المراجعة غير موجودة.' }, { status: 404 })
      }

      const { data: order, error: orderError } = await admin
        .from('orders')
        .select('id,reference_code,status,payment_status,total,currency')
        .eq('id', dispute.order_id)
        .maybeSingle()

      if (orderError || !order) {
        return NextResponse.json({ error: 'الطلب المرتبط غير موجود.' }, { status: 404 })
      }

      beforeData = { ...dispute, order }

      let nextDisputeStatus = 'under_review'
      let nextResolutionCode: string | null = dispute.resolution_code
      let nextResolvedBy: string | null = dispute.resolved_by
      let nextResolvedAt: string | null = dispute.resolved_at

      if (action === 'resolve_dispute_seller') {
        nextDisputeStatus = 'resolved_seller'
        nextResolutionCode = 'seller_resolution'
        nextResolvedBy = user.id
        nextResolvedAt = new Date().toISOString()
      } else if (action === 'resolve_dispute_buyer') {
        const { data: successfulRefunds } = await admin
          .from('refunds')
          .select('amount')
          .eq('order_id', order.id)
          .eq('status', 'succeeded')

        const refunded = (successfulRefunds || []).reduce(
          (sum, refund) => sum + Number(refund.amount || 0),
          0,
        )
        const orderTotal = Number(order.total || 0)

        if (
          order.payment_status === 'paid' &&
          refunded + 0.0001 < orderTotal
        ) {
          return NextResponse.json(
            {
              error:
                'لا يمكن حل النزاع لصالح المشتري قبل إثبات الاسترداد الكامل.',
            },
            { status: 409 },
          )
        }

        if (!note) {
          return NextResponse.json(
            { error: 'أضف ملاحظة قرار عند حل النزاع لصالح المشتري.' },
            { status: 400 },
          )
        }

        nextDisputeStatus = 'resolved_buyer'
        nextResolutionCode = 'buyer_resolution'
        nextResolvedBy = user.id
        nextResolvedAt = new Date().toISOString()
      } else if (action === 'close_dispute') {
        if (!['resolved_buyer', 'resolved_seller'].includes(dispute.status)) {
          return NextResponse.json(
            { error: 'لا يمكن إغلاق المراجعة قبل تسجيل قرار حل.' },
            { status: 409 },
          )
        }
        nextDisputeStatus = 'closed'
      }

      const { data: updatedDispute, error: updateDisputeError } = await admin
        .from('disputes')
        .update({
          status: nextDisputeStatus,
          resolution_code: nextResolutionCode,
          resolution_note: note || dispute.resolution_note,
          resolved_by: nextResolvedBy || null,
          resolved_at: nextResolvedAt,
        })
        .eq('id', id)
        .select(
          'id,order_id,status,resolution_code,resolution_note,resolved_by,resolved_at',
        )
        .single()

      if (updateDisputeError || !updatedDispute) {
        console.error('DEBA dispute admin update failed', updateDisputeError)
        return NextResponse.json({ error: 'تعذر تحديث المراجعة.' }, { status: 500 })
      }

      if (action === 'resolve_dispute_seller') {
        const { error: orderUpdateError } = await admin
          .from('orders')
          .update({
            status: 'completed',
            status_reason: 'Dispute resolved in seller favor',
          })
          .eq('id', order.id)
          .eq('status', 'disputed')

        if (orderUpdateError) {
          console.error('DEBA seller dispute order update failed', orderUpdateError)
          return NextResponse.json(
            { error: 'تم حل المراجعة لكن تعذر إنهاء حالة الطلب.' },
            { status: 500 },
          )
        }
      } else if (
        action === 'resolve_dispute_buyer' &&
        order.payment_status === 'refunded'
      ) {
        const { error: orderUpdateError } = await admin
          .from('orders')
          .update({
            status: 'refunded',
            status_reason: 'Dispute resolved in buyer favor',
          })
          .eq('id', order.id)
          .eq('status', 'disputed')

        if (orderUpdateError) {
          console.error('DEBA buyer dispute order update failed', orderUpdateError)
          return NextResponse.json(
            { error: 'تم حل المراجعة لكن تعذر إنهاء حالة الطلب.' },
            { status: 500 },
          )
        }
      }

      afterData = {
        dispute: updatedDispute,
        order_id: order.id,
      }
      entityType = 'dispute'
    } else if (
      action === 'assign_ticket' ||
      action === 'resolve_ticket' ||
      action === 'close_ticket' ||
      action === 'reply_ticket'
    ) {
      table = 'support_ticket'

      const { data: ticket, error: ticketError } = await admin
        .from('support_tickets')
        .select(
          'id,user_id,order_id,status,priority,assigned_to,last_response_at,resolved_at',
        )
        .eq('id', id)
        .maybeSingle()

      if (ticketError || !ticket) {
        return NextResponse.json(
          { error: 'تذكرة الدعم غير موجودة.' },
          { status: 404 },
        )
      }

      beforeData = ticket

      if (action === 'reply_ticket' && !note) {
        return NextResponse.json(
          { error: 'اكتب الرد قبل الإرسال.' },
          { status: 400 },
        )
      }

      if (action === 'reply_ticket') {
        const { error: messageError } = await admin
          .from('support_messages')
          .insert({
            ticket_id: ticket.id,
            author_id: user.id,
            body: note,
            is_internal: false,
          })

        if (messageError) {
          console.error('DEBA admin support reply failed', messageError)
          return NextResponse.json(
            { error: 'تعذر إرسال رد الدعم.' },
            { status: 500 },
          )
        }
      }

      const nextStatus =
        action === 'assign_ticket'
          ? 'in_progress'
          : action === 'resolve_ticket'
            ? 'resolved'
            : action === 'close_ticket'
              ? 'closed'
              : 'in_progress'

      const { data: updatedTicket, error: updateTicketError } = await admin
        .from('support_tickets')
        .update({
          status: nextStatus,
          assigned_to: user.id,
          last_response_at:
            action === 'reply_ticket' || action === 'assign_ticket'
              ? new Date().toISOString()
              : ticket.last_response_at,
          resolved_at:
            action === 'resolve_ticket' || action === 'close_ticket'
              ? new Date().toISOString()
              : null,
        })
        .eq('id', ticket.id)
        .select(
          'id,user_id,order_id,status,priority,assigned_to,last_response_at,resolved_at',
        )
        .single()

      if (updateTicketError || !updatedTicket) {
        console.error('DEBA admin support update failed', updateTicketError)
        return NextResponse.json(
          { error: 'تعذر تحديث تذكرة الدعم.' },
          { status: 500 },
        )
      }

      await admin.from('notifications').insert({
        user_id: ticket.user_id,
        type: 'support.updated',
        title:
          action === 'reply_ticket'
            ? 'رد جديد من دعم DEBA'
            : 'تحديث تذكرة الدعم',
        body:
          action === 'reply_ticket'
            ? 'تمت إضافة رد جديد إلى تذكرة الدعم الخاصة بك.'
            : 'تم تحديث حالة تذكرة الدعم الخاصة بك.',
        href: '/support',
        metadata: { ticket_id: ticket.id, status: nextStatus },
      })

      afterData = updatedTicket
      entityType = 'support_ticket'
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
