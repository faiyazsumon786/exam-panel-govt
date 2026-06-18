'use server'

import { createAdminClient } from '@/lib/supabase/server'

export async function registerUser(formData: {
  email: string
  password: string
  fullName: string
  phone: string
  role: 'student' | 'mentor'
  subjectIds: string[]
  profilePictureUrl?: string
}) {
  const supabaseAdmin = createAdminClient()

  // 1. Create the user via Supabase Admin Auth API (bypassing confirmation email rate limits)
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    email_confirm: true,
    user_metadata: {
      role: formData.role,
      full_name: formData.fullName,
      phone: formData.phone,
    },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const userId = data.user?.id

  if (!userId) {
    return { success: false, error: 'Registration completed but user ID was not resolved.' }
  }

  // 2. Insert subject relations using the admin client to bypass any RLS limitations
  if (formData.subjectIds && formData.subjectIds.length > 0) {
    if (formData.role === 'student') {
      const inserts = formData.subjectIds.map((subId) => ({
        student_id: userId,
        subject_id: subId,
      }))
      const { error: subErr } = await (supabaseAdmin.from('student_subjects') as any).insert(inserts)
      if (subErr) {
        console.error('Error inserting student subjects')
      }
    } else if (formData.role === 'mentor') {
      const inserts = formData.subjectIds.map((subId) => ({
        mentor_id: userId,
        subject_id: subId,
      }))
      const { error: subErr } = await (supabaseAdmin.from('mentor_subjects') as any).insert(inserts)
      if (subErr) {
        console.error('Error inserting mentor subjects')
      }
    }
  }

  // 3. Update profile picture if uploaded using admin client
  if (formData.profilePictureUrl) {
    const { error: updateErr } = await (supabaseAdmin
      .from('users') as any)
      .update({ profile_picture: formData.profilePictureUrl })
      .eq('id', userId)
    if (updateErr) {
      console.error('Error updating profile picture')
    }
  }

  // 4. Create notification for admin using admin client
  await (supabaseAdmin.from('notifications') as any).insert({
    title: 'New Account Registration',
    message: `${formData.fullName} has registered as a ${formData.role} and is pending approval.`,
    type: 'new_registration'
  })

  return { success: true }
}

