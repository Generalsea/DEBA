import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
export async function POST(request:Request){
  const origin=request.headers.get('origin')
  if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:'طلب غير صالح.'},{status:403})
  const body=await request.json().catch(()=>({}))
  const productId=typeof body.productId==='string'?body.productId:''
  const boostType=typeof body.boostType==='string'?body.boostType:''
  const durationMinutes=Number(body.durationMinutes)
  if(!productId||!['super_boost','stealth_pin','auto_refresh'].includes(boostType)||!Number.isInteger(durationMinutes))
    return NextResponse.json({error:'بيانات الترويج غير صالحة.'},{status:400})
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'يجب تسجيل الدخول.'},{status:401})
  const {data,error}=await supabase.rpc('spend_coins_for_boost',{p_product_id:productId,p_boost_type:boostType,p_duration_minutes:durationMinutes})
  if(error)return NextResponse.json({error:'تعذر تفعيل الترويج.'},{status:400})
  return NextResponse.json(data)
}
