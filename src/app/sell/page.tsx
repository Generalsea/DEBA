import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { redirect } from 'next/navigation'
import Header, { type HeaderCategory } from '@/components/Header'
import ProductListingForm, {
  type SellAttributeDefinition,
  type SellCategory,
} from './ProductListingForm'
import { createClient } from '@/utils/supabase/server'

export default async function SellPage({
  searchParams,
}: {
  searchParams?: Promise<{ submitted?: string }>
}) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const { submitted } = (await searchParams) || {}
  const userId = claimsData?.claims?.sub
  if (typeof userId !== 'string') {
    redirect('/login')
  }

  const [{ data: profile }, { data: categories }, { data: definitions }] = await Promise.all([
    supabase.from('profiles').select('account_type').eq('id', userId).maybeSingle(),
    supabase
      .from('categories')
      .select('id,name_ar,name_en,slug')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('category_attribute_definitions')
      .select('id,category_id,key,label_ar,label_en,data_type,unit,is_required,help_text_ar,sort_order')
      .eq('is_required', true)
      .order('sort_order', { ascending: true }),
  ])

  if (profile?.account_type !== 'seller') {
    return (
      <>
        <Header
          categories={((categories || []) as Array<{ id: string; name_ar: string; slug: string }>).map(
            (item): HeaderCategory => ({
              id: item.id,
              nameAr: item.name_ar,
              slug: item.slug,
            }),
          )}
        />
        <main className="deba-detail-page" dir="rtl">
          <section className="deba-detail-state-page">
            <div className="deba-detail-state-card">
              <div className="deba-detail-state-icon">
                <ShieldCheck size={27} />
              </div>
              <span className="deba-detail-state-kicker">SELLER ACCESS</span>
              <h1>الحساب الحالي ليس حساب بائع</h1>
              <p>
                فعّل وضع البائع من صفحة حسابك، ثم ستتمكن من إدخال السلعة وفق عقد بيانات DEBA الإلزامي.
              </p>
              <Link href="/" className="deba-detail-state-action">العودة إلى السوق</Link>
            </div>
          </section>
        </main>
      </>
    )
  }

  const mappedCategories = ((categories || []) as SellCategory[]).map((item) => item)

  return (
    <>
      <Header
        categories={mappedCategories.map(
          (item): HeaderCategory => ({
            id: item.id,
            nameAr: item.name_ar,
            slug: item.slug,
          }),
        )}
      />
      <main className="deba-sell-page" dir="rtl">
        <div className="deba-sell-breadcrumbs">
          <Link href="/">السوق</Link>
          <span>/</span>
          <strong>إضافة سلعة</strong>
        </div>
        {submitted === '1' && (
          <div className="deba-sell-notice is-success">
            <ShieldCheck size={18} />
            <span>تم إرسال الإعلان للمراجعة بنجاح. لن يظهر للزوار إلا بعد اعتماد المراجعة.</span>
          </div>
        )}
        <ProductListingForm
          categories={mappedCategories}
          definitions={(definitions || []) as SellAttributeDefinition[]}
        />
      </main>
    </>
  )
}
