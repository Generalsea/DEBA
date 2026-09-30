import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
export async function GET(request:Request){
  const authHeader=request.headers.get('authorization');const secret=process.env.CRON_SECRET
  if(!secret||authHeader!=='Bearer '+secret)return new Response('Unauthorized',{status:401})
  const admin=createAdminClient();const {data,error}=await admin.rpc('run_deba_auto_refresh_engine')
  if(error){console.error('DEBA auto-refresh cron failed',error);return NextResponse.json({error:'Auto-refresh engine failed.'},{status:500})}
  return NextResponse.json({ok:true,refreshed:Number(data||0)})
}
