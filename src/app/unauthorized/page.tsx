'use client'

import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldX, LogOut, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Footer } from '@/components/shared/Footer'

export default function UnauthorizedPage() {
  const { profile, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />

      {/* Animated Floating Glow Spheres */}
      <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-red-500/5 blur-[100px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-500/5 blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      <div className="flex-1 flex items-center justify-center w-full max-w-md my-8 relative z-10 animate-fade-in-up">
        <Card className="w-full border-slate-800/85 bg-slate-900/40 backdrop-blur-xl text-center p-4 glow-card transition-all duration-300">
          <CardHeader className="space-y-2 pb-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 mb-2">
              <ShieldX className="h-6 w-6 text-red-500" />
            </div>
            <CardTitle className="text-xl font-bold text-white">Access Denied</CardTitle>
            <CardDescription className="text-slate-400">
              {profile?.status === 'rejected' 
                ? 'Your account application has been rejected.'
                : 'You do not have permission to view this page.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile?.status === 'rejected' ? (
              <p className="text-sm text-slate-300">
                Please contact the system administrator if you believe this is an error or to appeal the decision.
              </p>
            ) : (
              <p className="text-sm text-slate-300">
                This area is restricted. Make sure you are logged in with an authorized account matching the required role.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2.5 pt-4">
            {profile?.status !== 'rejected' && profile?.role && (
              <Button
                nativeButton={false}
                render={
                  <Link href={`/${profile.role}`}>
                    <ArrowLeft className="h-4 w-4" />
                    Return to Dashboard
                  </Link>
                }
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              />
            )}
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
      <Footer />
    </div>
  )
}
