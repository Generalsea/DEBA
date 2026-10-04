import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'يجب تسجيل الدخول.'},{status:401})
  const {data,error}=await supabase.rpc('get_my_coin_balance')
  if(error)return NextResponse.json({error:'تعذر تحميل رصيد Coins.'},{status:500})
  return NextResponse.json(data)
}
