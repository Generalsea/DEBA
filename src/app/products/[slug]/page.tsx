import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound,
} from 'lucide-react'
import { notFound } from 'next/navigation'
import Header, { type HeaderCategory } from '@/components/Header'
import ProductCard, { type ProductCardItem } from '@/components/ProductCard'
import FavoriteButton from '@/components/FavoriteButton'
import CartAddButton from '@/components/CartAddButton'
import ProductGallery, { type ProductGalleryImage } from '@/components/ProductGallery'
import ProductDetailTabs, { type ProductAttributeDefinition } from '@/components/ProductDetailTabs'
import { createClient } from '@/utils/supabase/server'

const BUCKET = 'deba-product-media'

type RouteParams = {
  params: Promise<{ slug: string }>
}

type Category = {
  id: string
  name_ar: string
  name_en: string | null
  slug: string
}

type ImageRow = {
  id: string
  storage_path: string
  alt_text: string | null
  sort_order: number
  is_primary: boolean
}

type ProductMetadata = Record<string, unknown>

type ProductRow = {
  id: string
  owner_id: string | null
  title: string
  slug: string
  description: string | null
  listing_type: 'sale'
  status: string
  moderation_status: string
  condition_grade: string | null
  condition_details: string | null
  price: number | string | null
  currency: string
  quantity: number
  city: string | null
  governorate: string | null
  district: string | null
  delivery_method: string
  metadata: ProductMetadata | null
  details_schema_version: number
  details_last_completed_at: string | null
  published_at: string | null
  created_at: string
  category: Category | null
  images: ImageRow[] | null
  seller:
    | {
        display_name: string | null
        username: string | null
        avatar_url: string | null
        bio: string | null
        city: string | null
        governorate: string | null
        is_public: boolean
        account_type: 'buyer' | 'seller'
      }
    | null
}

const SELECT =
  'id,owner_id,title,slug,description,listing_type,status,moderation_status,condition_grade,condition_details,price,currency,quantity,city,governorate,district,delivery_method,metadata,details_schema_version,details_last_completed_at,published_at,created_at,category:categories!products_category_id_fkey(id,name_ar,name_en,slug),images:product_images!product_images_product_id_fkey(id,storage_path,alt_text,sort_order,is_primary)'

const CONDITION_LABELS: Record<string, string> = {
  new: 'جديد',
  like_new: 'مستعمل - كالجديد',
  excellent: 'مستعمل - ممتاز',
  good: 'مستعمل - جيد',
  fair: 'مستعمل - مقبول',
  poor: 'مستعمل - يحتاج عناية',
  for_parts: 'للقطع / الإصلاح',
}

const DELIVERY_LABELS: Record<string, string> = {
  pickup: 'استلام من البائع',
  seller_delivery: 'توصيل عبر البائع',
  platform_delivery: 'توصيل عبر DEBA',
  both: 'استلام أو توصيل',
}

function normalizePrice(value: number | string | null) {
  if (value === null) return null
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) return 'السعر عند التواصل'
  return (
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value) +
    ' ' +
    currency
  )
}

function getImageUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string | null,
) {
  if (!storagePath) return null
  if (/^https?:\/\//i.test(storagePath)) return storagePath
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

function mapCategory(row: Category): HeaderCategory {
  return {
    id: row.id,
    nameAr: row.name_ar,
    slug: row.slug,
  }
}

function mapCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: ProductRow,
): ProductCardItem {
  const image = [...(row.images || [])].sort(
    (left, right) =>
      Number(right.is_primary) - Number(left.is_primary) ||
      left.sort_order - right.sort_order,
  )[0]

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    listingType: row.listing_type,
    price: normalizePrice(row.price),
    currency: row.currency || 'EGP',
    conditionGrade: row.condition_grade,
    city: row.city,
    governorate: row.governorate,
    categoryName: row.category?.name_ar || row.category?.name_en || null,
    imageUrl: getImageUrl(supabase, image?.storage_path || null),
    imageAlt: image?.alt_text?.trim() || row.title,
  }
}

async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { data } = await supabase.auth.getClaims()
    return data?.claims && typeof data.claims.sub === 'string'
      ? data.claims.sub
      : null
  } catch {
    return null
  }
}

function formatPublishedDate(value: string | null) {
  if (!value) return 'تاريخ النشر غير متاح'
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function normalizeRouteSlug(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

async function getProduct(slug: string) {
  const supabase = await createClient()
  const normalizedSlug = normalizeRouteSlug(slug)

  console.error('DEBA PRODUCT DEBUG BEFORE QUERY', {
    slug,
    normalizedSlug,
    encodedSlug: encodeURIComponent(slug),
    slugLength: slug.length,
    expected: 'أداة-منزلية-متعددة-الاستخدام-تجربة-deba',
  })

  const { data, error } = await supabase
    .from('products')
    .select(SELECT)
    .eq('slug', normalizedSlug)
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .eq('listing_type', 'sale')
    .maybeSingle()

  console.error('DEBA PRODUCT DEBUG AFTER QUERY', {
    slug,
    dataId: data?.id ?? null,
    dataSlug: data?.slug ?? null,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
  })

  if (error) {
    console.error('DEBA product detail query failed', error)
    throw new Error('تعذر تحميل بيانات السلعة من Supabase.')
  }

  if (!data) return null

  const product = data as unknown as ProductRow

  const [
    sellerResponse,
    userId,
    categoriesResponse,
    attributeDefinitionsResponse,
    relatedResponse,
  ] = await Promise.all([
      product.owner_id
        ? supabase
            .from('profiles')
            .select(
              'display_name,username,avatar_url,bio,city,governorate,is_public,account_type',
            )
            .eq('id', product.owner_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      getUserId(supabase),
      supabase
        .from('categories')
        .select('id,name_ar,name_en,slug')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      product.category?.id
        ? supabase
            .from('category_attribute_definitions')
            .select('key,label_ar,label_en,data_type,unit,is_required,help_text_ar,sort_order')
            .eq('category_id', product.category.id)
            .eq('is_required', true)
            .order('sort_order', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      product.category?.id
        ? supabase
            .from('products')
            .select(SELECT)
            .eq('category_id', product.category.id)
            .neq('id', product.id)
            .eq('status', 'published')
            .eq('moderation_status', 'approved')
            .eq('listing_type', 'sale')
            .order('published_at', { ascending: false, nullsFirst: false })
            .limit(4)
        : Promise.resolve({ data: [], error: null }),
    ])

  if (sellerResponse.error) {
    console.error('DEBA seller query failed', sellerResponse.error)
  }
  product.seller = sellerResponse.data || null

  let isFavorite = false
  let favoriteCount = 0

  if (userId) {
    const [favorite, favoritesCountResult] = await Promise.all([
      supabase
        .from('favorites')
        .select('id')
        .eq('product_id', product.id)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

    isFavorite = Boolean(favorite.data)
    favoriteCount = favoritesCountResult.count || 0
  }

  const related = ((relatedResponse.data || []) as unknown as ProductRow[]).map(
    (row) => mapCard(supabase, row),
  )

  return {
    supabase,
    product,
    userId,
    isFavorite,
    favoriteCount,
    negotiationCount: 0,
    categories: ((categoriesResponse.data || []) as Category[]).map(mapCategory),
    definitions: ((attributeDefinitionsResponse.data || []) as unknown as ProductAttributeDefinition[]),
    related,
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('title,description')
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('moderation_status', 'approved')
    .eq('listing_type', 'sale')
    .maybeSingle()

  if (!data) {
    return { title: 'السلعة غير موجودة — DEBA' }
  }

  const description =
    data.description || 'تفاصيل المنتج والسعر والتنسيق على الاستلام عبر DEBA.'

  return {
    title: data.title + ' — DEBA',
    description,
    openGraph: {
      title: data.title + ' — DEBA',
      description,
    },
  }
}

export default async function ProductDetailPage({
  params,
}: RouteParams) {
  const { slug } = await params
  const data = await getProduct(slug)

  if (!data) notFound()

  return (
    <main data-deba-route-probe="product-found" dir="rtl">
      <h1>{data.product.title}</h1>
      <p>{data.product.id}</p>
    </main>
  )
}
