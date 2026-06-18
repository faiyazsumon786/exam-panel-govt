'use server'

import { createClient } from '@/lib/supabase/server'

export async function createAnnouncement(title: string, description: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await (supabase.from('announcements') as any).insert({
    title,
    description,
    created_by: user.id
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteAnnouncement(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
