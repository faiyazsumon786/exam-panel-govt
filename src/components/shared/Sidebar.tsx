'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileSpreadsheet, 
  BellRing, 
  UserCircle, 
  TrendingUp, 
  Database,
  Megaphone,
  LogOut,
  Award,
  Activity,
  RefreshCw,
  ShieldCheck
} from 'lucide-react'

interface SidebarLink {
  label: string
  href: string
  icon: any
}

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()

  if (!profile) return null

  const getLinks = (): SidebarLink[] => {
    switch (profile.role) {
      case 'admin':
        return [
          { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
          { label: 'User Management', href: '/admin/users', icon: ShieldCheck },
          { label: 'Students', href: '/admin/students', icon: Users },
          { label: 'Mentors', href: '/admin/mentors', icon: GraduationCap },
          { label: 'Subjects', href: '/admin/subjects', icon: BookOpen },
          { label: 'Exams', href: '/admin/exams', icon: FileSpreadsheet },
          { label: 'Live Monitoring', href: '/admin/live-monitoring', icon: Activity },
          { label: 'Retake Manager', href: '/admin/retakes', icon: RefreshCw },
          { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
          { label: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
          { label: 'Activity Logs', href: '/admin/activity-logs', icon: Activity }
        ]
      case 'mentor':
        return [
          { label: 'Dashboard', href: '/mentor', icon: LayoutDashboard },
          { label: 'My Students', href: '/mentor/students', icon: Users },
          { label: 'Exams', href: '/mentor/exams', icon: FileSpreadsheet },
          { label: 'Question Bank', href: '/mentor/questions', icon: Database },
          { label: 'Results', href: '/mentor/results', icon: Award },
          { label: 'Retake Manager', href: '/mentor/retakes', icon: RefreshCw }
        ]
      case 'student':
        return [
          { label: 'Dashboard', href: '/student', icon: LayoutDashboard },
          { label: 'Available Exams', href: '/student/exams', icon: FileSpreadsheet },
          { label: 'My Results', href: '/student/results', icon: Award },
          { label: 'Profile', href: '/profile', icon: UserCircle }
        ]
      default:
        return []
    }
  }

  const links = getLinks()

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-slate-900/95 lg:bg-card/60 backdrop-blur-md transition-all duration-300",
      open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        <Link href={`/${profile.role}`} className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-800 shadow-sm shrink-0">
            <img src="/logo.jpg" alt="Logo" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-black text-white uppercase tracking-wider leading-tight">
              Luminous Skill Development
            </span>
            <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider leading-none mt-0.5">
              Training Centre
            </span>
            <span className="text-[8px] font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent uppercase tracking-widest leading-none mt-1">
              Luminous Tech
            </span>
          </div>
        </Link>

        {/* Mobile Close Button */}
        {onClose && (
          <button 
            onClick={onClose} 
            className="lg:hidden p-1 text-slate-400 hover:text-white rounded-md bg-slate-950/20 border border-slate-800/80 active:scale-95 transition-all cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = link.href === `/${profile.role}`
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(link.href + '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group",
                isActive 
                  ? "bg-primary text-primary-foreground font-semibold shadow-md"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-accent-foreground")} />
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border bg-card/40">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-4">
          {profile.profile_picture ? (
            <img
              src={profile.profile_picture}
              alt={profile.full_name}
              className="h-9 w-9 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <h4 className="text-xs font-semibold text-foreground truncate">{profile.full_name}</h4>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              {profile.role}
            </span>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
