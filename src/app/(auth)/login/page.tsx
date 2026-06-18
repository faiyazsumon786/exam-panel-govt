'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as zod from 'zod'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Lock, Mail } from 'lucide-react'
import { Footer } from '@/components/shared/Footer'

const loginSchema = zod.object({
  email: zod.string().min(1, 'Email or Phone number is required'),
  password: zod.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormValues = zod.infer<typeof loginSchema>

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true)
    try {
      let loginEmail = values.email.trim()
      if (!loginEmail.includes('@')) {
        loginEmail = `${loginEmail}@luminous.com`
      }

      const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: values.password,
      })

      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      if (session?.user) {
        // Query the profile to find out the role & status
        const { data: profile, error: profileError } = (await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()) as any

        if (profileError) {
          toast.error('Failed to load user profile.')
          setLoading(false)
          return
        }

        toast.success(`Welcome back, ${session.user.email}!`)
        
        if (profile.status === 'pending') {
          router.push('/pending')
        } else if (profile.status === 'rejected') {
          router.push('/unauthorized')
        } else {
          router.push(`/${profile.role}`)
        }
        router.refresh()
      }
    } catch (err: any) {
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />
      
      {/* Animated Floating Glow Spheres */}
      <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-indigo-600/10 blur-[100px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-cyan-600/10 blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      <div className="flex-1 flex items-center justify-center w-full max-w-md relative z-10 my-8 animate-fade-in-up">
        <Card className="w-full border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl glow-card transition-all duration-300">
          <CardHeader className="space-y-2 text-center pb-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 border border-slate-800 mb-2 overflow-hidden shadow-md group hover:border-indigo-500/40 transition-colors duration-300">
              <img src="/logo.jpg" alt="Logo" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            </div>
            <CardTitle className="text-lg font-extrabold tracking-tight animated-gradient-text leading-snug">
              Luminous Skill Development Training Centre
            </CardTitle>
            <div className="text-xs font-black text-indigo-400/80 tracking-widest uppercase mt-1">
              SH TECH ZONE
            </div>
            <CardDescription className="text-slate-400 text-xs tracking-wider uppercase pt-1">
              Online Examination System
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-xs font-semibold">Email or Phone Number</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <Input
                    id="email"
                    type="text"
                    placeholder="email@example.com or 017XXXXXXXX"
                    className="pl-10 border-slate-800 bg-slate-950/60 text-white placeholder-slate-500 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 transition-all duration-200"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-300 text-xs font-semibold">Password</Label>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 border-slate-800 bg-slate-950/60 text-white placeholder-slate-500 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 transition-all duration-200"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full animated-gradient-btn text-white font-bold h-10 mt-6 cursor-pointer border-none"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                    Logging in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 border-t border-slate-850 pt-4">
            <div className="text-xs text-center text-slate-400">
              Don't have an account?{' '}
              <Link href="/register" className="text-indigo-400 hover:text-indigo-300 hover:underline font-bold transition-colors">
                Create an account
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
