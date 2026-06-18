'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  FileSpreadsheet, 
  Loader2, 
  Clock, 
  Calendar, 
  Play,
  ArrowLeft
} from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AvailableExamsPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const router = useRouter()

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

  // 2. Fetch available exams in student subjects (optimised to fetch attempts at once to avoid N+1 queries)
  const { data: rawAvailableExams = [], isLoading: loadingExams } = useQuery({
    queryKey: ['student-available-exams-page', studentSubjects],
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

  const isLoading = loadingSubjects || loadingExams

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/student')} className="h-8 w-8 text-slate-400 hover:text-white rounded-full bg-slate-900/30 border border-slate-800">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            <span className="animated-gradient-text text-glow-indigo">Available Examinations</span>
          </h1>
          <p className="text-sm text-slate-400">Exams currently open for attempts in your registered subjects.</p>
        </div>
      </div>

      {availableExams.length === 0 ? (
        <Card className="border-slate-800/80 bg-slate-900/40 backdrop-blur-md rounded-xl p-16 text-center text-sm text-slate-500">
          No active exams available at this moment.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {availableExams.map((exam: any) => {
            const hasRemainingAttempt = exam.attemptsCount < exam.max_attempts
            const showTakeBtn = !exam.isCompleted && hasRemainingAttempt
            
            return (
              <Card key={exam.id} className="glow-card border-slate-800/80 bg-slate-900/40 backdrop-blur-md overflow-hidden rounded-xl flex flex-col justify-between">
                <CardHeader className="pb-3 border-b border-slate-800/60 relative">
                  <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  <div className="flex flex-col gap-1.5">
                    <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] w-fit font-bold uppercase tracking-wider">
                      {exam.subjects?.name}
                    </Badge>
                    <CardTitle className="text-base font-bold text-slate-100 hover:text-white transition-colors duration-150 pr-4 mt-1">
                      {exam.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <p className="text-xs text-slate-400 leading-relaxed min-h-[40px] line-clamp-3">
                    {exam.description || 'No exam prompt described.'}
                  </p>
                  
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col gap-2 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 text-[10px] text-slate-400 font-semibold">
                      <span className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        Duration: {exam.exam_duration_minutes ? `${exam.exam_duration_minutes} Minutes` : 'Per-Question Timer'}
                      </span>
                      <span className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        Closes: {new Date(exam.end_date).toLocaleString()}
                      </span>
                    </div>

                    <div className="pt-1">
                      {showTakeBtn ? (
                        <Button
                          nativeButton={false}
                          render={
                            <Link href={`/student/exam/${exam.id}`}>
                              <Play className="h-3.5 w-3.5 fill-current" />
                              Start Examination
                            </Link>
                          }
                          className="w-full animated-gradient-btn text-slate-950 font-bold text-xs h-10 gap-1.5 shadow-md shadow-indigo-600/10 rounded-lg"
                        />
                      ) : (
                        <div className="w-full flex items-center justify-center bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 text-xs font-semibold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                          {exam.isCompleted ? 'Attempt Completed' : 'Maximum Attempts Exceeded'}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
