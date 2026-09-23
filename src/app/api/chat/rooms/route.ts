import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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
                      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gkwpjtbrecoesxyoybto.supabase.co').host
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

export async function GET(request: Request) {
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

    const productIds = Array.from(new Set((rooms || []).map((room) => room.product_id).filter(Boolean)))
    const { data: products } = productIds.length
      ? await supabase.from('products').select('id,title,slug,price,currency').in('id', productIds)
      : { data: [] as Array<{ id: string; title: string; slug: string; price: number; currency: string }> }

    const productMap = new Map((products || []).map((product) => [product.id, product]))
    const participantMap = new Map((participants || []).map((row) => [row.room_id, row]))
    const { data: roomPeople } = await supabase
      .from('chat_participants')
      .select('room_id,user_id')
      .in('room_id', roomIds)
    const peopleIds = Array.from(new Set((roomPeople || []).map((row) => row.user_id)))
    const { data: profiles } = peopleIds.length
      ? await supabase.from('profiles').select('id,display_name,username,avatar_url,account_type').in('id', peopleIds)
      : { data: [] as Array<{ id: string; display_name: string; username: string | null; avatar_url: string | null; account_type: 'buyer' | 'seller' }> }
    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))
    const userId = userData.user.id

    const lastReadByRoom = new Map(
      (participants || []).map((row) => [row.room_id, row.last_read_at]),
    )
    const unreadByRoom = new Map<string, number>()
    if (roomIds.length) {
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('room_id,sender_id,created_at')
        .in('room_id', roomIds)
        .neq('sender_id', userId)
        .order('created_at', { ascending: false })
        .limit(500)

      for (const message of recentMessages || []) {
        const lastReadAt = lastReadByRoom.get(message.room_id)
        if (!lastReadAt || new Date(message.created_at).getTime() > new Date(lastReadAt).getTime()) {
          unreadByRoom.set(message.room_id, (unreadByRoom.get(message.room_id) || 0) + 1)
        }
      }
    }

    return NextResponse.json({
      rooms: (rooms || []).map((room) => {
        const counterpartId = (roomPeople || []).find((person) => person.room_id === room.id && person.user_id !== userId)?.user_id
        return {
          ...room,
          unreadCount: unreadByRoom.get(room.id) || 0,
          product: room.product_id ? productMap.get(room.product_id) || null : null,
          participant: participantMap.get(room.id) || null,
          counterparty: counterpartId ? profileMap.get(counterpartId) || null : null,
        }
      }),
    })
  } catch (error) {
    console.error('DEBA chat room list route failed', error)
    return NextResponse.json({ error: 'تعذر تحميل المحادثات.' }, { status: 500 })
  }
}
