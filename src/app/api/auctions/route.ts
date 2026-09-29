import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
export async function GET(request:Request){
  const productId=new URL(request.url).searchParams.get('productId')||''
  if(!productId)return NextResponse.json({error:'معرّف الإعلان مطلوب.'},{status:400})
  const supabase=await createClient();const {data,error}=await supabase.rpc('get_live_auction_state',{p_product_id:productId})
  if(error)return NextResponse.json({error:'تعذر تحميل حالة المزاد.'},{status:500})
  return NextResponse.json({state:data})
}
export async function POST(request:Request){
  const origin=request.headers.get('origin')
  if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:'طلب غير صالح.'},{status:403})
  const body=await request.json().catch(()=>({}))
  const productId=typeof body.productId==='string'?body.productId:'';const durationMinutes=Number(body.durationMinutes)
  if(!productId||!Number.isInteger(durationMinutes))return NextResponse.json({error:'مدة المزاد غير صالحة.'},{status:400})
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'يجب تسجيل الدخول.'},{status:401})
  const {data,error}=await supabase.rpc('set_live_auction',{p_product_id:productId,p_duration_minutes:durationMinutes})
  if(error)return NextResponse.json({error:'تعذر تشغيل المزاد.'},{status:400})
  return NextResponse.json(data)
}
