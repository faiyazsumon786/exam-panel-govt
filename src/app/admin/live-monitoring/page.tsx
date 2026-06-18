'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  Loader2, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  UserCheck, 
  Sparkles 
} from 'lucide-react'
import { toast } from 'sonner'

export default function LiveMonitoringPage() {
  const supabase = createClient()
  const [liveAttempts, setLiveAttempts] = useState<any[]>([])

  // 1. Fetch initial active attempts
  const { isLoading } = useQuery({
    queryKey: ['initial-live-attempts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_attempts')
        .select(`
          *,
          users:student_id (full_name, email),
          exams:exam_id (title, subject:subject_id(name))
        `)
        .in('status', ['started', 'submitted', 'auto_submitted'])
        .order('started_at', { ascending: false })

      if (error) throw error
      setLiveAttempts(data || [])
      return data || []
    }
  })

  // 2. Setup Realtime Subscriptions
  useEffect(() => {
    // Channel for exam attempts
    const attemptsChannel = supabase
      .channel('live-attempts-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_attempts' },
        async (payload) => {
          // If updated, fetch full row with details
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data, error } = await (supabase
              .from('exam_attempts')
              .select(`
                *,
                users:student_id (full_name, email),
                exams:exam_id (title, subject:subject_id(name))
              `)
              .eq('id', payload.new.id)
              .single() as any)

            if (!error && data) {
              setLiveAttempts((prev: any[]) => {
                const idx = prev.findIndex((a: any) => a.id === data.id)
                if (idx > -1) {
                  // Update existing
                  const updated = [...prev]
                  updated[idx] = data
                  return updated
                } else {
                  // Insert new
                  return [data, ...prev]
                }
              })
            }
          } else if (payload.eventType === 'DELETE') {
            setLiveAttempts((prev: any[]) => prev.filter((a: any) => a.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    // Channel for cheating alerts
    const cheatingChannel = supabase
      .channel('live-cheating-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cheating_logs' },
        async (payload) => {
          const log = payload.new
          // Fetch student name
          const { data: student } = await (supabase
            .from('users')
            .select('full_name')
            .eq('id', log.student_id)
            .single() as any)

          toast.error(`SECURITY ALERT: ${student?.full_name || 'Student'} triggered violation: ${log.event_type.replace('_', ' ').toUpperCase()}`, {
            duration: 6000,
            icon: <ShieldAlert className="h-5 w-5 text-red-500" />
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(attemptsChannel)
      supabase.removeChannel(cheatingChannel)
    }
  }, [supabase])

  // Timer calculation
  const formatTime = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Active taking exam count
  const activeCount = liveAttempts.filter(a => a.status === 'started').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-500 animate-pulse" />
            Live Exam Monitoring
          </h1>
          <p className="text-sm text-slate-400">Real-time status updates of active student examinations and security parameters.</p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 flex items-center gap-1.5 font-semibold text-xs animate-pulse">
            <Sparkles className="h-3 w-3" />
            {activeCount} Active Students
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-400 uppercase">Active Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-white">{activeCount}</div>
            <p className="text-xs text-slate-500 mt-1">Students currently writing exams</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-400 uppercase">Submissions Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-400">
              {liveAttempts.filter(a => a.status === 'submitted' || a.status === 'auto_submitted').length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Completed and auto-submitted exams</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-400 uppercase">Total Flagged Cheats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-red-500">
              {liveAttempts.reduce((acc, a) => acc + (a.warnings_count || 0), 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Total warnings triggered by active users</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white text-base">Live Students Panel</CardTitle>
          <CardDescription className="text-slate-400 text-xs">Monitors tab shifts, blurring, exit-fullscreen events, and timings.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Connecting to operations stream...</span>
            </div>
          ) : liveAttempts.length === 0 ? (
            <div className="text-center p-16 text-slate-500">
              No students are currently taking exams.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="text-slate-400">Student</TableHead>
                    <TableHead className="text-slate-400">Active Exam</TableHead>
                    <TableHead className="text-slate-400 text-center">Question Progress</TableHead>
                    <TableHead className="text-slate-400 text-center">Time Remaining</TableHead>
                    <TableHead className="text-slate-400 text-center">Warnings</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveAttempts.map((attempt) => (
                    <TableRow key={attempt.id} className="border-b border-slate-800/60 hover:bg-slate-900/30">
                      <TableCell className="font-semibold text-white">
                        <div className="flex flex-col">
                          <span>{attempt.users?.full_name || 'Unknown User'}</span>
                          <span className="text-[10px] text-slate-500 font-normal">{attempt.users?.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-slate-200">{attempt.exams?.title || 'Exam'}</span>
                          <span className="text-[10px] text-indigo-400 uppercase font-semibold">{attempt.exams?.subject?.name || 'Curriculum'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-slate-300 font-mono">
                        Question #{attempt.current_question_index + 1}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 text-slate-300 font-mono text-sm">
                          <Clock className="h-3.5 w-3.5 text-indigo-400" />
                          {formatTime(attempt.time_remaining_seconds)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={
                            attempt.warnings_count > 0 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20 font-bold animate-pulse'
                              : 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/20'
                          }
                        >
                          {attempt.warnings_count} Violations
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={
                            attempt.status === 'started'
                              ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/25'
                              : attempt.status === 'submitted'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : 'bg-red-500/15 text-red-400 border border-red-500/25'
                          }
                        >
                          {attempt.status === 'started' ? 'Active' : attempt.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
