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
      return NextResponse.json({ error: 'تعذر فتح المحادثة.' }, { status: 400 })
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

    return NextResponse.json({
      rooms: (rooms || []).map((room) => {
        const counterpartId = (roomPeople || []).find((person) => person.room_id === room.id && person.user_id !== userId)?.user_id
        return {
          ...room,
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
