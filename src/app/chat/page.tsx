import { redirect } from 'next/navigation'
import ChatCommsExact from '@/components/ChatCommsExact'
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
    <main className="deba-chat-page" dir="rtl" style={{ position: 'fixed', inset: 0, padding: 0, margin: 0, overflow: 'hidden' }}>
      <ChatCommsExact initialProduct={product} />
    </main>
  )
}
