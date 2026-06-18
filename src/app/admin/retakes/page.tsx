'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { resetStudentAttempt } from '@/app/actions/student-admin'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, 
  RefreshCw, 
  User, 
  FileSpreadsheet, 
  AlertTriangle,
  Award,
  Clock,
  ShieldAlert
} from 'lucide-react'

export default function AdminRetakesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Selection state
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedExamId, setSelectedExamId] = useState('')
  const [resetAction, setResetAction] = useState<'delete'>('delete')
  const [resetting, setResetting] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')

  // 1. Fetch all subjects
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['admin-retakes-subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error
      return data || []
    }
  })

  // 2. Fetch all students
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['admin-retakes-students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'student')
        .order('full_name', { ascending: true })

      if (error) throw error
      return data || []
    }
  })

  // 3. Fetch all exams
  const { data: exams = [], isLoading: loadingExams } = useQuery({
    queryKey: ['admin-retakes-exams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exams')
        .select('id, title, total_marks, subject_id, subjects(name)')
        .order('title', { ascending: true })

      if (error) throw error
      return data || []
    }
  })

  // 4. Fetch attempt details for selected student & exam
  const { data: attempt, isLoading: loadingAttempt, refetch: refetchAttempt } = useQuery({
    queryKey: ['student-exam-attempt', selectedStudentId, selectedExamId],
    queryFn: async (): Promise<any> => {
      if (!selectedStudentId || !selectedExamId) return null
      
      const { data, error } = await supabase
        .from('exam_attempts')
        .select(`
          *,
          results (*)
        `)
        .eq('student_id', selectedStudentId)
        .eq('exam_id', selectedExamId)
        .order('attempt_number', { ascending: false })
        .maybeSingle()

      if (error) throw error
      return data || null
    },
    enabled: !!selectedStudentId && !!selectedExamId
  })

  // Filter students by search term
  const filteredStudents = students.filter((student: any) => {
    const term = studentSearch.toLowerCase().trim()
    if (!term) return true
    return (
      student.full_name?.toLowerCase().includes(term) ||
      student.email?.toLowerCase().includes(term)
    )
  })

  // Filter exams by subject
  const filteredExams = selectedSubjectId
    ? exams.filter((exam: any) => exam.subject_id === selectedSubjectId)
    : exams

  // 5. Handle Reset Attempt
  const handleResetAttempt = async () => {
    if (!selectedStudentId || !selectedExamId) return
    
    const confirmMessage = resetAction === 'delete'
      ? 'Are you sure you want to completely delete the previous attempt? This student\'s answers, results, and proctoring warnings will be permanently removed. This is required to let them retake the exam.'
      : 'Reset attempt action triggered.'
      
    if (!confirm(confirmMessage)) return

    setResetting(true)
    try {
      const res = await resetStudentAttempt(selectedStudentId, selectedExamId)
      if (res.success) {
        toast.success('Retake granted! Student can now restart the exam.')
        refetchAttempt()
        queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      } else {
        toast.error(res.error || 'Failed to grant retake')
      }
    } catch (err) {
      toast.error('An unexpected error occurred.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin-slow" />
          Retake Manager (রিটেক ম্যানেজার)
        </h1>
        <p className="text-sm text-slate-400">
          Reset student exam attempts to allow them to retake their exam from scratch.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form Panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-sm text-white font-bold">Configure Retake Settings</CardTitle>
              <CardDescription className="text-xs text-slate-400">Select student and target exam.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Subject Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">0. Select Subject (optional / বিষয় নির্বাচন)</label>
                {loadingSubjects ? (
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                    Loading subjects...
                  </div>
                ) : (
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value)
                      setSelectedExamId('') // Clear chosen exam on subject switch
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2.5 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- All Subjects --</option>
                    {subjects.map((sub: any) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Student Dropdown & Search */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">1. Select Student (ছাত্র/ছাত্রী নির্বাচন)</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="🔍 Search name or email..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg p-2 focus:ring-indigo-500 outline-none"
                  />
                  {loadingStudents ? (
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                      Loading students list...
                    </div>
                  ) : (
                    <select
                      value={selectedStudentId}
                      onChange={(e) => {
                        setSelectedStudentId(e.target.value)
                      }}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2.5 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">-- Choose Student ({filteredStudents.length} found) --</option>
                      {filteredStudents.map((student: any) => (
                        <option key={student.id} value={student.id}>
                          {student.full_name} ({student.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Exam Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">2. Select Exam (পরীক্ষা নির্বাচন)</label>
                {loadingExams ? (
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                    Loading exams list...
                  </div>
                ) : (
                  <select
                    value={selectedExamId}
                    disabled={!selectedStudentId}
                    onChange={(e) => {
                      setSelectedExamId(e.target.value)
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2.5 focus:ring-indigo-500 outline-none disabled:opacity-50"
                  >
                    <option value="">-- Choose Exam --</option>
                    {filteredExams.map((exam: any) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.title} ({exam.subjects?.name || 'No Subject'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Reset Mode Option */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">3. Retake Option (আগের রিপোর্টের কি হবে?)</label>
                <select
                  value={resetAction}
                  onChange={(e: any) => setResetAction(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2.5 focus:ring-indigo-500 outline-none"
                >
                  <option value="delete">Delete Previous Attempt Data (পুরোনো রিপোর্ট মুছে দিন ও নতুন সুযোগ দিন)</option>
                </select>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  * Note: In order to respect database relational constraints and uniqueness, the previous attempt data (including answers and score results) must be deleted to allow starting a new attempt.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleResetAttempt}
                disabled={!selectedStudentId || !selectedExamId || !attempt || resetting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md h-10 gap-2 disabled:opacity-40"
              >
                {resetting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing Retake...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Grant Exam Retake (পরীক্ষা পুনরায় দিতে দিন)
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Status / Report Details Panel */}
        <div className="lg:col-span-2">
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md h-full min-h-[300px]">
            <CardHeader>
              <CardTitle className="text-sm text-white font-bold">Attempt Status Check (আগের পরীক্ষার তথ্য)</CardTitle>
              <CardDescription className="text-xs text-slate-400">Current progress and logs of selected student.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col justify-center">
              {loadingAttempt ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  <span>Checking database records...</span>
                </div>
              ) : !selectedStudentId || !selectedExamId ? (
                <div className="text-center p-12 text-slate-500 space-y-2">
                  <User className="h-12 w-12 mx-auto text-slate-800" />
                  <p className="text-sm">Please select both Student and Exam to view details.</p>
                </div>
              ) : !attempt ? (
                <div className="text-center p-12 text-emerald-500/80 space-y-2 border border-dashed border-emerald-500/20 bg-emerald-500/5 rounded-xl">
                  <CheckCircle className="h-10 w-10 mx-auto text-emerald-500" />
                  <p className="font-bold text-sm">No Attempt Found!</p>
                  <p className="text-xs text-slate-400">This student has not attempted this exam yet, or it was already reset. They can directly start it from their student dashboard.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Box */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Attempt Number</span>
                      <span className="text-lg font-bold text-white font-mono mt-1 block">#{attempt.attempt_number}</span>
                    </div>

                    <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Session Status</span>
                      <Badge className="mt-2" variant={attempt.status === 'started' ? 'outline' : 'default'}>
                        {attempt.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Proctor Alerts</span>
                      <span className={`text-lg font-bold font-mono mt-1 block ${attempt.warnings_count > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {attempt.warnings_count} Warnings
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Obtained Marks</span>
                      <span className="text-lg font-bold text-indigo-400 font-mono mt-1 block">
                        {attempt.results?.obtained_marks !== undefined ? `${attempt.results.obtained_marks} / ${attempt.results.total_marks}` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Warning Alerts / Cheating Flagged Box */}
                  {attempt.warnings_count >= 1 && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg flex gap-3 items-start">
                      <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-red-400">Proctoring Violations Logged</p>
                        <p className="text-red-300/80">
                          Student has been flagged with {attempt.warnings_count} security alerts (e.g. Tab switching, Fullscreen exit, Context menu right-clicks).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Details Table */}
                  <div className="p-4 bg-slate-950/30 border border-slate-800 rounded-lg space-y-2 text-xs text-slate-400">
                    <h4 className="font-bold text-white text-xs">Timeline & General Info</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1.5 font-mono">
                      <div>Started At: <span className="text-slate-200">{new Date(attempt.started_at).toLocaleString()}</span></div>
                      <div>Completed At: <span className="text-slate-200">{attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : 'Not completed'}</span></div>
                      <div>Enrolled Exam Marks: <span className="text-slate-200">{attempt.results?.total_marks || 'N/A'}</span></div>
                      <div>Result Accuracy: <span className="text-indigo-400">{attempt.results?.percentage !== undefined ? `${attempt.results.percentage}%` : 'N/A'}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CheckCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  )
}
