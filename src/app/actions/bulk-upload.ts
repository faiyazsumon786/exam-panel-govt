'use server'

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// Setup Supabase admin client using the service role key
async function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export interface BulkImportRow {
  email: string
  password: string
  fullName?: string
  phone?: string
}

export interface ImportResult {
  successCount: number
  failedRows: { row: number; email: string; reason: string }[]
}

export async function bulkImportUsers(
  rows: BulkImportRow[],
  role: 'student' | 'mentor',
  subjectId?: string
): Promise<ImportResult> {
  const adminClient = await getAdminClient()
  const results: ImportResult = {
    successCount: 0,
    failedRows: [],
  }

  for (let i = 0; i < rows.length; i++) {
    const { email, password, fullName, phone } = rows[i]
    const rowNum = i + 1

    // Parse email vs phone number
    let userEmail = (email || '').trim()
    let userPhone = (phone || '').trim()
    let userFullName = (fullName || '').trim()

    if (!userEmail && !userPhone) {
      results.failedRows.push({
        row: rowNum,
        email: '(blank)',
        reason: 'Identifier (Email or Phone) is required',
      })
      continue
    }

    // If email is blank but phone is provided, create dummy email
    if (!userEmail && userPhone) {
      userEmail = `${userPhone.replace(/[^\d+]/g, '')}@luminous.com`
    }

    if (!userEmail.includes('@')) {
      // Clean phone number: remove non-digits/non-plus signs
      const cleanPhone = userEmail.replace(/[^\d+]/g, '')
      if (cleanPhone.length >= 6) {
        if (!userPhone) userPhone = cleanPhone
        userEmail = `${cleanPhone}@luminous.com`
        if (!userFullName) {
          userFullName = `${role.charAt(0).toUpperCase() + role.slice(1)} (${cleanPhone})`
        }
      } else {
        results.failedRows.push({
          row: rowNum,
          email,
          reason: 'Invalid email address or phone number (must be at least 6 digits)',
        })
        continue
      }
    } else {
      if (!userFullName) {
        userFullName = `${role.charAt(0).toUpperCase() + role.slice(1)} (${userEmail.split('@')[0]})`
      }
    }

    // Clean phone format if present
    if (userPhone) {
      userPhone = userPhone.replace(/[^\d+]/g, '')
    }

    if (!password || password.length < 6) {
      results.failedRows.push({
        row: rowNum,
        email,
        reason: 'Password must be at least 6 characters',
      })
      continue
    }

    try {
      // Create user using Supabase Auth Admin API
      const { data, error } = await adminClient.auth.admin.createUser({
        email: userEmail,
        password,
        email_confirm: true,
        user_metadata: {
          role,
          full_name: userFullName,
          phone: userPhone || null,
          status: 'approved', // Bulk-uploaded users are pre-approved by default
        },
      })

      if (error) {
        results.failedRows.push({
          row: rowNum,
          email,
          reason: error.message,
        })
      } else {
        results.successCount++
        if (role === 'student' && subjectId && data?.user?.id) {
          const { error: subError } = await (adminClient
            .from('student_subjects') as any)
            .insert({
              student_id: data.user.id,
              subject_id: subjectId
            })
          if (subError) {
            console.error(`Failed to assign subject for row ${rowNum}:`, subError.message)
          }
        }
      }
    } catch (err: any) {
      results.failedRows.push({
        row: rowNum,
        email,
        reason: err.message || 'Unknown server error',
      })
    }
  }

  return results
}
