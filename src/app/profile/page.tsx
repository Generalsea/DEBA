import { redirect } from 'next/navigation'
import Header, { type HeaderCategory } from '@/components/Header'
import ProfileDashboard, {
  type ProfileAccountData,
  type ProfileOrder,
  type ProfileProduct,
  type ProfileFavorite,
} from '@/components/ProfileDashboard'
import { createClient } from '@/utils/supabase/server'

type CategoryRow = {
  id: string
  name_ar: string
  slug: string
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string
  avatar_url: string | null
  bio: string | null
  city: string | null
  governorate: string | null
  is_public: boolean
  account_type: 'buyer' | 'seller'
  created_at: string
  updated_at: string
}

const BUCKET = 'deba-product-media'

type PrivateRow = {
  phone: string | null
  address_line1: string | null
  address_line2: string | null
  district: string | null
  postal_code: string | null
}

type ProductRow = {
  id: string
  owner_id: string | null
  title: string
  slug: string
  price: number | string | null
  currency: string
  quantity: number
  status: string
  moderation_status: string
  condition_grade: string | null
  created_at: string
}

type OrderRow = {
  id: string
  buyer_id: string
  seller_id: string
  product_id: string | null
  status: string
  payment_status: string
  fulfillment_status: string
  total: number | string
  currency: string
  delivery_method: string
  created_at: string
}

type FavoriteRow = {
  product_id: string
  created_at: string
}

function normalizeMoney(value: number | string | null) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (typeof userId !== 'string') {
    redirect('/login?next=%2Fprofile')
  }

  const { data: authUserData } = await supabase.auth.getUser()
  const email = authUserData.user?.email || null

  const [
    profileResult,
    privateResult,
    categoriesResult,
    buyerOrdersResult,
    sellerOrdersResult,
    sellerProductsResult,
    favoritesResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,bio,city,governorate,is_public,account_type,created_at,updated_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('profile_private')
      .select('phone,address_line1,address_line2,district,postal_code')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('categories')
      .select('id,name_ar,slug')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('orders')
      .select('id,buyer_id,seller_id,product_id,status,payment_status,fulfillment_status,total,currency,delivery_method,created_at')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('orders')
      .select('id,buyer_id,seller_id,product_id,status,payment_status,fulfillment_status,total,currency,delivery_method,created_at')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('products')
      .select('id,owner_id,title,slug,price,currency,quantity,status,moderation_status,condition_grade,created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('favorites')
      .select('product_id,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (profileResult.error) {
    console.error('DEBA profile lookup failed', profileResult.error)
    throw new Error('تعذر تحميل ملف الحساب.')
  }

  const profile = profileResult.data as ProfileRow | null
  if (!profile) {
    redirect('/login?next=%2Fprofile')
  }

  const categories = (categoriesResult.data || []) as CategoryRow[]
  const buyerOrders = (buyerOrdersResult.data || []) as OrderRow[]
  const sellerOrders = (sellerOrdersResult.data || []) as OrderRow[]
  const sellerProducts = (sellerProductsResult.data || []) as ProductRow[]
  const favorites = (favoritesResult.data || []) as FavoriteRow[]
  const privateProfile = (privateResult.data || null) as PrivateRow | null

  const allOrderProductIds = Array.from(
    new Set([...buyerOrders, ...sellerOrders]
      .map((order) => order.product_id)
      .filter((id): id is string => Boolean(id))),
  )

  const favoriteProductIds = favorites.map((item) => item.product_id)
  const allProductIds = Array.from(new Set([
    ...allOrderProductIds,
    ...favoriteProductIds,
    ...sellerProducts.map((item) => item.id),
  ]))

  const [productsResult, imagesResult] = await Promise.all([
    allProductIds.length
      ? supabase
          .from('products')
          .select('id,title,slug,price,currency,quantity,status,moderation_status,condition_grade')
          .in('id', allProductIds)
      : Promise.resolve({ data: [], error: null }),
    sellerProducts.length
      ? supabase
          .from('product_images')
          .select('product_id,storage_path,alt_text,sort_order,is_primary')
          .in('product_id', sellerProducts.map((product) => product.id))
          .order('is_primary', { ascending: false })
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])

  type ProductLookup = Pick<ProductRow, 'id' | 'title' | 'slug' | 'price' | 'currency' | 'quantity' | 'status' | 'moderation_status' | 'condition_grade'>
  type ImageLookup = {
    product_id: string
    storage_path: string
    alt_text: string | null
    sort_order: number
    is_primary: boolean
  }

  const productLookup = new Map(
    ((productsResult.data || []) as ProductLookup[]).map((product) => [product.id, product]),
  )
  const imageLookup = new Map<string, ImageLookup>()
  for (const image of (imagesResult.data || []) as ImageLookup[]) {
    if (!imageLookup.has(image.product_id)) imageLookup.set(image.product_id, image)
  }

  const serializeOrder = (order: OrderRow): ProfileOrder => {
    const product = order.product_id ? productLookup.get(order.product_id) : null
    return {
      id: order.id,
      productId: order.product_id,
      productTitle: product?.title || 'منتج محذوف أو غير متاح',
      productSlug: product?.slug || null,
      status: order.status,
      paymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status,
      total: normalizeMoney(order.total),
      currency: order.currency || 'EGP',
      deliveryMethod: order.delivery_method,
      createdAt: order.created_at,
    }
  }

  const serializedProducts: ProfileProduct[] = sellerProducts.map((product) => ({
    id: product.id,
    title: product.title,
    slug: product.slug,
    price: normalizeMoney(product.price),
    currency: product.currency || 'EGP',
    quantity: product.quantity,
    status: product.status,
    moderationStatus: product.moderation_status,
    conditionGrade: product.condition_grade,
    createdAt: product.created_at,
    imageUrl: imageLookup.get(product.id)?.storage_path || null,
  }))

  const serializedFavorites: ProfileFavorite[] = favorites
    .map((favorite) => {
      const product = productLookup.get(favorite.product_id)
      if (!product) return null
      return {
        productId: product.id,
        title: product.title,
        slug: product.slug,
        price: normalizeMoney(product.price),
        currency: product.currency || 'EGP',
        conditionGrade: product.condition_grade,
        status: product.status,
        createdAt: favorite.created_at,
      }
    })
    .filter((item): item is ProfileFavorite => item !== null)

  const account: ProfileAccountData = {
    userId,
    email,
    emailConfirmed: Boolean(authUserData.user?.email_confirmed_at),
    profile: {
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      bio: profile.bio,
      city: profile.city,
      governorate: profile.governorate,
      isPublic: profile.is_public,
      accountType: profile.account_type,
      createdAt: profile.created_at,
      phone: privateProfile?.phone || null,
      addressLine1: privateProfile?.address_line1 || null,
      addressLine2: privateProfile?.address_line2 || null,
      district: privateProfile?.district || null,
      postalCode: privateProfile?.postal_code || null,
    },
    stats: {
      buyerOrders: buyerOrders.length,
      favorites: favorites.length,
      sellerProducts: sellerProducts.length,
      sellerOrders: sellerOrders.length,
      activeSellerProducts: sellerProducts.filter(
        (item) => item.status === 'published' && item.moderation_status === 'approved',
      ).length,
      pendingSellerProducts: sellerProducts.filter(
        (item) => item.moderation_status === 'pending' || item.status === 'draft',
      ).length,
    },
    buyerOrders: buyerOrders.map(serializeOrder),
    sellerOrders: sellerOrders.map(serializeOrder),
    sellerProducts: serializedProducts,
    favorites: serializedFavorites,
  }

  const requestedTab = (await searchParams)?.tab || 'overview'

  return (
    <>
      <Header
        categories={categories.map(
          (item): HeaderCategory => ({
            id: item.id,
            nameAr: item.name_ar,
            slug: item.slug,
          }),
        )}
        favoriteCount={favorites.length}
      />
      <main className="deba-profile-page" dir="rtl">
        <ProfileDashboard account={account} initialTab={requestedTab} />
      </main>
    </>
  )
}
