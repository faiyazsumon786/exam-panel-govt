'use server'

import { createAdminClient } from '@/lib/supabase/server'

/**
 * Resolves a student's email using their phone number variation.
 * Enables login using registered phone number or email.
 */
export async function resolveEmailByPhoneAction(phoneOrEmail: string): Promise<string | null> {
  const trimmedInput = phoneOrEmail.trim()
  if (trimmedInput.includes('@')) {
    return trimmedInput
  }

  // Extract digits
  const clean = trimmedInput.replace(/[^\d]/g, '')
  if (clean.length < 9) {
    return null
  }

  // Formulate variations of Bangladeshi phone numbers to search
  const variations: string[] = [clean]
  if (clean.startsWith('880') && clean.length === 13) {
    variations.push('0' + clean.slice(3))
    variations.push(clean.slice(3))
  } else if (clean.startsWith('0') && clean.length === 11) {
    variations.push('880' + clean.slice(1))
    variations.push(clean.slice(1))
  } else if (clean.length === 10) {
    variations.push('0' + clean)
    variations.push('880' + clean)
  }

  // Support database values that include a leading '+' prefix (e.g. +880...)
  const plusVariations = variations
    .filter(v => v.startsWith('880'))
    .map(v => '+' + v)
  variations.push(...plusVariations)

  try {
    const adminClient = createAdminClient()
    const { data, error } = await (adminClient
      .from('users') as any)
      .select('email')
      .in('phone', variations)
      .limit(1)

    if (error || !data || data.length === 0) {
      return null
    }

    return data[0].email
  } catch (err) {
    console.error('Failed to resolve email by phone:', err)
    return null
  }
}
