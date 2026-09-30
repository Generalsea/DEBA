import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { generateBrokerDecision } from '@/lib/ai-broker/provider'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function POST(
  _request: Request,
  context: { params: Promise<{ offerId: string }> },
) {
  const { offerId } = await context.params

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select(
        'id,product_id,buyer_id,seller_id,amount,currency,status,products(id,title,description,price,currency,condition_grade)',
      )
      .eq('id', offerId)
      .maybeSingle()

    if (offerError || !offer) {
      return NextResponse.json({ error: 'العرض غير موجود.' }, { status: 404 })
    }

    if (offer.buyer_id !== user.id && offer.seller_id !== user.id) {
      return NextResponse.json({ error: 'غير مصرح بهذا العرض.' }, { status: 403 })
    }

    const { data: sessionId, error: initiateError } = await supabase.rpc(
      'initiate_ai_broker_negotiation',
      { p_offer_id: offer.id },
    )

    if (initiateError || !sessionId) {
      console.error('DEBA AI broker initiation failed', initiateError)
      return NextResponse.json({ error: 'تعذر فتح جلسة الوكيل التفاوضية.' }, { status: 409 })
    }

    const { data: evaluation, error: evaluationError } = await supabase.rpc(
      'evaluate_broker_counter_offer',
      { p_session_id: sessionId },
    )

    if (evaluationError) {
      console.error('DEBA AI broker policy evaluation failed', evaluationError)
      return NextResponse.json({ error: 'تعذر تقييم العرض ضمن سياسة التفاوض.' }, { status: 409 })
    }

    const policyEvaluation = evaluation as {
      sessionId?: string
      decision?: string
      round?: number
      proposedAmount?: number | null
      marketMedianAmount?: number | null
      marketConfidence?: number
      marketSource?: string
    }

    let modelDecision: Awaited<ReturnType<typeof generateBrokerDecision>> | null = null
    const providerConfigured = Boolean(
      process.env.DEBA_BROKER_API_URL &&
        process.env.DEBA_BROKER_API_KEY &&
        process.env.DEBA_BROKER_MODEL,
    )

    if (providerConfigured) {
      try {
        modelDecision = await generateBrokerDecision({
          currentOffer: Number(offer.amount),
          productPrice: Number((offer.products as { price?: number | string | null })?.price),
          marketMedian: Number(policyEvaluation.marketMedianAmount),
          marketConfidence: Number(policyEvaluation.marketConfidence ?? 0),
          deterministicProposal:
            policyEvaluation.proposedAmount == null
              ? null
              : Number(policyEvaluation.proposedAmount),
          round: Number(policyEvaluation.round ?? 0),
          maxRounds: 20,
          productSummary: String(
            (offer.products as { title?: string | null; description?: string | null })?.title ??
              '',
          ).slice(0, 1000),
        })
      } catch (error) {
        console.error('DEBA AI broker model advisory failed', error)
      }
    }

    if (modelDecision) {
      const deterministic = policyEvaluation.proposedAmount
      const sameSafeAmount =
        deterministic !== null &&
        modelDecision.action === 'counter_offer' &&
        modelDecision.amount !== null &&
        Math.abs(modelDecision.amount - Number(deterministic)) < 0.005

      const modelPayload = JSON.stringify({
        sessionId,
        policyEvaluation,
        modelDecision,
      })
      const inputHash = createHash('sha256')
        .update(JSON.stringify({ offerId, sessionId, policyEvaluation }))
        .digest('hex')
      const promptHash = createHash('sha256')
        .update(modelPayload)
        .digest('hex')

      try {
        const admin = createAdminClient()
        await admin.rpc('record_ai_broker_advisory', {
          p_session_id: sessionId,
          p_action: sameSafeAmount ? modelDecision.action : 'rejected_by_policy',
          p_amount: sameSafeAmount ? modelDecision.amount : null,
          p_rationale: modelDecision.rationale,
          p_confidence: modelDecision.confidence,
          p_model_name: process.env.DEBA_BROKER_MODEL || 'configured-model',
          p_prompt_hash: promptHash,
          p_input_hash: inputHash,
        })
      } catch (error) {
        console.error('DEBA AI broker advisory audit failed', error)
      }

      if (!sameSafeAmount) {
        modelDecision = {
          ...modelDecision,
          action: 'hold',
          amount: null,
          rationale: 'تم رفض اقتراح النموذج خارج العقد المالي؛ التقييم الحتمي هو المرجع.',
        }
      }
    }

    return NextResponse.json({
      sessionId,
      policyEvaluation,
      modelDecision,
      execution: {
        performed: false,
        reason: 'Phase 5.1 records a bounded advisory only; offer/payment/fulfillment mutation remains behind a separate domain gate.',
      },
    })
  } catch (error) {
    console.error('DEBA AI broker route failed', error)
    return NextResponse.json({ error: 'تعذر تنفيذ الوكيل التفاوضي.' }, { status: 500 })
  }
}
