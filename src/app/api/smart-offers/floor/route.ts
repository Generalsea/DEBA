import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
export async function POST(request:Request){
  const origin=request.headers.get('origin')
  if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:'طلب غير صالح.'},{status:403})
  const body=await request.json().catch(()=>({}))
  const productId=typeof body.productId==='string'?body.productId:''
  const floorAmount=body.floorAmount==null?null:Number(body.floorAmount)
  const autoCounterEnabled=body.autoCounterEnabled!==false
  if(!productId||(floorAmount!==null&&(!Number.isFinite(floorAmount)||floorAmount<=0)))
    return NextResponse.json({error:'أرضية السعر غير صالحة.'},{status:400})
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'يجب تسجيل الدخول.'},{status:401})
  const {data,error}=await supabase.rpc('set_smart_offer_floor',{p_product_id:productId,p_floor_amount:floorAmount,p_auto_counter_enabled:autoCounterEnabled})
  if(error)return NextResponse.json({error:'تعذر حفظ الأرضية السرية.'},{status:400})
  return NextResponse.json(data)
}
