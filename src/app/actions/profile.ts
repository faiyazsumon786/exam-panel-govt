'use server'

import { createClient } from '@/lib/supabase/server'

export async function updateProfile(formData: {
  fullName: string
  phone: string
  profilePictureUrl?: string
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await (supabase
    .from('users') as any)
    .update({
      full_name: formData.fullName,
      phone: formData.phone,
      profile_picture: formData.profilePictureUrl || undefined,
      profile_completed: true
    })
    .eq('id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Create an activity log
  await (supabase.from('activity_logs') as any).insert({
    user_id: user.id,
    action: 'profile_update',
    details: 'Updated profile information'
  })

  return { success: true }
}
