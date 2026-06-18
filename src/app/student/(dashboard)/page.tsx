'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  BookOpen, 
  FileSpreadsheet, 
  Megaphone, 
  Loader2, 
  Trophy, 
  Calendar, 
  Clock, 
  Award, 
  Play,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export default function StudentDashboardPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  // 1. Fetch student subjects
  const { data: rawStudentSubjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['student-assigned-subjects', profile?.id],
    queryFn: async () => {
      if (!profile) return []
      const { data, error } = await supabase
        .from('student_subjects')
        .select('subject_id, subjects(name)')
        .eq('student_id', profile.id)

      if (error) throw error
      return data || []
    },
    enabled: !!profile
  })
  const studentSubjects = rawStudentSubjects as any[]

  // 2. Fetch available exams in student subjects (optimised to batch attempts and avoid N+1 query lag)
  const { data: rawAvailableExams = [], isLoading: loadingExams } = useQuery({
    queryKey: ['student-available-exams', studentSubjects],
    queryFn: async () => {
      if (studentSubjects.length === 0) return []
      const subjectIds = studentSubjects.map((s: any) => s.subject_id)
      const now = new Date().toISOString()

      const { data: exams, error: examsErr } = await supabase
        .from('exams')
        .select('*, subjects(name)')
        .eq('status', 'published')
        .in('subject_id', subjectIds)
        .gte('end_date', now)

      if (examsErr) throw examsErr

      // Batch query attempts to avoid N+1 query lag
      const { data: attempts } = await supabase
        .from('exam_attempts')
        .select('exam_id, status, attempt_number')
        .eq('student_id', profile?.id)

      const attemptsMap: { [key: string]: any[] } = {}
      attempts?.forEach((a: any) => {
        if (!attemptsMap[a.exam_id]) {
          attemptsMap[a.exam_id] = []
        }
        attemptsMap[a.exam_id].push(a)
      })

      const enrichedExams = (exams || []).map((exam: any) => {
        const examAttempts = attemptsMap[exam.id] || []
        const isCompleted = examAttempts.some(a => ['submitted', 'auto_submitted'].includes(a.status))
        const currentAttemptsCount = examAttempts.length

        return {
          ...exam,
          isCompleted,
          attemptsCount: currentAttemptsCount
        }
      })

      return enrichedExams
    },
    enabled: studentSubjects.length > 0
  })
  const availableExams = rawAvailableExams as any[]

  // 3. Fetch student exam scores / history
  const { data: rawExamHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['student-scores-history', profile?.id],
    queryFn: async () => {
      if (!profile) return []
      const { data, error } = await supabase
        .from('results')
        .select(`
          *,
          exams (title, passing_marks, subjects (name))
        `)
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!profile
  })
  const examHistory = rawExamHistory as any[]

  // 4. Fetch announcements
  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery({
    queryKey: ['student-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('publish_date', { ascending: false })
        .limit(4)

      if (error) throw error
      return data || []
    }
  })

  // 5. Fetch leaderboard overall standings (top 10 students)
  const { data: leaderboard = [], isLoading: loadingLeaderboard } = useQuery({
    queryKey: ['student-dashboard-leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('results')
        .select(`
          student_id,
          obtained_marks,
          percentage,
          users:student_id (full_name)
        `)

      if (error) throw error
      if (!data) return []

      // Group by student
      const studentMap: { [key: string]: any } = {}
      data.forEach((row: any) => {
        const id = row.student_id
        if (!studentMap[id]) {
          studentMap[id] = {
            id,
            name: row.users?.full_name || 'Anonymous Student',
            totalMarks: 0,
            avgPercentage: 0,
            percentages: [] as number[],
          }
        }
        studentMap[id].totalMarks += Number(row.obtained_marks)
        studentMap[id].percentages.push(Number(row.percentage))
      })

      const list = Object.values(studentMap).map((student: any) => {
        const sum = student.percentages.reduce((acc: number, val: number) => acc + val, 0)
        return {
          ...student,
          avgPercentage: student.percentages.length > 0 ? Math.round(sum / student.percentages.length) : 0,
        }
      })

      list.sort((a, b) => b.totalMarks - a.totalMarks || b.avgPercentage - a.avgPercentage)
      return list.slice(0, 10).map((item, index) => ({ ...item, rank: index + 1 }))
    }
  })

  const isLoading = loadingSubjects || loadingExams || loadingHistory || loadingAnnouncements || loadingLeaderboard

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  const totalTaken = examHistory.length
  const passedCount = examHistory.filter((res: any) => res.is_passed).length
  const failedCount = examHistory.filter((res: any) => !res.is_passed).length
  const averagePercentage = totalTaken > 0 
    ? Math.round(examHistory.reduce((acc, curr) => acc + curr.percentage, 0) / totalTaken)
    : 0

  const chartData = [
    { name: 'Passed', value: passedCount, color: '#10b981' },
    { name: 'Failed', value: failedCount, color: '#ef4444' }
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span className="animated-gradient-text text-glow-indigo">Student Dashboard</span>
          </h1>
          <p className="text-sm text-slate-400">Welcome to your SH TECH ZONE Examination desk.</p>
        </div>
      </div>

      {/* Stats Summary Section with Recharts Donut */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glow-card border-slate-800/80 bg-slate-900/40 backdrop-blur-md md:col-span-2 flex flex-col md:flex-row items-center justify-between p-6 gap-6 rounded-xl">
          <div className="space-y-4 flex-1 w-full">
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Performance Overview</h2>
              <p className="text-xs text-slate-400">Summary of your exam attempts and outcomes.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-center hover:bg-slate-950/80 transition-colors duration-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Taken</span>
                <p className="text-xl font-bold text-white mt-1 font-mono">{totalTaken}</p>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-center hover:bg-slate-950/80 transition-colors duration-200">
                <span className="text-[10px] text-emerald-500/80 uppercase font-bold tracking-wider">Passed</span>
                <p className="text-xl font-bold text-emerald-400 mt-1 font-mono text-glow-cyan">{passedCount}</p>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-center hover:bg-slate-950/80 transition-colors duration-200">
                <span className="text-[10px] text-red-500/80 uppercase font-bold tracking-wider">Failed</span>
                <p className="text-xl font-bold text-red-400 mt-1 font-mono">{failedCount}</p>
              </div>
            </div>
          </div>
          
          <div className="relative h-[130px] w-[130px] shrink-0 flex items-center justify-center">
            {totalTaken > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={52}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: `drop-shadow(0px 0px 4px ${entry.color}40)` }} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-[10px] text-slate-500 italic">No exams taken</div>
            )}
            {totalTaken > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider">Accuracy</span>
                <span className="text-sm font-bold text-white font-mono text-glow-cyan">{Math.round((passedCount / totalTaken) * 100)}%</span>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Link Card / Summary for Available Exams */}
        <Card className="glow-card border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex flex-col justify-between p-6 rounded-xl">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 tracking-wide">
              <BookOpen className="h-4 w-4 text-indigo-400 shrink-0" />
              Available Exams
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Exams currently open for attempts. Click below to view the list and start your exam.
            </p>
            <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-lg p-2.5 mt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-300 font-medium">Pending active:</span>
              <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold font-mono px-2.5 py-0.5 shadow-[0_0_10px_rgba(99,102,241,0.15)] animate-pulse-slow">
                {availableExams.length} Exams
              </Badge>
            </div>
          </div>

          <Button
            nativeButton={false}
            render={<Link href="/student/exams">View Available Exams</Link>}
            className="w-full animated-gradient-btn text-slate-950 font-bold text-xs h-9 mt-4 shadow-md rounded-lg"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Available & History */}
        <div className="lg:col-span-2 space-y-6">

          {/* Exam Attempts & Grades History */}
          <Card className="glow-card border-slate-800/80 bg-slate-900/40 backdrop-blur-md rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-800/60">
              <CardTitle className="text-base text-white flex items-center gap-2 tracking-wide">
                <Award className="h-5 w-5 text-emerald-400 shrink-0" />
                Examination Grade History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {examHistory.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No completed exam records.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-950/30 border-b border-slate-800/80">
                    <TableRow>
                      <TableHead className="text-slate-400 font-semibold">Exam</TableHead>
                      <TableHead className="text-slate-400 text-center font-semibold">Score</TableHead>
                      <TableHead className="text-slate-400 text-center font-semibold">Percentage</TableHead>
                      <TableHead className="text-slate-400 text-center font-semibold">Outcome</TableHead>
                      <TableHead className="text-slate-400 text-right font-semibold">Certificate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {examHistory.map((res: any) => (
                      <TableRow key={res.id} className="hover:bg-slate-950/20 border-b border-slate-800/30 transition-colors duration-150">
                        <TableCell className="font-semibold text-white">
                          <div className="flex flex-col">
                            <span className="text-slate-200 hover:text-white transition-colors duration-150">{res.exams?.title}</span>
                            <span className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5">{res.exams?.subjects?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold font-mono text-slate-300">
                          {res.obtained_marks} / {res.total_marks}
                        </TableCell>
                        <TableCell className="text-center font-bold font-mono text-slate-300">{res.percentage}%</TableCell>
                        <TableCell className="text-center">
                          <Badge className={res.is_passed 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)] flex items-center gap-1.5 justify-center py-0.5 px-2' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.15)] flex items-center gap-1.5 justify-center py-0.5 px-2'
                          }>
                            <span className={`h-1.5 w-1.5 rounded-full ${res.is_passed ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                            {res.is_passed ? 'Passed' : 'Failed'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            nativeButton={false}
                            render={
                              <Link href={`/student/result/${res.id}`}>
                                View Marksheet
                              </Link>
                            }
                            size="sm"
                            variant="ghost"
                            className="text-indigo-400 hover:text-indigo-300 hover:underline text-xs h-8 px-3 transition-all duration-150 font-semibold"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Bulletins & Leaderboard */}
        <div className="lg:col-span-1 space-y-6">
          {/* Announcements */}
          <Card className="glow-card border-slate-800/80 bg-slate-900/40 backdrop-blur-md rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-800/60">
              <CardTitle className="text-sm text-white font-bold flex items-center gap-1.5 tracking-wide">
                <Megaphone className="h-4 w-4 text-indigo-400 shrink-0 animate-pulse-slow" />
                Bulletin Board
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {announcements.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No recent bulletins posted.</p>
              ) : (
                announcements.map((ann: any) => (
                  <div key={ann.id} className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-lg space-y-1 relative group hover:border-slate-700/80 transition-all duration-300">
                    <span className="absolute top-3 right-3 h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors duration-150 line-clamp-1 pr-4">{ann.title}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{ann.description}</p>
                    <span className="text-[9px] text-slate-500 font-semibold block pt-0.5">
                      {new Date(ann.publish_date).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Top 10 Leaderboard */}
          <Card className="glow-card border-slate-800/80 bg-slate-900/40 backdrop-blur-md rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-800/60">
              <CardTitle className="text-sm text-white font-bold flex items-center gap-1.5 tracking-wide">
                <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
                Top 10 Standings
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 px-0">
              {leaderboard.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No rank records computed.</p>
              ) : (
                <div className="divide-y divide-slate-800/40">
                  {leaderboard.map((student: any) => (
                    <div key={student.id} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-950/20 transition-colors duration-150">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          student.rank === 1 
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border border-yellow-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                            : student.rank === 2
                            ? 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-950 border border-slate-300 shadow-[0_0_10px_rgba(203,213,225,0.3)]'
                            : student.rank === 3
                            ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border border-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.3)]'
                            : 'text-slate-500 bg-slate-950/40 border border-slate-800'
                        }`}>
                          {student.rank}
                        </span>
                        <span className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">{student.name}</span>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-xs text-emerald-400 font-bold font-mono text-glow-cyan">{student.totalMarks} pts</span>
                        <span className="text-[9px] text-slate-500 font-mono">Avg: {student.avgPercentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
