import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const SELECT =
  'id,owner_id,title,slug,description,listing_type,status,moderation_status,condition_grade,condition_details,price,currency,quantity,city,governorate,district,delivery_method,metadata,details_schema_version,details_last_completed_at,published_at,created_at,category:categories!products_category_id_fkey(id,name_ar,name_en,slug),images:product_images!product_images_product_id_fkey(id,storage_path,alt_text,sort_order,is_primary)'

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  const supabase = await createClient()

  const simple = await supabase
    .from('products')
    .select('id,title,slug,status,moderation_status,listing_type')
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .eq('listing_type', 'sale')
    .maybeSingle()

  const exact = await supabase
    .from('products')
    .select(SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .eq('listing_type', 'sale')
    .maybeSingle()

  return NextResponse.json({
    slug,
    simple: {
      id: simple.data?.id ?? null,
      title: simple.data?.title ?? null,
      error: simple.error
        ? {
            code: simple.error.code,
            message: simple.error.message,
            details: simple.error.details,
            hint: simple.error.hint,
          }
        : null,
    },
    exact: {
      id: exact.data?.id ?? null,
      title: exact.data?.title ?? null,
      categoryPresent: Boolean(exact.data?.category),
      imageCount: Array.isArray(exact.data?.images) ? exact.data.images.length : null,
      error: exact.error
        ? {
            code: exact.error.code,
            message: exact.error.message,
            details: exact.error.details,
            hint: exact.error.hint,
          }
        : null,
    },
  })
}
