'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import { moveSavedItemToCart, useCartStore } from '@/lib/cart-store'
import { SellerGroup } from '@/components/cart/SellerGroup'
import { CartSummary } from '@/components/cart/CartSummary'
import { EmptyCart } from '@/components/cart/EmptyCart'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { CartItem, DeliveryMethod } from '@/lib/types'
import Header from '@/components/Header'

function supports(productMethod:string,selected:DeliveryMethod){return productMethod===selected||(productMethod==='both'&&selected!=='platform_delivery')}
function common(items:CartItem[]){return (['pickup','seller_delivery','platform_delivery'] as DeliveryMethod[]).some((m)=>items.length>0&&items.every((i)=>supports(i.product.deliveryMethod,m)))}

export default function CartPage(){
 const cart=useCartStore()
 const grouped=useMemo(()=>{const map=new Map<string,{sellerName:string;sellerAvatar:string|null;items:CartItem[]}>();for(const item of cart.items){const id=item.product.sellerId;const g=map.get(id);if(g)g.items.push(item);else map.set(id,{sellerName:item.product.sellerName,sellerAvatar:item.product.sellerAvatar,items:[item]})}return map},[cart.items])
 const checkoutAllowed=cart.items.length>0&&cart.items.every(i=>i.product.quantityAvailable>0&&i.quantity<=i.product.quantityAvailable)&&Array.from(grouped.values()).every(g=>common(g.items))
 if(!cart.hydrated)return <><Header/><LoadingSkeleton type="cart"/></>
 if(cart.items.length===0&&cart.savedItems.length===0)return <><Header/><EmptyCart/></>
 return <><Header cartCount={cart.items.reduce((n,i)=>n+i.quantity,0)}/><main className="deba-cart-page" dir="rtl"><header className="deba-cart-hero"><div><span>DEBA CART</span><h1>سلة التسوق</h1><p>{cart.items.reduce((n,i)=>n+i.quantity,0)} منتجات في السلة — اجمع مشترياتك ثم راجع كل بائع على حدة.</p></div><Link href="/#featured" className="deba-cart-continue">متابعة التسوق<ArrowLeft size={17}/></Link></header>
 <div className="deba-cart-layout"><section className="deba-cart-main"><div className="deba-cart-section-head"><div><span>YOUR ITEMS</span><h2>منتجاتك</h2></div><span>{cart.items.length} سطور في السلة</span></div>
 {Array.from(grouped.entries()).map(([sellerId,g])=><SellerGroup key={sellerId} sellerId={sellerId} sellerName={g.sellerName} sellerAvatar={g.sellerAvatar} items={g.items}/>)}
 {cart.savedItems.length>0?<section className="deba-cart-saved-section"><div className="deba-cart-section-head"><div><span>SAVED FOR LATER</span><h2>محفوظ لوقت لاحق</h2></div><span>{cart.savedItems.length}</span></div><div className="deba-cart-saved-list">{cart.savedItems.map(item=><article key={item.id} className="deba-cart-saved-item"><div><strong>{item.product.title}</strong><span>{item.product.price.toLocaleString('ar-EG')} {item.product.currency}</span></div><button type="button" className="deba-cart-secondary-action" onClick={()=>moveSavedItemToCart(item.id)}>إعادة للسلة</button></article>)}</div></section>:null}
 {!checkoutAllowed&&cart.items.length>0?<div className="deba-cart-blocker" role="alert"><ShoppingBag size={18}/><div><strong>السلة تحتاج مراجعة قبل المتابعة</strong><span>يوجد منتج غير متاح أو كمية تتجاوز المخزون أو مجموعة بائع لا تملك طريقة استلام مشتركة.</span></div></div>:null}
 </section><CartSummary checkoutAllowed={checkoutAllowed}/></div></main></>
}