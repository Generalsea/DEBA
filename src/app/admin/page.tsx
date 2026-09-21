import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import AdminModeration from '@/components/AdminModeration'
import { createClient } from '@/utils/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user

  if (!user) redirect('/login?next=%2Fadmin')

  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'moderator'])
    .limit(1)
    .maybeSingle()

  if (!role) redirect('/')

  return (
    <>
      <Header />
      <main className="deba-admin-page" dir="rtl">
        <AdminModeration />
      </main>
    </>
  )
}
