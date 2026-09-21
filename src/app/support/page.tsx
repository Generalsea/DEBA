import { redirect } from 'next/navigation'
import Header, { type HeaderCategory } from '@/components/Header'
import SupportCenter from '@/components/SupportCenter'
import { createClient } from '@/utils/supabase/server'

type CategoryRow = {
  id: string
  name_ar: string
  slug: string
}

export default async function SupportPage() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub

  if (typeof userId !== 'string') {
    redirect('/login?next=%2Fsupport')
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id,name_ar,slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const headerCategories = ((categories || []) as CategoryRow[]).map(
    (category): HeaderCategory => ({
      id: category.id,
      nameAr: category.name_ar,
      slug: category.slug,
    }),
  )

  return (
    <>
      <Header categories={headerCategories} />
      <main className="deba-support-page" dir="rtl">
        <SupportCenter />
      </main>
    </>
  )
}
