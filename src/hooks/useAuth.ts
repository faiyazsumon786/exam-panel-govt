'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function useAuth() {
  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Get current auth session user
  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    }
  })

  // Get profile from public.users table
  const { data: profile, isLoading: isProfileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!user
  })

  // Sign out mutation
  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.clear()
      toast.success('Successfully logged out')
      router.push('/login')
      router.refresh()
    },
    onError: (error: any) => {
      toast.error(`Error logging out: ${error.message}`)
    }
  })

  const isLoading = isUserLoading || (!!user && isProfileLoading)

  return {
    user,
    profile: profile as any,
    isLoading,
    signOut: () => signOutMutation.mutate(),
    refetchProfile: refetchProfile as any
  }
}
