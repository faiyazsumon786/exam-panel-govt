'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { 
  updateExam, 
  publishExam, 
  addExamQuestionDirectly, 
  linkQuestionFromBank, 
  autoGenerateExamQuestions,
  reopenExam
} from '@/app/actions/exams-mentor'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { 
  Loader2, 
  Settings, 
  Plus, 
  Database, 
  Sparkles, 
  Upload, 
  Trash2, 
  ArrowLeft,
  CheckCircle,
  HelpCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Calendar
} from 'lucide-react'


export default function ExamDetailBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Form states
  const [publishing, setPublishing] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [isDirectOpen, setIsDirectOpen] = useState(false)
  const [isReopenOpen, setIsReopenOpen] = useState(false)
  const [reopenStartDate, setReopenStartDate] = useState('')
  const [reopenEndDate, setReopenEndDate] = useState('')
  const [reopening, setReopening] = useState(false)
  const [isLinkOpen, setIsLinkOpen] = useState(false)
  const [isAutoOpen, setIsAutoOpen] = useState(false)

  // Direct Question Form Fields
  const [qTitle, setQTitle] = useState('')
  const [optA, setOptA] = useState('')
  const [optB, setOptB] = useState('')
  const [optC, setOptC] = useState('')
  const [optD, setOptD] = useState('')
  const [correctAns, setCorrectAns] = useState<'A' | 'B' | 'C' | 'D'>('A')
  const [qMarks, setQMarks] = useState(1)
  const [qTimeLimit, setQTimeLimit] = useState(30)
  const [addingQ, setAddingQ] = useState(false)

  // Auto Generate Form Fields
  const [easyCount, setEasyCount] = useState(5)
  const [mediumCount, setMediumCount] = useState(5)
  const [hardCount, setHardCount] = useState(2)
  const [autoMarks, setAutoMarks] = useState(1)
  const [autoTime, setAutoTime] = useState(30)
  const [generating, setGenerating] = useState(false)

  // Fetch Exam details
  const { data: rawExam, isLoading: loadingExam } = useQuery({
    queryKey: ['exam-builder-details', examId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exams')
        .select('*, subjects(name)')
        .eq('id', examId)
        .single()

      if (error) throw error
      return data
    }
  })
  const exam = rawExam as any

  // Fetch Exam Questions
  const { data: rawExamQuestions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['exam-builder-questions', examId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    }
  })
  const examQuestions = rawExamQuestions as any[]

  // Fetch Subject Question Bank Questions (For linking)
  const { data: rawBankQuestions = [] } = useQuery({
    queryKey: ['subject-bank-questions', exam?.subject_id],
    queryFn: async () => {
      if (!exam?.subject_id) return []
      const { data, error } = await supabase
        .from('question_bank')
        .select('*')
        .eq('subject_id', exam.subject_id)
      
      if (error) throw error
      return data || []
    },
    enabled: !!exam?.subject_id
  })
  const bankQuestions = rawBankQuestions as any[]

  // Handle Update Settings
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!exam) return

    setSavingSettings(true)
    try {
      const res = await updateExam(exam.id, {
        title: exam.title,
        description: exam.description || undefined,
        startDate: exam.start_date,
        endDate: exam.end_date,
        passingMarks: Number(exam.passing_marks),
        allowBacktracking: exam.allow_backtracking,
        randomizeQuestions: exam.randomize_questions,
        randomizeOptions: exam.randomize_options,
        maxAttempts: Number(exam.max_attempts),
        allowRetake: exam.allow_retake,
        warningLimit: Number(exam.warning_limit),
        autoSubmitAfterLimit: exam.auto_submit_after_limit,
        examDurationMinutes: exam.exam_duration_minutes || undefined,
        showResultAfterSubmit: exam.show_result_after_submit,
        showCorrectAnswers: exam.show_correct_answers,
        negativeMarking: exam.negative_marking,
        negativeMarkValue: Number(exam.negative_mark_value)
      })

      if (res.success) {
        toast.success('Exam settings updated!')
        queryClient.invalidateQueries({ queryKey: ['exam-builder-details', examId] })
      } else {
        toast.error(res.error || 'Failed to update settings')
      }
    } catch (err) {
      toast.error('Connection error')
    } finally {
      setSavingSettings(false)
    }
  }

  // Handle Publish Exam
  const handlePublish = async () => {
    if (!exam) return
    setPublishing(true)
    try {
      const res = await publishExam(exam.id)
      if (res.success) {
        toast.success('Exam published successfully!')
        queryClient.invalidateQueries({ queryKey: ['exam-builder-details', examId] })
      } else {
        toast.error(res.error || 'Failed to publish. Ensure there are questions added.')
      }
    } catch (err) {
      toast.error('Publishing error')
    } finally {
      setPublishing(false)
    }
  }

  // Add question directly to Exam
  const handleAddDirect = async () => {
    if (!qTitle.trim() || !optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) {
      toast.error('All question and options fields are required.')
      return
    }

    setAddingQ(true)
    try {
      const res = await addExamQuestionDirectly(examId, {
        questionTitle: qTitle,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        correctAnswer: correctAns,
        marks: Number(qMarks),
        timeLimit: Number(qTimeLimit)
      })

      if (res.success) {
        toast.success('Question added to exam!')
        setIsDirectOpen(false)
        setQTitle('')
        setOptA('')
        setOptB('')
        setOptC('')
        setOptD('')
        setCorrectAns('A')
        queryClient.invalidateQueries({ queryKey: ['exam-builder-questions', examId] })
        queryClient.invalidateQueries({ queryKey: ['exam-builder-details', examId] })
      } else {
        toast.error(res.error || 'Failed to add question')
      }
    } catch (err) {
      toast.error('Connection error')
    } finally {
      setAddingQ(false)
    }
  }

  // Link question from Question Bank
  const handleLinkQuestion = async (bankQId: string) => {
    const marks = Number(prompt('Enter marks for this question:', '1'))
    const timer = Number(prompt('Enter time limit (seconds) for this question:', '30'))

    if (isNaN(marks) || isNaN(timer) || marks <= 0 || timer <= 0) {
      toast.error('Invalid marks or time limit input.')
      return
    }

    try {
      const res = await linkQuestionFromBank(examId, bankQId, marks, timer)
      if (res.success) {
        toast.success('Question linked successfully!')
        queryClient.invalidateQueries({ queryKey: ['exam-builder-questions', examId] })
        queryClient.invalidateQueries({ queryKey: ['exam-builder-details', examId] })
      } else {
        toast.error(res.error || 'Failed to link question')
      }
    } catch (err) {
      toast.error('Linking error')
    }
  }

  // Auto Generate questions
  const handleAutoGenerate = async () => {
    if (!exam) return
    setGenerating(true)
    try {
      const res = await autoGenerateExamQuestions(examId, exam.subject_id, {
        easyCount: Number(easyCount),
        mediumCount: Number(mediumCount),
        hardCount: Number(hardCount),
        marksPerQuestion: Number(autoMarks),
        timeLimitPerQuestion: Number(autoTime)
      })

      if (res.success) {
        toast.success(`Successfully auto-generated ${res.count} questions!`)
        setIsAutoOpen(false)
        queryClient.invalidateQueries({ queryKey: ['exam-builder-questions', examId] })
        queryClient.invalidateQueries({ queryKey: ['exam-builder-details', examId] })
      } else {
        toast.error(res.error || 'Failed to generate')
      }
    } catch (err: any) {
      toast.error(err.message || 'Generation error')
    } finally {
      setGenerating(false)
    }
  }

  // Delete Exam question copy
  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to remove this question from the exam?')) return
    try {
      const { error } = await supabase.from('questions').delete().eq('id', qId)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Question removed!')
        queryClient.invalidateQueries({ queryKey: ['exam-builder-questions', examId] })
        queryClient.invalidateQueries({ queryKey: ['exam-builder-details', examId] })
      }
    } catch (err) {
      toast.error('Deletion error')
    }
  }

  // Open Re-open/Extend modal with formatted defaults
  const handleOpenReopen = () => {
    if (!exam) return
    const now = new Date()
    const currentStart = new Date(exam.start_date)
    
    // Format helper to YYYY-MM-DDTHH:MM local time
    const formatToLocalISO = (date: Date) => {
      const offset = date.getTimezoneOffset()
      const localDate = new Date(date.getTime() - offset * 60 * 1000)
      return localDate.toISOString().substring(0, 16)
    }

    if (currentStart < now) {
      setReopenStartDate(formatToLocalISO(now))
    } else {
      setReopenStartDate(exam.start_date.substring(0, 16))
    }

    const currentEnd = new Date(exam.end_date)
    if (currentEnd < now) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      setReopenEndDate(formatToLocalISO(tomorrow))
    } else {
      setReopenEndDate(exam.end_date.substring(0, 16))
    }

    setIsReopenOpen(true)
  }

  // Submit Re-open/Extend updates
  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reopenStartDate || !reopenEndDate) {
      toast.error('Both start date and end date are required.')
      return
    }

    const start = new Date(reopenStartDate)
    const end = new Date(reopenEndDate)

    if (end <= start) {
      toast.error('End date must be after the start date.')
      return
    }

    setReopening(true)
    try {
      const res = await reopenExam(examId, start.toISOString(), end.toISOString())
      if (res.success) {
        toast.success('Exam re-opened & extended successfully!')
        setIsReopenOpen(false)
        queryClient.invalidateQueries({ queryKey: ['exam-builder-details', examId] })
      } else {
        toast.error(res.error || 'Failed to re-open exam.')
      }
    } catch (err) {
      toast.error('Connection error.')
    } finally {
      setReopening(false)
    }
  }


  if (loadingExam) {
    return (
      <div className="flex h-full w-full items-center justify-center p-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!exam) return <div className="text-white text-center p-10">Exam not found.</div>

  const isPublished = exam.status !== 'draft'
  const isCompleted = exam.status === 'completed'
  const isExpired = exam.status === 'published' && new Date(exam.end_date) < new Date()
  const isExpiredOrCompleted = isExpired || exam.status === 'completed'

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/mentor/exams')} className="h-8 w-8 text-slate-400 hover:text-white rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">{exam.title}</h1>
              <Badge variant="outline" className="border-indigo-500/20 bg-indigo-500/5 text-indigo-400 text-[10px]">
                {exam.subjects?.name}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Manage details, modify parameters, and configure questions.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge className={isPublished ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}>
            {exam.status.toUpperCase()}
          </Badge>
          {!isPublished && (
            <Button onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-md" disabled={publishing}>
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Publish Exam
            </Button>
          )}
        </div>
      </div>

      {isExpiredOrCompleted && (
        <Card className="border-amber-500/20 bg-amber-500/5 text-amber-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {exam.status === 'completed' ? 'This exam is completed' : 'This exam has expired / closed'}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {exam.status === 'completed' 
                  ? 'This exam has been marked as completed.' 
                  : `The closing date (${new Date(exam.end_date).toLocaleString()}) has passed.`} Students can no longer access or start this exam.
              </p>
            </div>
          </div>
          <Button onClick={handleOpenReopen} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-1.5 px-4 h-9 gap-1.5 shadow-md self-start sm:self-auto shrink-0">
            <Calendar className="h-4 w-4" />
            Re-open / Extend Exam
          </Button>
        </Card>
      )}


      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="bg-slate-950 border border-slate-800 p-1 mb-6">
          <TabsTrigger value="questions" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            Manage Questions ({examQuestions.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            Exam Settings
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: QUESTIONS LIST & BUILDER */}
        <TabsContent value="questions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Box: Actions Panel */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-sm text-white font-bold">Exam Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5 text-xs text-slate-400">
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span>Total Questions:</span>
                    <span className="text-white font-bold">{examQuestions.length}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span>Total Marks:</span>
                    <span className="text-white font-bold">{exam.total_marks} Marks</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span>Passing Marks:</span>
                    <span className="text-white font-bold">{exam.passing_marks} Marks</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span>Duration:</span>
                    <span className="text-white font-bold">
                      {exam.exam_duration_minutes ? `${exam.exam_duration_minutes} Minutes` : 'Per-Question'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {!isCompleted && (
                <Card className="border-slate-800 bg-slate-900/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-slate-400 uppercase font-bold">Add Questions</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <Button variant="outline" onClick={() => setIsDirectOpen(true)} className="w-full border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-300 text-xs justify-start gap-2">
                      <Plus className="h-3.5 w-3.5 text-indigo-400" />
                      Create MCQ Question
                    </Button>
                    <Button variant="outline" onClick={() => setIsLinkOpen(true)} className="w-full border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-300 text-xs justify-start gap-2">
                      <Database className="h-3.5 w-3.5 text-cyan-400" />
                      Link from Subject Bank
                    </Button>
                    <Button variant="outline" onClick={() => setIsAutoOpen(true)} className="w-full border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-300 text-xs justify-start gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                      Auto-Generate Questions
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Box: Question Grid Table */}
            <div className="lg:col-span-3">
              <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
                <CardContent className="p-0">
                  {loadingQuestions ? (
                    <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                      <span>Loading exam questions...</span>
                    </div>
                  ) : examQuestions.length === 0 ? (
                    <div className="text-center p-16 text-slate-500 space-y-2">
                      <HelpCircle className="h-10 w-10 mx-auto text-slate-700" />
                      <p>No questions added to this exam yet.</p>
                      <p className="text-xs text-slate-600">Use the left panel to populate questions before publishing.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-slate-950/40">
                        <TableRow>
                          <TableHead className="text-slate-400 w-10">#</TableHead>
                          <TableHead className="text-slate-400">Question Title</TableHead>
                          <TableHead className="text-slate-400">Option Choices</TableHead>
                          <TableHead className="text-slate-400 text-center w-24">Correct Answer</TableHead>
                          <TableHead className="text-slate-400 text-center w-20">Marks</TableHead>
                          <TableHead className="text-slate-400 text-center w-24">Timer (sec)</TableHead>
                          <TableHead className="text-slate-400 text-right w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {examQuestions.map((q, idx) => (
                          <TableRow key={q.id} className="border-b border-slate-800/60 hover:bg-slate-900/20">
                            <TableCell className="text-slate-500 font-mono text-xs text-center">{idx + 1}</TableCell>
                            <TableCell className="font-semibold text-white max-w-[200px] truncate">{q.question_title}</TableCell>
                            <TableCell className="text-[11px] text-slate-400 max-w-[220px] truncate">
                              A: {q.option_a} | B: {q.option_b} | C: {q.option_c} | D: {q.option_d}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                                {q.correct_answer}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-slate-300 font-bold font-mono">{q.marks}</TableCell>
                            <TableCell className="text-center text-slate-300 font-mono flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3 text-indigo-400" />
                              {q.time_limit}s
                            </TableCell>
                            <TableCell className="text-right">
                              {!isCompleted && (
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(q.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: EXAM SETTINGS */}
        <TabsContent value="settings">
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md max-w-4xl">
            <CardHeader>
              <CardTitle className="text-white">Configure Exam Parameters</CardTitle>
              <CardDescription className="text-slate-400 text-xs">Settings dictate proctored restrictions, randomization, and marking rules.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left settings */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Exam Title</Label>
                      <Input
                        value={exam.title}
                        disabled={isCompleted}
                        onChange={(e) => {
                          queryClient.setQueryData(['exam-builder-details', examId], { ...exam, title: e.target.value })
                        }}
                        className="bg-slate-950 border-slate-800 text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Input
                        value={exam.description || ''}
                        disabled={isCompleted}
                        onChange={(e) => {
                          queryClient.setQueryData(['exam-builder-details', examId], { ...exam, description: e.target.value })
                        }}
                        className="bg-slate-950 border-slate-800 text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label>Start Date</Label>
                        <Input
                          type="datetime-local"
                          value={exam.start_date ? exam.start_date.substring(0, 16) : ''}
                          disabled={isCompleted}
                          onChange={(e) => {
                            queryClient.setQueryData(['exam-builder-details', examId], { ...exam, start_date: e.target.value })
                          }}
                          className="bg-slate-950 border-slate-800 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>End Date</Label>
                        <Input
                          type="datetime-local"
                          value={exam.end_date ? exam.end_date.substring(0, 16) : ''}
                          disabled={isCompleted}
                          onChange={(e) => {
                            queryClient.setQueryData(['exam-builder-details', examId], { ...exam, end_date: e.target.value })
                          }}
                          className="bg-slate-950 border-slate-800 text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label>Passing Marks</Label>
                        <Input
                          type="number"
                          value={exam.passing_marks}
                          disabled={isCompleted}
                          onChange={(e) => {
                            queryClient.setQueryData(['exam-builder-details', examId], { ...exam, passing_marks: Number(e.target.value) })
                          }}
                          className="bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Exam Duration (Mins)</Label>
                        <Input
                          type="number"
                          value={exam.exam_duration_minutes || ''}
                          disabled={isCompleted}
                          placeholder="Per-Question timers"
                          onChange={(e) => {
                            queryClient.setQueryData(['exam-builder-details', examId], { ...exam, exam_duration_minutes: e.target.value ? Number(e.target.value) : null })
                          }}
                          className="bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right settings (toggles) */}
                  <div className="space-y-4 border-l border-slate-800 pl-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      Security Controls
                    </h4>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Allow Backtracking</Label>
                        <p className="text-[10px] text-slate-500">পূর্ববর্তী প্রশ্নে ফিরে যাওয়ার অনুমতি (স্টুডেন্টরা উত্তর করার পর চাইলে আগের প্রশ্নে ফিরে গিয়ে সংশোধন করতে পারবে)</p>
                      </div>
                      <Switch 
                        checked={exam.allow_backtracking} 
                        disabled={isCompleted}
                        onCheckedChange={(checked) => {
                          queryClient.setQueryData(['exam-builder-details', examId], { ...exam, allow_backtracking: checked })
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Randomize Questions</Label>
                        <p className="text-[10px] text-slate-500">প্রশ্ন ওলট-পালট করা (প্রতিটি স্টুডেন্টের জন্য প্রশ্নের ক্রম এলোমেলো বা ওলট-পালট থাকবে, যাতে কেউ নকল করতে না পারে)</p>
                      </div>
                      <Switch 
                        checked={exam.randomize_questions} 
                        disabled={isCompleted}
                        onCheckedChange={(checked) => {
                          queryClient.setQueryData(['exam-builder-details', examId], { ...exam, randomize_questions: checked })
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Randomize Options</Label>
                        <p className="text-[10px] text-slate-500">অপশন ওলট-পালট করা (MCQ প্রশ্নের অপশনগুলো (A, B, C, D) একেকজন স্টুডেন্টের জন্য এলোমেলো বা ভিন্ন ক্রমে দেখাবে)</p>
                      </div>
                      <Switch 
                        checked={exam.randomize_options} 
                        disabled={isCompleted}
                        onCheckedChange={(checked) => {
                          queryClient.setQueryData(['exam-builder-details', examId], { ...exam, randomize_options: checked })
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Negative Marking</Label>
                        <p className="text-[10px] text-slate-500">ভুল উত্তরের জন্য নেগেটিভ মার্কিং (ভুল উত্তর দিলে নির্দিষ্ট পরিমাণ মার্ক কাটা যাবে)</p>
                      </div>
                      <Switch 
                        checked={exam.negative_marking} 
                        disabled={isCompleted}
                        onCheckedChange={(checked) => {
                          queryClient.setQueryData(['exam-builder-details', examId], { ...exam, negative_marking: checked })
                        }}
                      />
                    </div>

                    {exam.negative_marking && (
                      <div className="space-y-1 pl-2">
                        <Label className="text-xs text-slate-400">Negative Penalty Value</Label>
                        <Input
                          type="number"
                          step="0.05"
                          value={exam.negative_mark_value}
                          disabled={isCompleted}
                          onChange={(e) => {
                            queryClient.setQueryData(['exam-builder-details', examId], { ...exam, negative_mark_value: Number(e.target.value) })
                          }}
                          className="bg-slate-950 border-slate-800 text-white h-8 text-xs"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Allow Retakes</Label>
                        <p className="text-[10px] text-slate-500">পুনরায় পরীক্ষা দেওয়ার অনুমতি (স্টুডেন্টরা চাইলে একই পরীক্ষা একাধিকবার দিতে পারবে)</p>
                      </div>
                      <Switch 
                        checked={exam.allow_retake} 
                        disabled={isCompleted}
                        onCheckedChange={(checked) => {
                          queryClient.setQueryData(['exam-builder-details', examId], { ...exam, allow_retake: checked })
                        }}
                      />
                    </div>                    {exam.allow_retake && (
                      <div className="space-y-1 pl-2">
                        <Label className="text-xs text-slate-400">Max Attempts</Label>
                        <Input
                          type="number"
                          value={exam.max_attempts}
                          disabled={isCompleted}
                          onChange={(e) => {
                            queryClient.setQueryData(['exam-builder-details', examId], { ...exam, max_attempts: Number(e.target.value) })
                          }}
                          className="bg-slate-950 border-slate-800 text-white h-8 text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {!isCompleted && (
                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 shadow-md" disabled={savingSettings}>
                      {savingSettings ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving Settings...
                        </>
                      ) : (
                        'Save Configuration'
                      )}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal 1: Create MCQ Question Dialog */}
      <Dialog open={isDirectOpen} onOpenChange={setIsDirectOpen}>
        <DialogContent className="max-w-xl border-slate-800 bg-slate-900 text-white">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Direct MCQ Input</h3>
              <p className="text-xs text-slate-400">Enter MCQ fields directly into this examination copy.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-1">
                <Label>Question Title</Label>
                <Input value={qTitle} onChange={(e) => setQTitle(e.target.value)} className="bg-slate-950 border-slate-800 text-white" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Option A</Label>
                  <Input value={optA} onChange={(e) => setOptA(e.target.value)} className="bg-slate-950 border-slate-800 text-white" />
                </div>
                <div className="space-y-1">
                  <Label>Option B</Label>
                  <Input value={optB} onChange={(e) => setOptB(e.target.value)} className="bg-slate-950 border-slate-800 text-white" />
                </div>
                <div className="space-y-1">
                  <Label>Option C</Label>
                  <Input value={optC} onChange={(e) => setOptC(e.target.value)} className="bg-slate-950 border-slate-800 text-white" />
                </div>
                <div className="space-y-1">
                  <Label>Option D</Label>
                  <Input value={optD} onChange={(e) => setOptD(e.target.value)} className="bg-slate-950 border-slate-800 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label>Correct Answer</Label>
                  <select
                    value={correctAns}
                    onChange={(e: any) => setCorrectAns(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg p-2 focus:ring-indigo-500"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div className="space-y-1 col-span-1">
                  <Label>Question Marks</Label>
                  <Input type="number" value={qMarks} onChange={(e) => setQMarks(Number(e.target.value))} className="bg-slate-950 border-slate-800 text-white" />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label>Timer (Secs)</Label>
                  <Input type="number" value={qTimeLimit} onChange={(e) => setQTimeLimit(Number(e.target.value))} className="bg-slate-950 border-slate-800 text-white" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsDirectOpen(false)} className="border-slate-800 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleAddDirect} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5" disabled={addingQ}>
                {addingQ ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Question'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Link from Subject Question Bank */}
      <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
        <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 text-white">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Link Questions from Bank</h3>
              <p className="text-xs text-slate-400">Select questions from the reusable Question Bank of {exam.subjects?.name}.</p>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-lg">
              {bankQuestions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No questions found in this subjects bank.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-950/40">
                    <TableRow>
                      <TableHead className="text-slate-400">Question Title</TableHead>
                      <TableHead className="text-slate-400 text-center w-24">Difficulty</TableHead>
                      <TableHead className="text-slate-400 text-right w-20">Link Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bankQuestions.map((q) => {
                      const alreadyLinked = examQuestions.some((eq: any) => eq.question_bank_id === q.id)
                      return (
                        <TableRow key={q.id} className="hover:bg-slate-900/30">
                          <TableCell className="font-medium text-xs text-slate-200">{q.question_title}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="text-[10px] uppercase font-semibold">{q.difficulty}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              variant={alreadyLinked ? 'ghost' : 'default'} 
                              disabled={alreadyLinked} 
                              onClick={() => handleLinkQuestion(q.id)}
                              className={alreadyLinked ? 'text-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] h-7 px-2.5'}
                            >
                              {alreadyLinked ? 'Linked' : 'Link Q'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setIsLinkOpen(false)} className="border-slate-800 text-slate-300">
                Done Linking
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Auto-Generate Questions Dialog */}
      <Dialog open={isAutoOpen} onOpenChange={setIsAutoOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Auto-Generate Exam Questions</h3>
              <p className="text-xs text-slate-400">Pulls random questions matching difficulty criteria from this subject's question bank.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Easy Questions</Label>
                <Input type="number" value={easyCount} onChange={(e) => setEasyCount(Number(e.target.value))} className="bg-slate-950 border-slate-800 text-white" />
              </div>
              <div className="space-y-1">
                <Label>Medium Questions</Label>
                <Input type="number" value={mediumCount} onChange={(e) => setMediumCount(Number(e.target.value))} className="bg-slate-950 border-slate-800 text-white" />
              </div>
              <div className="space-y-1">
                <Label>Hard Questions</Label>
                <Input type="number" value={hardCount} onChange={(e) => setHardCount(Number(e.target.value))} className="bg-slate-950 border-slate-800 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label>Marks Per Question</Label>
                <Input type="number" value={autoMarks} onChange={(e) => setAutoMarks(Number(e.target.value))} className="bg-slate-950 border-slate-800 text-white" />
              </div>
              <div className="space-y-1">
                <Label>Time Limit (Secs)</Label>
                <Input type="number" value={autoTime} onChange={(e) => setAutoTime(Number(e.target.value))} className="bg-slate-950 border-slate-800 text-white" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsAutoOpen(false)} className="border-slate-800 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleAutoGenerate} className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Questions'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 4: Re-open / Extend Exam Dialog */}
      <Dialog open={isReopenOpen} onOpenChange={setIsReopenOpen}>
        <DialogContent className="max-w-md border-slate-800 bg-slate-900 text-white">
          <form onSubmit={handleReopenSubmit} className="flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Re-open / Extend Exam</h3>
              <p className="text-xs text-slate-400">
                Update the examination dates to make it visible and available to students again.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="reopen-start-date">New Start Time</Label>
                <Input
                  id="reopen-start-date"
                  type="datetime-local"
                  value={reopenStartDate}
                  onChange={(e) => setReopenStartDate(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reopen-end-date">New End Time</Label>
                <Input
                  id="reopen-end-date"
                  type="datetime-local"
                  value={reopenEndDate}
                  onChange={(e) => setReopenEndDate(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
              <Button type="button" variant="outline" onClick={() => setIsReopenOpen(false)} className="border-slate-800 text-slate-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5" disabled={reopening}>
                {reopening ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Re-open'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
