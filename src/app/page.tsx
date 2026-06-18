import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function IndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = (await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()) as any

    redirect(profile?.role ? `/${profile.role}` : '/login')
  } else {
    redirect('/login')
  }
}
