import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const PRODUCT_MEDIA_BUCKET = 'deba-product-media'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const body = (await request.json()) as { productId?: string }
    const productId = body.productId?.trim()

    if (!productId) {
      return NextResponse.json({ error: 'معرّف المنتج مطلوب.' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('get_or_create_marketplace_chat', {
      p_product_id: productId,
    })

    if (error) {
      console.error('DEBA chat room creation failed', error)
      const message = error.message || ''
      if (message.includes('Cannot open chat with yourself')) {
        return NextResponse.json({ error: 'لا يمكنك بدء محادثة مع نفسك.' }, { status: 400 })
      }
      if (message.includes('Product is not available')) {
        return NextResponse.json({ error: 'هذا الإعلان لم يعد متاحًا للمحادثة.' }, { status: 404 })
      }
      if (message.includes('Authenticated buyer is required')) {
        return NextResponse.json({ error: 'يجب تسجيل الدخول لبدء المحادثة.' }, { status: 401 })
      }

      console.error('DEBA chat room creation RPC error', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })

      return NextResponse.json(
        {
          error: 'تعذر فتح المحادثة الآن.',
          ...(process.env.NODE_ENV !== 'production'
            ? {
                debug: {
                  code: error.code || null,
                  message: error.message || null,
                  details: error.details || null,
                  hint: error.hint || null,
                  supabaseHost: (() => {
                    try {
                      return new URL(
                        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gkwpjtbrecoesxyoybto.supabase.co',
                      ).host
                    } catch {
                      return 'invalid-supabase-url'
                    }
                  })(),
                },
              }
            : {}),
        },
        { status: 400 },
      )
    }

    return NextResponse.json({ room: data })
  } catch (error) {
    console.error('DEBA chat room route failed', error)
    return NextResponse.json({ error: 'تعذر فتح المحادثة.' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
    }

    const { data: participants, error } = await supabase
      .from('chat_participants')
      .select('room_id,last_read_at,is_muted')
      .eq('user_id', userData.user.id)

    if (error) {
      console.error('DEBA chat rooms load failed', error)
      return NextResponse.json({ error: 'تعذر تحميل المحادثات.' }, { status: 500 })
    }

    const roomIds = (participants || []).map((row) => row.room_id)
    if (!roomIds.length) return NextResponse.json({ rooms: [] })

    const { data: rooms, error: roomsError } = await supabase
      .from('chat_rooms')
      .select('id,product_id,room_type,created_by,created_at,updated_at')
      .in('id', roomIds)
      .order('updated_at', { ascending: false })

    if (roomsError) {
      console.error('DEBA chat room details failed', roomsError)
      return NextResponse.json({ error: 'تعذر تحميل المحادثات.' }, { status: 500 })
    }

    const productIds = Array.from(
      new Set((rooms || []).map((room) => room.product_id).filter(Boolean)),
    ) as string[]

    const { data: products } = productIds.length
      ? await supabase
          .from('products')
          .select(
            'id,title,slug,price,currency,city,governorate,condition_grade,category:categories!products_category_id_fkey(name_ar,name_en)',
          )
          .in('id', productIds)
      : { data: [] as Array<Record<string, unknown>> }

    const { data: productImages } = productIds.length
      ? await supabase
          .from('product_images')
          .select('product_id,storage_path,alt_text,sort_order,is_primary')
          .in('product_id', productIds)
      : { data: [] as Array<Record<string, unknown>> }

    const productImageMap = new Map<string, Record<string, unknown>>()
    for (const image of productImages || []) {
      const productId = typeof image.product_id === 'string' ? image.product_id : ''
      if (!productId) continue

      const current = productImageMap.get(productId)
      const currentRank =
        current
          ? Number(Boolean(current.is_primary)) * 100000 - Number(current.sort_order || 0)
          : Number.NEGATIVE_INFINITY
      const nextRank =
        Number(Boolean(image.is_primary)) * 100000 - Number(image.sort_order || 0)

      if (!current || nextRank > currentRank) {
        productImageMap.set(productId, image)
      }
    }

    const productMap = new Map(
      (products || []).map((product) => {
        const category = product.category
        const categoryRecord =
          category && typeof category === 'object'
            ? (category as Record<string, unknown>)
            : null
        const image = productImageMap.get(product.id)
        const storagePath = typeof image?.storage_path === 'string' ? image.storage_path : null
        const imageUrl = storagePath
          ? (/^https?:\/\//i.test(storagePath)
              ? storagePath
              : supabase.storage.from(PRODUCT_MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl)
          : null

        return [
          product.id,
          {
            id: product.id,
            title: product.title,
            slug: product.slug,
            price: product.price,
            currency: product.currency || 'EGP',
            city: product.city || null,
            governorate: product.governorate || null,
            conditionGrade: product.condition_grade || null,
            categoryName:
              typeof categoryRecord?.name_ar === 'string'
                ? categoryRecord.name_ar
                : typeof categoryRecord?.name_en === 'string'
                  ? categoryRecord.name_en
                  : null,
            imageUrl,
            imageAlt: typeof image?.alt_text === 'string' ? image.alt_text : null,
          },
        ]
      }),
    )

    const participantMap = new Map((participants || []).map((row) => [row.room_id, row]))
    const { data: roomPeople } = await supabase
      .from('chat_participants')
      .select('room_id,user_id')
      .in('room_id', roomIds)

    const peopleIds = Array.from(new Set((roomPeople || []).map((row) => row.user_id)))
    const { data: profiles } = peopleIds.length
      ? await supabase
          .from('profiles')
          .select('id,display_name,username,avatar_url,account_type')
          .in('id', peopleIds)
      : { data: [] as Array<Record<string, unknown>> }

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))
    const userId = userData.user.id

    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('id,display_name,username,avatar_url,account_type')
      .eq('id', userId)
      .maybeSingle()

    const lastReadByRoom = new Map(
      (participants || []).map((row) => [row.room_id, row.last_read_at]),
    )

    const unreadByRoom = new Map<string, number>()
    const latestByRoom = new Map<string, {
      sender_id: string | null
      created_at: string
      body: string | null
      message_type: string
    }>()
    const offerByRoom = new Set<string>()

    const { data: recentMessages, error: recentMessagesError } = await supabase
      .from('messages')
      .select('room_id,sender_id,created_at,body,message_type')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (recentMessagesError) {
      console.error('DEBA recent chat messages load failed', recentMessagesError)
    }

    for (const message of recentMessages || []) {
      if (!latestByRoom.has(message.room_id)) {
        latestByRoom.set(message.room_id, {
          sender_id: message.sender_id,
          created_at: message.created_at,
          body: message.body,
          message_type: message.message_type,
        })
      }

      if (message.message_type === 'offer') {
        offerByRoom.add(message.room_id)
      }

      if (message.sender_id === userId) continue
      const lastReadAt = lastReadByRoom.get(message.room_id)
      if (
        !lastReadAt ||
        new Date(message.created_at).getTime() > new Date(lastReadAt).getTime()
      ) {
        unreadByRoom.set(
          message.room_id,
          (unreadByRoom.get(message.room_id) || 0) + 1,
        )
      }
    }

    return NextResponse.json({
      viewer: viewerProfile || {
        id: userId,
        display_name: userData.user.email?.split('@')[0] || 'عضو DEBA',
        username: null,
        avatar_url: null,
        account_type: null,
      },
      rooms: (rooms || []).map((room) => {
        const counterpartId = (roomPeople || []).find(
          (person) => person.room_id === room.id && person.user_id !== userId,
        )?.user_id
        const latest = latestByRoom.get(room.id)
        return {
          ...room,
          unreadCount: unreadByRoom.get(room.id) || 0,
          hasOffers: offerByRoom.has(room.id),
          lastMessagePreview:
            latest?.body ||
            (latest?.message_type === 'offer' ? 'عرض سعر مرتبط بالمحادثة' : null),
          lastMessageType: latest?.message_type || null,
          product: room.product_id ? productMap.get(room.product_id) || null : null,
          participant: participantMap.get(room.id) || null,
          counterparty: counterpartId
            ? profileMap.get(counterpartId) || null
            : null,
        }
      }),
    })
  } catch (error) {
    console.error('DEBA chat room list route failed', error)
    return NextResponse.json({ error: 'تعذر تحميل المحادثات.' }, { status: 500 })
  }
}
