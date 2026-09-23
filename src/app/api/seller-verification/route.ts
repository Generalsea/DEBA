import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const { data, error } = await supabase
      .from('seller_verifications')
      .select('id,status,verification_level,legal_name,taxpayer_number,document_type,document_country,document_last4,provider,submitted_at,reviewed_at,review_note,expires_at,created_at,updated_at')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (error) {
      console.error('DEBA seller verification GET failed', error)
      return NextResponse.json({ error: 'تعذر تحميل حالة التوثيق.' }, { status: 500 })
    }

    return NextResponse.json({ verification: data })
  } catch (error) {
    console.error('DEBA seller verification route failed', error)
    return NextResponse.json({ error: 'تعذر تحميل حالة التوثيق.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })

    const body = (await request.json()) as {
      verificationLevel?: string
      legalName?: string
      taxpayerNumber?: string
      documentType?: string
      documentCountry?: string
    }

    const { data, error } = await supabase.rpc('start_seller_verification', {
      p_verification_level: body.verificationLevel?.trim() || 'basic',
      p_legal_name: body.legalName?.trim() || '',
      p_taxpayer_number: body.taxpayerNumber?.trim() || '',
      p_document_type: body.documentType?.trim() || '',
      p_document_country: body.documentCountry?.trim() || 'EG',
    })

    if (error) {
      console.error('DEBA seller verification start failed', error)
      return NextResponse.json({ error: 'تعذر بدء التوثيق.' }, { status: 400 })
    }

    return NextResponse.json({ verification: data }, { status: 201 })
  } catch (error) {
    console.error('DEBA seller verification POST failed', error)
    return NextResponse.json({ error: 'تعذر بدء التوثيق.' }, { status: 500 })
  }
}
