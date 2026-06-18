'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldCheck, Activity } from 'lucide-react'

export default function ActivityLogsPage() {
  const supabase = createClient()

  // Fetch activity logs
  const { data: logs = [] as any[], isLoading } = useQuery({
    queryKey: ['admin-activity-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          users (full_name, email, role)
        `)
        .order('logged_at', { ascending: false })
        .limit(100) // limit to recent 100 logs

      if (error) throw error
      return data || []
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
            Security Activity Logs
          </h1>
          <p className="text-sm text-slate-400">View recent system-wide actions, profile updates, and examination event audit logs.</p>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white text-base">Recent Events</CardTitle>
          <CardDescription className="text-slate-400 text-xs">A comprehensive log of the last 100 authentication and system actions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Fetching activity audits...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-16 text-slate-500">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="text-slate-400">User</TableHead>
                    <TableHead className="text-slate-400">Action</TableHead>
                    <TableHead className="text-slate-400">Details</TableHead>
                    <TableHead className="text-slate-400 text-right">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const fallbackChar = log.users?.full_name?.charAt(0).toUpperCase() || 'U'
                    return (
                      <TableRow key={log.id} className="border-b border-slate-800/60 hover:bg-slate-900/30">
                        <TableCell className="font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">
                              {fallbackChar}
                            </div>
                            <div className="flex flex-col">
                              <span>{log.users?.full_name || 'System / Guest'}</span>
                              <span className="text-[10px] text-slate-500 font-normal">{log.users?.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={
                              log.action === 'login' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : log.action === 'logout'
                                ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                : log.action === 'exam_start'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }
                          >
                            {log.action.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300 text-xs">
                          {log.details || 'No additional details provided'}
                        </TableCell>
                        <TableCell className="text-right text-slate-400 text-xs font-mono">
                          {new Date(log.logged_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
