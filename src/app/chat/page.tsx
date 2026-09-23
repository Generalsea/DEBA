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

  return (
    <>
      <Header />
      <main className="deba-chat-page" dir="rtl">
        <ChatWorkspace initialProduct={product} />
      </main>
    </>
  )
}