'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Bell, User, LogOut, Settings, ShieldAlert } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function Navbar() {
  const { profile, signOut } = useAuth()
  const supabase = createClient()
  const router = useRouter()

  // Fetch unread notifications
  const { data: rawNotifications = [], refetch } = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      if (!profile) return []
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
      
      // Admin gets all cheating/registration reports
      if (profile.role !== 'admin') {
        query = query.eq('user_id', profile.id)
      }

      const { data, error } = await query.limit(5)
      if (error) throw error
      return data || []
    },
    enabled: !!profile,
    refetchInterval: 15000 // poll every 15s for new notifications
  })

  const notifications = rawNotifications as any[]

  const handleNotifClick = async (notif: any) => {
    // 1. Mark as read in Database
    const { error } = await (supabase.from('notifications') as any)
      .update({ is_read: true })
      .eq('id', notif.id)

    if (error) {
      console.error('Error marking notification as read')
    }

    // 2. Refetch notifications immediately
    refetch()

    // 3. Redirect depending on type
    if (notif.type === 'new_result') {
      router.push('/student/results')
    } else if (notif.type === 'cheating_alert') {
      if (profile?.role === 'admin') {
        router.push('/admin/live-monitoring')
      }
    } else if (notif.type === 'exam') {
      router.push('/student/exams')
    }
  }

  if (!profile) return null

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b border-border bg-background/60 backdrop-blur-md px-6 pl-72">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-foreground tracking-wide capitalize">
          {profile.role} Portal
        </h2>
        <Badge variant={profile.role === 'admin' ? 'destructive' : profile.role === 'mentor' ? 'default' : 'secondary'} className="uppercase font-semibold tracking-wider text-[10px]">
          {profile.role}
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="relative hover:bg-accent hover:text-accent-foreground rounded-full">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-80 p-2">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-semibold text-sm px-2 py-1.5 flex items-center justify-between">
                <span>Notifications</span>
                {notifications.length > 0 && (
                  <span className="text-xs font-normal text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                    {notifications.length} Unread
                  </span>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No new alerts
              </div>
            ) : (
              notifications.map((notif) => (
                <DropdownMenuItem key={notif.id} onClick={() => handleNotifClick(notif)} className="p-2.5 rounded-md hover:bg-accent flex flex-col items-start gap-1 cursor-pointer">
                  <div className="flex items-center gap-2 text-xs font-semibold w-full">
                    {notif.type === 'cheating_alert' && (
                      <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    )}
                    <span className="truncate flex-1">{notif.title}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Account Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-3 py-1.5 hover:bg-accent rounded-full border border-border">
                {profile.profile_picture ? (
                  <img
                    src={profile.profile_picture}
                    alt={profile.full_name}
                    className="h-7 w-7 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {profile.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium hidden sm:inline-block max-w-[120px] truncate">
                  {profile.full_name}
                </span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56 p-1">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-semibold px-2.5 py-2">
                <div className="flex flex-col">
                  <span className="text-sm text-foreground truncate">{profile.full_name}</span>
                  <span className="text-xs text-muted-foreground truncate">{profile.email}</span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link href="/profile" className="flex w-full items-center gap-2 px-2.5 py-2 text-sm cursor-pointer">
                  <Settings className="h-4 w-4" />
                  Profile Settings
                </Link>
              }
            />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
              <span className="flex w-full items-center gap-2 px-2.5 py-2 text-sm font-medium">
                <LogOut className="h-4 w-4" />
                Sign Out
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
