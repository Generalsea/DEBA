import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
export async function POST(request:Request){
  const origin=request.headers.get('origin')
  if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:'طلب غير صالح.'},{status:403})
  const body=await request.json().catch(()=>({}))
  const orderId=typeof body.orderId==='string'?body.orderId:''
  const action=body.action==='verify'?'verify':'generate'
  const code=typeof body.code==='string'?body.code:''
  if(!orderId)return NextResponse.json({error:'رقم الطلب مطلوب.'},{status:400})
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'يجب تسجيل الدخول.'},{status:401})
  const result=action==='verify'
    ?await supabase.rpc('verify_trade_handshake_code',{p_order_id:orderId,p_code:code})
    :await supabase.rpc('generate_trade_handshake_code',{p_order_id:orderId})
  if(result.error)return NextResponse.json({error:'تعذر تنفيذ المصافحة الآمنة.'},{status:400})
  return NextResponse.json(result.data)
}
