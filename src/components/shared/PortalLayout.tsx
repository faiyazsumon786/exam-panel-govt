'use client'

import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading } = useAuth()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background" suppressHydrationWarning>
        <div className="flex flex-col items-center gap-4" suppressHydrationWarning>
          <div className="relative flex h-12 w-12 items-center justify-center" suppressHydrationWarning>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" suppressHydrationWarning></div>
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading Luminous Tech...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) return null

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Mobile Sidebar backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex flex-col min-h-screen">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 pl-4 lg:pl-72 pr-4 lg:pr-6 py-6 bg-slate-950/20 transition-all duration-200">
          {children}
        </main>
        <Footer className="pl-4 lg:pl-72" />
      </div>
    </div>
  )
}
