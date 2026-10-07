import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireVerifiedPhone } from '@/utils/auth/phoneTrust'
export async function POST(request:Request){
  const origin=request.headers.get('origin')
  if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:'طلب غير صالح.'},{status:403})
  const body=await request.json().catch(()=>({}))
  const productId=typeof body.productId==='string'?body.productId:''
  const amount=Number(body.amount)
  const message=typeof body.message==='string'?body.message.slice(0,1000):''
  if(!productId||!Number.isFinite(amount)||amount<=0)return NextResponse.json({error:'العرض غير صالح.'},{status:400})
  const trust=await requireVerifiedPhone()
  if(trust.response)return trust.response
  const supabase=trust.supabase
  const user=trust.user
  const {data,error}=await supabase.rpc('submit_smart_offer',{p_product_id:productId,p_amount:amount,p_message:message})
  if(error)return NextResponse.json({error:'تعذر معالجة العرض الذكي.'},{status:400})
  return NextResponse.json(data)
}
