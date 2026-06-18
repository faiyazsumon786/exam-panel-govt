'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, RefreshCw, LogOut, MessageSquare } from 'lucide-react'
import { Footer } from '@/components/shared/Footer'
import { toast } from 'sonner'
import { useState } from 'react'

export default function PendingPage() {
  const { signOut, refetchProfile, profile, isLoading } = useAuth()
  const router = useRouter()
  const [checking, setChecking] = useState(false)

  const handleCheckStatus = async () => {
    setChecking(true)
    try {
      const { data } = await refetchProfile()
      if (data) {
        if (data.status === 'approved') {
          toast.success('Your account is approved!')
          router.push(`/${data.role}`)
        } else if (data.status === 'rejected') {
          router.push('/unauthorized')
        } else {
          toast.info('Your account is still pending approval.')
        }
      }
    } catch (err) {
      toast.error('Failed to check status. Try again.')
    } finally {
      setChecking(false)
    }
  }

  // Dynamic values for Telegram and WhatsApp links
  const fullName = profile?.full_name || ''
  const phone = profile?.phone || ''
  const messageText = `Assalamu Alaikum Admin, please approve my account.\nName: ${fullName}\nPhone: ${phone}`
  const encodedText = encodeURIComponent(messageText)

  // WhatsApp has auto pre-filled message, Telegram is a direct link
  const telegramUrl = `https://t.me/MR_Expart_SH`
  const whatsappUrl = `https://wa.me/8801609450034?text=${encodedText}`

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />

      {/* Animated Floating Glow Spheres */}
      <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-[100px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-500/5 blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md relative z-10 my-8 animate-fade-in-up">
        <Card className="w-full border-slate-800/85 bg-slate-900/40 backdrop-blur-xl shadow-2xl glow-card text-center p-4 transition-all duration-300">
          <CardHeader className="space-y-2 pb-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 mb-2">
              <Clock className="h-6 w-6 text-amber-500 animate-pulse" />
            </div>
            <CardTitle className="text-xl font-extrabold text-white tracking-tight leading-snug">Approval Pending</CardTitle>
            <CardDescription className="text-slate-400 text-xs tracking-wider uppercase font-semibold">
              Thank you for registering at Luminous Tech
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <p className="text-sm text-slate-300">
            Your account is currently under review. An administrator will review and activate your account shortly.
          </p>
          <p className="text-xs text-slate-500">
            Once approved, you will have access to subjects and exam schedules.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2.5 pt-4">
          <Button
            onClick={handleCheckStatus}
            className="w-full animated-gradient-btn text-white gap-2 border-none cursor-pointer"
            disabled={checking}
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            Check Approval Status
          </Button>
          <Button
            variant="outline"
            onClick={signOut}
            className="w-full border-slate-800 bg-transparent text-slate-400 hover:bg-slate-800/40 gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardFooter>
      </Card>
      </div>

      {/* Footer Section */}
      <footer className="mt-8 text-center space-y-4 max-w-md w-full px-4">
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/20 backdrop-blur-sm p-4 text-left space-y-4">
          <div className="flex items-center gap-2 text-indigo-400">
            <MessageSquare className="h-4 w-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Quick Approval (দ্রুত এপ্রুভাল)
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            আপনার অ্যাকাউন্টটি দ্রুত এপ্রুভ করতে নিচে দেয়া যেকোনো একটি মাধ্যমে এডমিনের সাথে যোগাযোগ করুন। WhatsApp-এ ক্লিক করলে আপনার নাম ও মোবাইল নম্বর স্বয়ংক্রিয়ভাবে মেসেজে যুক্ত হয়ে যাবে।
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 active:bg-sky-600/40 text-sky-400 border border-sky-500/20 py-2.5 px-4 text-xs font-semibold transition-all duration-200"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15.68-.79 3.42-1.12 4.79-.14.58-.35.78-.56.8-.46.04-.81-.31-1.26-.6-0.7-.46-1.09-.75-1.77-1.2-0.79-.52-.28-.81.17-1.28.12-.12 2.18-2 2.22-2.17.01-.02.01-.1-.05-.15s-.14-.03-.21-.01c-.09.02-1.61 1.02-4.54 3a1.9 1.9 0 0 1-1.11.41c-.41-.01-1.21-.23-1.8-.42-.72-.23-1.3-.36-1.25-.76.03-.21.31-.42.85-.64 3.31-1.44 5.51-2.4 6.61-2.88 3.14-1.38 3.8-1.62 4.22-1.63.1 0 .31.02.45.14.12.1.15.24.17.34.02.09.02.26 0 .38z"/>
              </svg>
              Telegram
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 active:bg-emerald-600/40 text-emerald-400 border border-emerald-500/20 py-2.5 px-4 text-xs font-semibold transition-all duration-200"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12a9.9 9.9 0 0 0 1.32 4.96L2 22l5.14-1.35c1.47.8 3.12 1.35 4.86 1.35 5.52 0 10-4.48 10-10S17.52 2 12 2zm4.83 12.02c-.25-.13-1.44-.71-1.67-.79-.22-.08-.39-.13-.55.13-.16.26-.63.79-.77.95-.15.16-.3.18-.54.06-1-.48-1.67-.93-2.35-2.09-.15-.26-.01-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.24.24-.4.08-.17.04-.32-.02-.44-.06-.13-.55-1.33-.75-1.82-.2-.48-.4-.42-.55-.42h-.47a.9.9 0 0 0-.65.3c-.22.25-.85.84-.85 2.04 0 1.2.87 2.37 1 2.53.12.16 1.72 2.63 4.17 3.69.58.25 1.04.4 1.39.51.59.19 1.12.16 1.54.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.29z" clipRule="evenodd" />
              </svg>
              WhatsApp
            </a>
          </div>
        </div>

        <Footer />
      </footer>
    </div>
  )
}

