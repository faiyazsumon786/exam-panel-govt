'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper to check if current user is an admin
async function checkAdminAuth() {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  
  if (!currentUser) {
    return { authorized: false, error: 'Not authenticated', adminUser: null }
  }

  const { data: profile, error } = await (supabase
    .from('users') as any)
    .select('role')
    .eq('id', currentUser.id)
    .single()

  if (error || !profile || profile.role !== 'admin') {
    return { authorized: false, error: 'Unauthorized: Admin access required', adminUser: null }
  }

  return { authorized: true, adminUser: currentUser }
}

// Fetch all users with their subjects
export async function fetchUsersAction() {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    throw new Error(authCheck.error)
  }

  const adminClient = createAdminClient()
  
  const { data, error } = await (adminClient
    .from('users') as any)
    .select(`
      *,
      student_subjects(subject_id),
      mentor_subjects(subject_id)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching users:', error)
    throw new Error(error.message)
  }

  return data || []
}

// Create a new user (admin, mentor, student)
export async function createUserAction(formData: {
  email: string
  password: string
  fullName: string
  phone: string
  role: 'admin' | 'mentor' | 'student'
  status: 'pending' | 'approved' | 'rejected'
  subjectIds: string[]
}) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const adminClient = createAdminClient()

  // 1. Create user in Supabase Auth
  const { data, error: authError } = await adminClient.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    email_confirm: true,
    user_metadata: {
      role: formData.role,
      full_name: formData.fullName,
      phone: formData.phone,
    }
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  const userId = data.user?.id
  if (!userId) {
    return { success: false, error: 'Failed to create auth user.' }
  }

  try {
    // 2. The trigger automatically creates public.users row with default status.
    // Let's update it to ensure the admin's chosen status and details are exactly matched.
    const { error: profileError } = await (adminClient
      .from('users') as any)
      .update({
        status: formData.status,
        profile_completed: formData.role === 'admin' ? true : false,
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Error updating profile status:', profileError)
    }

    // 3. Assign subjects if mentor or student
    if (formData.subjectIds && formData.subjectIds.length > 0) {
      if (formData.role === 'student') {
        const inserts = formData.subjectIds.map((subId) => ({
          student_id: userId,
          subject_id: subId,
        }))
        const { error: subErr } = await (adminClient.from('student_subjects') as any).insert(inserts)
        if (subErr) console.error('Error assigning student subjects:', subErr)
      } else if (formData.role === 'mentor') {
        const inserts = formData.subjectIds.map((subId) => ({
          mentor_id: userId,
          subject_id: subId,
        }))
        const { error: subErr } = await (adminClient.from('mentor_subjects') as any).insert(inserts)
        if (subErr) console.error('Error assigning mentor subjects:', subErr)
      }
    }

    // 4. Log activity
    await (adminClient.from('activity_logs') as any).insert({
      user_id: authCheck.adminUser?.id,
      action: 'admin_create_user',
      details: `Admin created user: ${formData.fullName} (${formData.email}) as role ${formData.role} with status ${formData.status}.`
    })

    // 5. Send notification to the newly created user (except admins)
    if (formData.role !== 'admin') {
      await (adminClient.from('notifications') as any).insert({
        user_id: userId,
        title: 'Account Created By Administrator',
        message: `Your account status is currently ${formData.status.toUpperCase()}.`,
        type: 'system'
      })
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (err: any) {
    console.error('Error finishing user setup:', err)
    return { success: true, warning: 'Auth account created, but profile configuration encountered errors.' }
  }
}

// Update an existing user
export async function updateUserAction(
  userId: string,
  formData: {
    email: string
    fullName: string
    phone: string
    role: 'admin' | 'mentor' | 'student'
    status: 'pending' | 'approved' | 'rejected'
    subjectIds: string[]
  }
) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const adminClient = createAdminClient()

  // 1. Update user email and metadata in Auth
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    email: formData.email,
    user_metadata: {
      role: formData.role,
      full_name: formData.fullName,
      phone: formData.phone,
    }
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  // 2. Update public.users profile details
  const { error: profileError } = await (adminClient
    .from('users') as any)
    .update({
      full_name: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      role: formData.role,
      status: formData.status,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (profileError) {
    return { success: false, error: profileError.message }
  }

  // 3. Update subject relations
  // Clear any existing subjects first
  await (adminClient.from('student_subjects') as any).delete().eq('student_id', userId)
  await (adminClient.from('mentor_subjects') as any).delete().eq('mentor_id', userId)

  // Re-insert subjects if appropriate role and subjects selected
  if (formData.subjectIds && formData.subjectIds.length > 0) {
    if (formData.role === 'student') {
      const inserts = formData.subjectIds.map((subId) => ({
        student_id: userId,
        subject_id: subId,
      }))
      const { error: subErr } = await (adminClient.from('student_subjects') as any).insert(inserts)
      if (subErr) console.error('Error setting student subjects:', subErr)
    } else if (formData.role === 'mentor') {
      const inserts = formData.subjectIds.map((subId) => ({
        mentor_id: userId,
        subject_id: subId,
      }))
      const { error: subErr } = await (adminClient.from('mentor_subjects') as any).insert(inserts)
      if (subErr) console.error('Error setting mentor subjects:', subErr)
    }
  }

  // 4. Log action
  await (adminClient.from('activity_logs') as any).insert({
    user_id: authCheck.adminUser?.id,
    action: 'admin_update_user',
    details: `Admin updated user details for: ${formData.fullName} (ID: ${userId}).`
  })

  // 5. Send notification to user about profile changes
  await (adminClient.from('notifications') as any).insert({
    user_id: userId,
    title: 'Account Settings Updated',
    message: `Your account details were updated by the administrator. Status: ${formData.status.toUpperCase()}.`,
    type: 'system'
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// Delete a user (cascades to public.users automatically)
export async function deleteUserAction(userId: string) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  // Guard: Admin cannot delete themselves
  if (userId === authCheck.adminUser?.id) {
    return { success: false, error: 'Safety Guard: You cannot delete your own administrative account.' }
  }

  const adminClient = createAdminClient()

  // Fetch name for logging before delete
  const { data: userProfile } = await (adminClient
    .from('users') as any)
    .select('full_name, email')
    .eq('id', userId)
    .single()

  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) {
    return { success: false, error: error.message }
  }

  // Log activity
  await (adminClient.from('activity_logs') as any).insert({
    user_id: authCheck.adminUser?.id,
    action: 'admin_delete_user',
    details: `Admin permanently deleted user account: ${userProfile?.full_name || 'Unknown'} (${userProfile?.email || 'Unknown'}, ID: ${userId}).`
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// Reset User Password
export async function resetUserPasswordAction(userId: string, newPassword: string) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' }
  }

  const adminClient = createAdminClient()

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Log action
  await (adminClient.from('activity_logs') as any).insert({
    user_id: authCheck.adminUser?.id,
    action: 'admin_reset_password',
    details: `Admin reset password for user ID: ${userId}`
  })

  // Notify user
  await (adminClient.from('notifications') as any).insert({
    user_id: userId,
    title: 'Password Updated by Admin',
    message: 'Your account password has been reset by the administrator.',
    type: 'system'
  })

  return { success: true }
}
