'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateStudentAdmin(formData: {
  studentId: string
  fullName: string
  phone: string
  status: 'pending' | 'approved' | 'rejected'
  subjectIds: string[]
  notes?: string
}) {
  const supabase = await createClient()

  // 1. Update personal info, status and notes
  const { error: profileError } = await (supabase
    .from('users') as any)
    .update({
      full_name: formData.fullName,
      phone: formData.phone,
      status: formData.status,
      notes: formData.notes
    })
    .eq('id', formData.studentId)

  if (profileError) {
    return { success: false, error: profileError.message }
  }

  // 2. Update subjects (Delete existing, insert new)
  const { error: deleteError } = await (supabase
    .from('student_subjects') as any)
    .delete()
    .eq('student_id', formData.studentId)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  if (formData.subjectIds.length > 0) {
    const inserts = formData.subjectIds.map((subId) => ({
      student_id: formData.studentId,
      subject_id: subId
    }))
    const { error: insertError } = await (supabase
      .from('student_subjects') as any)
      .insert(inserts)

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  // If status is updated to approved or rejected, send notification and log activity
  const { data: { user: admin } } = await supabase.auth.getUser()
  if (admin) {
    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await (adminClient.from('notifications') as any).insert({
      user_id: formData.studentId,
      title: `Account Registration Status: ${formData.status.toUpperCase()}`,
      message: `Your SH TECH ZONE registration has been ${formData.status} by the administrator.`,
      type: 'system'
    })
  }

  return { success: true }
}

export async function resetStudentAttempt(studentId: string, examId: string) {
  // Use adminClient to bypass RLS policies for deleting attempts
  const adminClient = require('@supabase/supabase-js').createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Delete the attempt (cascades to results, exam_answers, and cheating_logs in public schema)
  const { error } = await (adminClient
    .from('exam_attempts') as any)
    .delete()
    .eq('student_id', studentId)
    .eq('exam_id', examId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Create notifications using adminClient
  await (adminClient.from('notifications') as any).insert({
    user_id: studentId,
    title: 'Exam Attempt Reset',
    message: 'Your exam attempt has been reset. You can now re-attempt the exam.',
    type: 'system'
  })

  return { success: true }
}

export async function deleteUserAccount(userId: string) {
  const supabase = await createClient()

  // To delete a user from auth.users, we need service role client because normal RLS cannot delete auth users
  const adminClient = require('@supabase/supabase-js').createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function resetUserPasswordAdmin(userId: string, newPassword: string) {
  const supabase = await createClient()

  // Get current admin user
  const { data: { user: admin } } = await supabase.auth.getUser()
  if (!admin) {
    return { success: false, error: 'Not authenticated' }
  }

  // To update user password, we need service role client
  const adminClient = require('@supabase/supabase-js').createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Log activity using adminClient to bypass RLS
  await (adminClient.from('activity_logs') as any).insert({
    user_id: admin.id,
    action: 'admin_password_reset',
    details: `Admin reset password for user ID: ${userId}`
  })

  // Create user notification using adminClient to bypass RLS
  await (adminClient.from('notifications') as any).insert({
    user_id: userId,
    title: 'Password Reset By Administrator',
    message: 'Your account password has been reset by the administrator.',
    type: 'system'
  })

  return { success: true }
}

export async function bulkUpdateStudentStatus(studentIds: string[], status: 'approved' | 'rejected') {
  const supabase = await createClient()

  // 1. Update status in bulk
  const { error: updateError } = await (supabase
    .from('users') as any)
    .update({ status })
    .in('id', studentIds)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 2. Insert notifications in bulk & log activity
  const { data: { user: admin } } = await supabase.auth.getUser()
  if (admin && studentIds.length > 0) {
    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const notifications = studentIds.map((id) => ({
      user_id: id,
      title: `Account Registration Status: ${status.toUpperCase()}`,
      message: `Your SH TECH ZONE registration has been ${status} by the administrator.`,
      type: 'system'
    }))

    const { error: notifError } = await (adminClient.from('notifications') as any).insert(notifications)
    if (notifError) {
      console.error('Failed to insert notifications in bulk:', notifError.message)
    }

    const { error: logError } = await (adminClient.from('activity_logs') as any).insert({
      user_id: admin.id,
      action: 'bulk_status_update',
      details: `Admin updated status to ${status} for ${studentIds.length} students.`
    })
    if (logError) {
      console.error('Failed to log activity in bulk:', logError.message)
    }
  }

  return { success: true }
}

export async function bulkDeleteUserAccounts(studentIds: string[]) {
  const supabase = await createClient()

  const { data: { user: admin } } = await supabase.auth.getUser()
  if (!admin) {
    return { success: false, error: 'Not authenticated' }
  }

  const adminClient = require('@supabase/supabase-js').createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const errors: string[] = []
  for (const userId of studentIds) {
    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) {
      errors.push(`User ${userId}: ${error.message}`)
    }
  }

  if (errors.length > 0) {
    await (supabase.from('activity_logs') as any).insert({
      user_id: admin.id,
      action: 'bulk_delete_failed_partial',
      details: `Admin tried to bulk delete ${studentIds.length} users. Failures: ${errors.join(', ')}`
    })
    return { success: false, error: `Failed to delete some users: ${errors.slice(0, 3).join('; ')}` }
  }

  await (supabase.from('activity_logs') as any).insert({
    user_id: admin.id,
    action: 'bulk_delete_success',
    details: `Admin bulk deleted ${studentIds.length} user accounts.`
  })

  return { success: true }
}

export async function bulkAssignSubjectToStudents(studentIds: string[], subjectId: string) {
  const supabase = await createClient()

  const { data: { user: admin } } = await supabase.auth.getUser()
  if (!admin) {
    return { success: false, error: 'Not authenticated' }
  }

  // 1. Get existing subjects assigned for these studentIds to avoid duplicate key violations
  const { data: existing, error: selectError } = await (supabase
    .from('student_subjects') as any)
    .select('student_id, subject_id')
    .in('student_id', studentIds)
    .eq('subject_id', subjectId)

  if (selectError) {
    return { success: false, error: selectError.message }
  }

  const existingStudentIds = new Set(existing?.map((row: any) => row.student_id) || [])

  // 2. Prepare inserts for users who don't have it assigned
  const inserts = studentIds
    .filter(id => !existingStudentIds.has(id))
    .map(id => ({
      student_id: id,
      subject_id: subjectId
    }))

  if (inserts.length > 0) {
    const { error: insertError } = await (supabase
      .from('student_subjects') as any)
      .insert(inserts)

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  // 3. Log activity
  await (supabase.from('activity_logs') as any).insert({
    user_id: admin.id,
    action: 'bulk_assign_subject',
    details: `Admin assigned subject ${subjectId} to ${studentIds.length} students (actual inserts: ${inserts.length}).`
  })

  return { success: true }
}



