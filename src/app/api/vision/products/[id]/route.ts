import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { inspectProductImages } from '@/lib/vision/provider'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

const BUCKET = 'deba-product-media'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select(
        'id,owner_id,title,description,condition_grade,condition_details,product_images(id,storage_path,sort_order,is_primary)',
      )
      .eq('id', id)
      .eq('owner_id', user.id)
      .eq('status', 'published')
      .eq('moderation_status', 'approved')
      .eq('listing_type', 'sale')
      .maybeSingle()

    if (productError || !product) {
      return NextResponse.json({ error: 'الإعلان غير متاح لمعاينة المراجعة البصرية.' }, { status: 404 })
    }

    const images = Array.isArray(product.product_images)
      ? [...product.product_images]
          .sort(
            (left, right) =>
              Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary)) ||
              Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0),
          )
          .slice(0, 12)
      : []

    const imageUrls = images
      .map((image) => {
        const storagePath = String(image.storage_path ?? '').trim()
        if (!storagePath) return null
        if (/^https?:\/\//i.test(storagePath)) return storagePath
        return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
      })
      .filter((url): url is string => Boolean(url))

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'الإعلان لا يحتوي على صور قابلة للمعاينة.' }, { status: 400 })
    }

    const { data: requestRows, error: requestError } = await supabase.rpc(
      'grade_product_visual_condition',
      {
        p_product_id: product.id,
        p_image_urls: imageUrls,
      },
    )

    if (requestError || !Array.isArray(requestRows) || !requestRows[0]?.inspection_id) {
      console.error('DEBA visual inspection request failed', requestError)
      return NextResponse.json({ error: 'تعذر إنشاء طلب المعاينة البصرية.' }, { status: 500 })
    }

    const inspectionId = String(requestRows[0].inspection_id)

    try {
      const result = await inspectProductImages({
        imageUrls,
        title: product.title,
        description: product.description || '',
        conditionGrade: product.condition_grade || null,
        conditionDetails: product.condition_details || null,
      })

      const sourceHash = createHash('sha256')
        .update(
          JSON.stringify({
            imageUrls,
            title: product.title,
            description: product.description || '',
            conditionGrade: product.condition_grade || null,
            conditionDetails: product.condition_details || null,
          }),
        )
        .digest('hex')

      const admin = createAdminClient()
      const { data: completed, error: completionError } = await admin.rpc(
        'complete_product_visual_inspection',
        {
          p_inspection_id: inspectionId,
          p_visual_score: result.visualScore,
          p_structural_score: result.structuralScore,
          p_cleanliness_score: result.cleanlinessScore,
          p_description_consistency_score: result.descriptionConsistencyScore,
          p_condition_grade: result.conditionGrade,
          p_confidence: result.confidence,
          p_damage_flags: result.damageFlags,
          p_observations: result.observations,
          p_provider: 'openai-compatible',
          p_model_name: process.env.DEBA_VISION_MODEL || 'configured-model',
          p_source_hash: sourceHash,
        },
      )

      if (completionError) {
        console.error('DEBA visual inspection completion failed', completionError)
        return NextResponse.json({ error: 'تعذر حفظ نتيجة المعاينة البصرية.' }, { status: 500 })
      }

      return NextResponse.json({
        inspectionId,
        result,
        completion: completed,
      })
    } catch (error) {
      console.error('DEBA visual inspection provider failed', error)
      try {
        const admin = createAdminClient()
        await admin.rpc('fail_product_visual_inspection', {
          p_inspection_id: inspectionId,
          p_error_code: 'provider_failed',
        })
      } catch (completionError) {
        console.error('DEBA visual inspection failure state update failed', completionError)
      }
      return NextResponse.json(
        { error: 'تعذر إتمام المعاينة البصرية حالياً. لم يتم تعديل بيانات الحالة المكتوبة.' },
        { status: 502 },
      )
    }
  } catch (error) {
    console.error('DEBA visual inspection route failed', error)
    return NextResponse.json({ error: 'تعذر تنفيذ المعاينة البصرية.' }, { status: 500 })
  }
}
