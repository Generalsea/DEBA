import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type DeliveryMethod='pickup'|'seller_delivery'|'platform_delivery'
type IncomingGroup={sellerId?:unknown;deliveryMethod?:unknown;deliveryAddress?:unknown;notes?:unknown;items?:unknown}

function clean(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):''}
function mapError(message:string){const m=message.toLowerCase();if(m.includes('authenticated buyer')||m.includes('not allowed')||m.includes('cannot buy'))return {status:403,error:'هذا الطلب غير مسموح لهذا الحساب.'};if(m.includes('product is not available')||m.includes('insufficient stock')||m.includes('stock changed'))return {status:409,error:'أحد المنتجات لم يعد متاحًا أو تغيّر مخزونه. حدّث السلة وحاول مرة أخرى.'};if(m.includes('invalid ')||m.includes('delivery method not available')||m.includes('delivery address is required')||m.includes('seller does not match'))return {status:400,error:'بيانات السلة أو الاستلام غير صالحة.'};return {status:500,error:'تعذر إنشاء طلبات السلة الآن.'}}

export async function POST(request:Request){
  try{
    const origin=request.headers.get('origin');const requestOrigin=new URL(request.url).origin;if(origin&&origin!==requestOrigin)return NextResponse.json({error:'طلب غير صالح.'},{status:403})
    const supabase=await createClient();const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub
    if(typeof userId!=='string')return NextResponse.json({error:'يجب تسجيل الدخول لإتمام الشراء.'},{status:401})
    const body=(await request.json()) as {groups?:unknown;idempotencyKey?:unknown}
    if(!Array.isArray(body.groups)||body.groups.length<1||body.groups.length>20)return NextResponse.json({error:'السلة غير صالحة.'},{status:400})
    const key=clean(request.headers.get('idempotency-key'),128)||clean(body.idempotencyKey,128);if(key.length<16)return NextResponse.json({error:'تعذر تأمين الطلب. أعد المحاولة من صفحة السلة.'},{status:400})
    const groups=body.groups.map((raw)=>{
      const group=(raw&&typeof raw==='object'?raw:{}) as IncomingGroup
      const method=clean(group.deliveryMethod,30) as DeliveryMethod
      const address=(group.deliveryAddress&&typeof group.deliveryAddress==='object'?group.deliveryAddress:{}) as Record<string,unknown>
      const items=Array.isArray(group.items)?group.items.map((item)=>{const value=(item&&typeof item==='object'?item:{}) as Record<string,unknown>;return {product_id:clean(value.productId,64),quantity:Number.isInteger(value.quantity)?Number(value.quantity):0}}):[]
      return {seller_id:clean(group.sellerId,64),delivery_method:method,delivery_address:{full_name:clean(address.fullName,120),phone:clean(address.phone,30),address_line1:clean(address.addressLine1,180),district:clean(address.district,100),city:clean(address.city,100),governorate:clean(address.governorate,100)},notes:clean(group.notes,500),items}
    })
    if(groups.some((g)=>!g.seller_id||!['pickup','seller_delivery','platform_delivery'].includes(g.delivery_method)||g.items.length<1||g.items.some((i)=>!i.product_id||i.quantity<1||i.quantity>100)))return NextResponse.json({error:'بيانات السلة غير مكتملة.'},{status:400})
    const {data,error}=await supabase.rpc('create_cart_orders',{p_groups:groups,p_idempotency_key:key})
    if(error){console.error('DEBA cart order creation failed',error);const mapped=mapError(error.message||'');return NextResponse.json({error:mapped.error},{status:mapped.status})}
    if(!data||typeof data!=='object')return NextResponse.json({error:'تعذر قراءة نتيجة الطلب.'},{status:500})
    const result=data as Record<string,unknown>;const orders=Array.isArray(result.orders)?result.orders:[]
    return NextResponse.json({existing:result.existing===true,orders})
  }catch(error){console.error('DEBA cart order route failed',error);return NextResponse.json({error:'تعذر إتمام شراء السلة الآن.'},{status:500})}
}