'use server'

import { createClient } from '@/lib/supabase/server'

export async function updateMentorAdmin(formData: {
  mentorId: string
  fullName: string
  phone: string
  status: 'pending' | 'approved' | 'rejected'
  subjectIds: string[]
}) {
  const supabase = await createClient()

  // 1. Update personal info and status
  const { error: profileError } = await (supabase
    .from('users') as any)
    .update({
      full_name: formData.fullName,
      phone: formData.phone,
      status: formData.status
    })
    .eq('id', formData.mentorId)

  if (profileError) {
    return { success: false, error: profileError.message }
  }

  // 2. Update subjects (Delete existing, insert new)
  const { error: deleteError } = await (supabase
    .from('mentor_subjects') as any)
    .delete()
    .eq('mentor_id', formData.mentorId)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  if (formData.subjectIds.length > 0) {
    const inserts = formData.subjectIds.map((subId) => ({
      mentor_id: formData.mentorId,
      subject_id: subId
    }))
    const { error: insertError } = await (supabase
      .from('mentor_subjects') as any)
      .insert(inserts)

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  // Notify mentor
  await (supabase.from('notifications') as any).insert({
    user_id: formData.mentorId,
    title: `Account Registration Status: ${formData.status.toUpperCase()}`,
    message: `Your Luminous Tech mentor registration has been ${formData.status} by the administrator.`,
    type: 'system'
  })

  return { success: true }
}
