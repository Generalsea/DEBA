import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import ChatWorkspace from '@/components/ChatWorkspace'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ChatPage({
  searchParams,
}: {
  searchParams?: Promise<{ product?: string }>
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (typeof data?.claims?.sub !== 'string') redirect('/login?next=%2Fchat')

  const product = (await searchParams)?.product || ''
  const { data: categoryRows } = await supabase
    .from('categories')
    .select('id,name_ar,slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return (
    <>
      <Header
        variant="classified"
        categories={(categoryRows || []).map((item) => ({ id: item.id, nameAr: item.name_ar, slug: item.slug }))}
      />
      <main className="deba-chat-page" dir="rtl">
        <ChatWorkspace initialProduct={product} />
      </main>
    </>
  )
}