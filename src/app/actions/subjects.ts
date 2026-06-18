'use server'

import { createClient } from '@/lib/supabase/server'

export async function createSubject(name: string, description?: string) {
  const supabase = await createClient()
  const { error } = await (supabase.from('subjects') as any).insert({ name, description })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateSubject(id: string, name: string, description?: string) {
  const supabase = await createClient()
  const { error } = await (supabase.from('subjects') as any).update({ name, description }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteSubject(id: string) {
  const supabase = await createClient()
  const { error } = await (supabase.from('subjects') as any).delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
