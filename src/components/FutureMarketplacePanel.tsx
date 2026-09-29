'use client'

import { useCallback,useEffect,useMemo,useState } from 'react'
import { Coins,Gavel,RefreshCw,ShieldCheck,Sparkles } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import styles from './FutureMarketplacePanel.module.css'

type AuctionState={productId:string;isLive:boolean;startsAt:string|null;endsAt:string|null;offerCount:number;leadingAmount:number|null;currency:string;listingPrice:number|null}

export default function FutureMarketplacePanel({productId,isOwner,currency,listingPrice}:{productId:string;isOwner:boolean;currency:string;listingPrice:number|null}){
 const [auction,setAuction]=useState<AuctionState|null>(null),[coins,setCoins]=useState(0),[floor,setFloor]=useState(''),[offer,setOffer]=useState(''),[message,setMessage]=useState(''),[minutes,setMinutes]=useState('120'),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false)
 const supabase=useMemo(()=>createClient(),[])
 const refresh=useCallback(async()=>{
  const a=await fetch('/api/auctions?productId='+encodeURIComponent(productId),{cache:'no-store'});const body=a.ok?await a.json():null
  if(body?.state)setAuction(body.state)
  if(isOwner){const c=await supabase.rpc('get_my_coin_balance');if(c.data?.balance!==undefined)setCoins(Number(c.data.balance)||0)}
 },[isOwner,productId,supabase])
 useEffect(()=>{void refresh();const t=window.setInterval(()=>void refresh(),10000);const ch=supabase.channel('deba-auction-'+productId).on('postgres_changes',{event:'*',schema:'public',table:'offers',filter:'product_id=eq.'+productId},()=>void refresh()).subscribe();return()=>{window.clearInterval(t);void supabase.removeChannel(ch)}},[productId,refresh,supabase])
 const remaining=auction?.endsAt?Math.max(0,Math.floor((new Date(auction.endsAt).getTime()-Date.now())/1000)):0
 const countdown=remaining?[Math.floor(remaining/3600),Math.floor((remaining%3600)/60),remaining%60].map(v=>String(v).padStart(2,'0')).join(':'):'—'
 const post=async(url:string,body:unknown,okText:string)=>{setBusy(true);setFeedback('');try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'تعذر تنفيذ العملية');setFeedback(data.smartDecision==='auto_countered'?'أرسلنا لك عرضًا مقابل تلقائيًا.':data.smartDecision==='accepted_escrow'?'تم قبول العرض وفتح مسار الصفقة الآمن.':data.message||okText);await refresh();return data}catch(e){setFeedback(e instanceof Error?e.message:'تعذر تنفيذ العملية');return null}finally{setBusy(false)}}
 return <section className={styles.panel} aria-label="محرك DEBA المستقبلي">
  <div className={styles.header}><div><span className={styles.eyebrow}><Sparkles size={15}/> DEBA FUTURE ENGINE</span><h2>صفقة تتحرك مع السوق</h2></div>{isOwner?<div className={styles.coinPill}><Coins size={16}/>{coins.toLocaleString('ar-EG')} Coins</div>:null}</div>
  <div className={styles.grid}>
   <div className={styles.card}><div className={styles.cardTitle}><Gavel size={18}/> المزاد اللحظي</div><div className={styles.metric}><strong>{auction?.isLive?countdown:'غير نشط'}</strong><span>{auction?.offerCount||0} عرض نشط</span></div><p className={styles.muted}>{auction?.leadingAmount?'أعلى عرض: '+auction.leadingAmount.toLocaleString('ar-EG')+' '+auction.currency:'ابدأ الجولة من إعدادات الإعلان.'}</p>
    {isOwner?<div className={styles.controls}><input inputMode="numeric" value={minutes} onChange={e=>setMinutes(e.target.value)} aria-label="مدة المزاد بالدقائق"/><button disabled={busy} onClick={()=>void post('/api/auctions',{productId,durationMinutes:Number(minutes)},'تم تشغيل المزاد')}><Gavel size={15}/> تشغيل</button></div>:<div className={styles.offerForm}><input inputMode="decimal" value={offer} onChange={e=>setOffer(e.target.value)} placeholder={'قيمة العرض بـ '+currency} aria-label="قيمة العرض"/><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="رسالة اختيارية" aria-label="رسالة العرض"/><button disabled={busy||!offer} onClick={()=>void post('/api/smart-offers',{productId,amount:Number(offer),message},'تم إرسال العرض')}><Gavel size={15}/> أرسل العرض</button></div>}
   </div>
   <div className={styles.card}><div className={styles.cardTitle}><ShieldCheck size={18}/> أرضية السعر السرّية</div><p className={styles.muted}>الحد الأدنى يبقى في المخطط الخاص ولا يدخل في نتائج المشتري.</p>{isOwner?<div className={styles.controls}><input inputMode="decimal" value={floor} onChange={e=>setFloor(e.target.value)} placeholder={listingPrice?String(Math.round(listingPrice)):'الحد الأدنى'} aria-label="الحد الأدنى السري"/><button disabled={busy||!floor} onClick={()=>void post('/api/smart-offers/floor',{productId,floorAmount:Number(floor),autoCounterEnabled:true},'تم حفظ الأرضية السرية')}><ShieldCheck size={15}/> حفظ الأرضية</button></div>:<span className={styles.locked}>محمي — لا يقرأه المشتري.</span>}</div>
   {isOwner?<div className={styles.card}><div className={styles.cardTitle}><RefreshCw size={18}/> اقتصاد Coins</div><p className={styles.muted}>Super Boost وStealth Pin وAuto-Refresh تُخصم ذرّيًا من الرصيد.</p><div className={styles.boosts}><button disabled={busy} onClick={()=>void post('/api/boosts',{productId,boostType:'super_boost',durationMinutes:1440},'تم تفعيل Super Boost')}>Super Boost</button><button disabled={busy} onClick={()=>void post('/api/boosts',{productId,boostType:'stealth_pin',durationMinutes:4320},'تم تفعيل Stealth Pin')}>Stealth Pin</button><button disabled={busy} onClick={()=>void post('/api/boosts',{productId,boostType:'auto_refresh',durationMinutes:10080},'تم تفعيل Auto-Refresh')}>Auto-Refresh</button></div></div>:null}
  </div>
  {feedback?<div className={styles.feedback} role="status">{feedback}</div>:null}
 </section>
}
