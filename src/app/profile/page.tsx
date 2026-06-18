'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as zod from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from '@/app/actions/profile'
import { PortalLayout } from '@/components/shared/PortalLayout'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Upload, User, Phone, Mail, Award, CheckCircle, Lock } from 'lucide-react'

const profileSchema = zod.object({
  fullName: zod.string().min(2, 'Name must be at least 2 characters'),
  phone: zod.string().min(10, 'Phone number must be at least 10 digits'),
})

type ProfileFormValues = zod.infer<typeof profileSchema>

export default function ProfilePage() {
  const { profile, refetchProfile, isLoading } = useAuth()
  const [saving, setSaving] = useState(false)
  const [uploadingPic, setUploadingPic] = useState(false)
  const [profilePicUrl, setProfilePicUrl] = useState<string>('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      toast.error('Please enter a new password.')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        throw error
      }

      toast.success('Password updated successfully!')
      setPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password')
    } finally {
      setChangingPassword(false)
    }
  }

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  })

  // Prepopulate form
  useEffect(() => {
    if (profile) {
      setValue('fullName', profile.full_name)
      setValue('phone', profile.phone || '')
      setProfilePicUrl(profile.profile_picture || '')
    }
  }, [profile, setValue])

  const handlePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPic(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile?.id || Math.random()}.${fileExt}`
      const filePath = `profiles/${fileName}`

      // Upload with overwrite option
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath)

      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`

      // Save to database immediately
      const { error: dbError } = await (supabase
        .from('users') as any)
        .update({ profile_picture: cacheBustedUrl })
        .eq('id', profile?.id)

      if (dbError) {
        throw dbError
      }

      setProfilePicUrl(cacheBustedUrl)
      await refetchProfile()
      toast.success('Profile picture updated successfully!')
    } catch (err: any) {
      toast.error(`Error uploading picture: ${err.message}`)
    } finally {
      setUploadingPic(false)
    }
  }


  const onSubmit = async (values: ProfileFormValues) => {
    setSaving(true)
    try {
      const res = await updateProfile({
        fullName: values.fullName,
        phone: values.phone,
        profilePictureUrl: profilePicUrl || undefined
      })

      if (!res.success) {
        toast.error(res.error || 'Failed to update profile')
        return
      }

      toast.success('Profile updated successfully!')
      await refetchProfile()
      
      // Redirect to their dashboard
      if (profile) {
        router.push(`/${profile.role}`)
      }
    } catch (err: any) {
      toast.error('An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background" suppressHydrationWarning>
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Profile Settings</h1>
            <p className="text-sm text-slate-400">Manage your personal information and profile picture.</p>
          </div>
          {profile.profile_completed && (
            <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full text-xs font-semibold">
              <CheckCircle className="h-3.5 w-3.5" />
              Completed
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Panel: Profile Picture */}
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md md:col-span-1 flex flex-col items-center p-6 text-center">
            <Avatar className="h-28 w-28 border-2 border-indigo-500/50 mb-4 shadow-xl">
              <AvatarImage src={profilePicUrl} className="object-cover" />
              <AvatarFallback className="bg-indigo-600 text-white font-bold text-2xl">
                {profile.full_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h3 className="font-semibold text-lg text-white truncate max-w-full">{profile.full_name}</h3>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">
              {profile.role}
            </span>

            <div className="w-full mt-6">
              <Label
                htmlFor="profile-pic"
                className="flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 cursor-pointer text-xs font-semibold text-slate-300 transition-colors"
              >
                {uploadingPic ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                ) : (
                  <Upload className="h-3.5 w-3.5 text-slate-500" />
                )}
                Upload Photo
              </Label>
              <input
                id="profile-pic"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePicUpload}
                disabled={uploadingPic}
              />
            </div>
          </Card>

          {/* Right Panel: Account Details & Security Settings */}
          <div className="md:col-span-2 space-y-6">
            {/* Card 1: Personal Information */}
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">Personal Information</CardTitle>
                <CardDescription className="text-slate-400">Update your details to finalize your profile setup.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Email (Read Only) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-slate-400">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        disabled
                        className="pl-10 border-slate-800 bg-slate-950/40 text-slate-500 border-dashed"
                      />
                    </div>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-slate-300">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <Input
                        id="fullName"
                        type="text"
                        className="pl-10 border-slate-800 bg-slate-950 text-white focus-visible:ring-indigo-500"
                        {...register('fullName')}
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <Input
                        id="phone"
                        type="tel"
                        className="pl-10 border-slate-800 bg-slate-950 text-white focus-visible:ring-indigo-500"
                        {...register('phone')}
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>
                    )}
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => router.push(`/${profile.role}`)}
                      className="text-slate-400 hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 shadow-md"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving Changes...
                        </>
                      ) : (
                        'Save Profile'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Card 2: Security & Password Settings */}
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">Security & Password</CardTitle>
                <CardDescription className="text-slate-400">Change your login password securely below.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onPasswordSubmit} className="space-y-4">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword" className="text-slate-300">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="Enter at least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 border-slate-800 bg-slate-950 text-white focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-slate-300">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Re-type your new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 border-slate-800 bg-slate-950 text-white focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 shadow-md"
                      disabled={changingPassword}
                    >
                      {changingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PortalLayout>
  )
}
