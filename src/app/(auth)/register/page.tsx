'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as zod from 'zod'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { registerUser } from '@/app/actions/register'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, User, Phone, Mail, Lock, Upload, BookOpen } from 'lucide-react'
import { Footer } from '@/components/shared/Footer'

const registerSchema = zod.object({
  fullName: zod.string().min(2, 'Name must be at least 2 characters'),
  phone: zod.string().min(10, 'Phone number must be at least 10 digits'),
  email: zod.string().email('Invalid email address'),
  password: zod.string().min(6, 'Password must be at least 6 characters'),
  subjectIds: zod.array(zod.string()).min(1, 'Please select at least one subject'),
})

type RegisterFormValues = zod.infer<typeof registerSchema>

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<'student' | 'mentor'>('student')
  const [uploadingPic, setUploadingPic] = useState(false)
  const [profilePicUrl, setProfilePicUrl] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  // Fetch subjects from database
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery<any[]>({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name', { ascending: true })
      
      if (error) throw error
      return (data as any[]) || []
    }
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      password: '',
      subjectIds: [],
    },
  })

  const selectedSubjectIds = watch('subjectIds')

  const handleSubjectChange = (subjectId: string, checked: boolean) => {
    const current = [...selectedSubjectIds]
    if (checked) {
      current.push(subjectId)
    } else {
      const index = current.indexOf(subjectId)
      if (index > -1) {
        current.splice(index, 1)
      }
    }
    setValue('subjectIds', current, { shouldValidate: true })
  }

  const handlePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPic(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `raw/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath)

      setProfilePicUrl(publicUrl)
      toast.success('Profile picture uploaded!')
    } catch (err: any) {
      toast.error(`Error uploading picture: ${err.message}`)
    } finally {
      setUploadingPic(false)
    }
  }

  const onSubmit = async (values: RegisterFormValues) => {
    setLoading(true)
    try {
      const res = await registerUser({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        phone: values.phone,
        role: role,
        subjectIds: values.subjectIds,
        profilePictureUrl: profilePicUrl || undefined
      })

      if (!res.success) {
        toast.error(res.error || 'Registration failed')
        setLoading(false)
        return
      }

      // Automatically sign in the user to set session cookies for the pending page access
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })

      if (signInError) {
        console.error('Auto-login error occurred')
        toast.warning('Account created, but auto-login failed. Please sign in.')
        router.push('/login')
        return
      }

      toast.success('Registration successful! Waiting for administrator approval.')
      router.push('/pending')
    } catch (err: any) {
      toast.error('An unexpected error occurred during registration.')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 py-10 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />

      {/* Animated Floating Glow Spheres */}
      <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-indigo-600/10 blur-[100px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-cyan-600/10 blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      
      <div className="flex-1 flex items-center justify-center w-full max-w-lg relative z-10 my-8 animate-fade-in-up">
        <Card className="w-full border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl glow-card transition-all duration-300">
        <CardHeader className="space-y-2 text-center pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 border border-slate-800 mb-2 overflow-hidden shadow-md group hover:border-indigo-500/40 transition-colors duration-300">
            <img src="/logo.jpg" alt="Logo" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight animated-gradient-text leading-snug">
            Create an Account
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Luminous Skill Development Training Centre
            <span className="block text-[10px] font-bold text-indigo-400/80 tracking-widest uppercase mt-1">Luminous Tech Exam System</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="student" onValueChange={(val) => {
            setRole(val as 'student' | 'mentor')
            reset()
            setProfilePicUrl('')
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-950 border border-slate-800 p-1 mb-6">
              <TabsTrigger value="student" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                Student
              </TabsTrigger>
              <TabsTrigger value="mentor" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                Mentor
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-300">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    className="pl-10 border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus-visible:ring-indigo-500"
                    {...register('fullName')}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+8801700000000"
                    className="pl-10 border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus-visible:ring-indigo-500"
                    {...register('phone')}
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    className="pl-10 border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus-visible:ring-indigo-500"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus-visible:ring-indigo-500"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Profile Picture Upload */}
              <div className="space-y-2">
                <Label className="text-slate-300">Profile Picture (Optional)</Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label
                      htmlFor="picture"
                      className="flex h-10 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950 hover:bg-slate-900 transition-colors text-slate-400 text-xs font-semibold gap-2"
                    >
                      {uploadingPic ? (
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                      ) : (
                        <Upload className="h-4 w-4 text-slate-500" />
                      )}
                      {profilePicUrl ? 'Change Picture' : 'Upload Image'}
                    </Label>
                    <input
                      id="picture"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePicUpload}
                      disabled={uploadingPic}
                    />
                  </div>
                  {profilePicUrl && (
                    <div className="h-10 w-10 rounded-full border border-indigo-500 overflow-hidden shrink-0">
                      <img src={profilePicUrl} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Subject Selection */}
              <div className="space-y-3 pt-2">
                <Label className="text-slate-300 flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-indigo-500" />
                  {role === 'student' ? 'Select Registered Subjects' : 'Select Assigned Subjects'}
                </Label>
                
                {loadingSubjects ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading subjects list...
                  </div>
                ) : subjects.length === 0 ? (
                  <p className="text-xs text-amber-500">No subjects configured. Please contact the administrator.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-slate-800 bg-slate-950/40 p-3.5">
                    {subjects.map((sub) => (
                      <div key={sub.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`sub-${sub.id}`}
                          checked={selectedSubjectIds.includes(sub.id)}
                          onCheckedChange={(checked) => handleSubjectChange(sub.id, !!checked)}
                        />
                        <Label htmlFor={`sub-${sub.id}`} className="text-slate-300 text-sm cursor-pointer select-none">
                          {sub.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
                {errors.subjectIds && (
                  <p className="text-xs text-red-500 mt-1">{errors.subjectIds.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full animated-gradient-btn text-white font-bold h-10 mt-8 border-none cursor-pointer"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering account...
                  </>
                ) : (
                  'Register'
                )}
              </Button>
            </form>
          </Tabs>
        </CardContent>
        <CardFooter className="justify-center border-t border-slate-800/60 pt-4">
          <div className="text-xs text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-400 hover:underline font-semibold">
              Sign In
            </Link>
          </div>
        </CardFooter>
      </Card>
      </div>
      <Footer />
    </div>
  )
}
