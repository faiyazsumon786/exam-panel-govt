'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { 
  createExam, 
  deleteExam, 
  bulkAddQuestionsToExamAndBank, 
  bulkLinkQuestionsFromBank 
} from '@/app/actions/exams-mentor'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { BookOpen, Plus, Trash2, Loader2, Calendar, Clock, Edit } from 'lucide-react'

export default function AdminExamsPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()

  // Modal / Creation States
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form Fields
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [passingMarks, setPassingMarks] = useState(40)
  
  // Settings Panel fields
  const [allowBacktracking, setAllowBacktracking] = useState(false)
  const [randomizeQuestions, setRandomizeQuestions] = useState(false)
  const [randomizeOptions, setRandomizeOptions] = useState(false)
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [allowRetake, setAllowRetake] = useState(false)
  const [warningLimit, setWarningLimit] = useState(3)
  const [autoSubmitAfterLimit, setAutoSubmitAfterLimit] = useState(true)
  const [examDurationMinutes, setExamDurationMinutes] = useState('')
  const [showResultAfterSubmit, setShowResultAfterSubmit] = useState(true)
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true)
  const [negativeMarking, setNegativeMarking] = useState(false)
  const [negativeMarkValue, setNegativeMarkValue] = useState(0.25)

  // Bulk upload states inside exam creation modal
  const [pastedQuestionsText, setPastedQuestionsText] = useState('')
  const [bulkQuestionMarks, setBulkQuestionMarks] = useState(1)
  const [bulkQuestionTimeLimit, setBulkQuestionTimeLimit] = useState(30)
  const [preSelectedBankQuestionIds, setPreSelectedBankQuestionIds] = useState<string[]>([])
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([])

  const handleSelectExam = (id: string, checked: boolean) => {
    setSelectedExamIds((prev) => 
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    )
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedExamIds(exams.map((e) => e.id))
    } else {
      setSelectedExamIds([])
    }
  }

  const handleBulkDelete = async () => {
    if (selectedExamIds.length === 0) return
    if (
      !confirm(
        `Are you sure you want to delete the ${selectedExamIds.length} selected exams? All student results, attempts, and questions associated with them will be permanently deleted.`
      )
    ) {
      return
    }

    setSaving(true)
    let successCount = 0
    let failureMessages: string[] = []

    try {
      for (const id of selectedExamIds) {
        const res = await deleteExam(id)
        if (res.success) {
          successCount++
        } else {
          const failedExam = exams.find((e) => e.id === id)
          failureMessages.push(`${failedExam?.title || 'Exam'}: ${res.error}`)
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} exam(s).`)
        setSelectedExamIds([])
        queryClient.invalidateQueries({ queryKey: ['admin-all-exams'] })
      }

      if (failureMessages.length > 0) {
        toast.error(`Failed to delete some exams:\n${failureMessages.join('\n')}`)
      }
    } catch (err: any) {
      toast.error(`Bulk deletion error: ${err.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  // Check query parameter for questions redirection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('fromQuestions') === 'true') {
        const stored = localStorage.getItem('selected_bank_question_ids')
        if (stored) {
          try {
            const ids = JSON.parse(stored)
            if (ids && ids.length > 0) {
              setPreSelectedBankQuestionIds(ids)
              setIsOpen(true)
            }
          } catch (e) {
            console.error('Error parsing pre-selected questions')
          }
        }
      }
    }
  }, [])

  const handleCloseDialog = () => {
    setIsOpen(false)
    setPastedQuestionsText('')
    setPreSelectedBankQuestionIds([])
    // Clear query parameter and localStorage
    localStorage.removeItem('selected_bank_question_ids')
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('fromQuestions')
      window.history.replaceState({}, '', url.toString())
    }
  }

  // 1. Fetch all subjects for administration dropdown
  const { data: allSubjects = [], isLoading: loadingSubjects } = useQuery<any[]>({
    queryKey: ['admin-exams-subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error
      const list = data || []
      if (list.length > 0) setSubjectId((list[0] as any).id)
      return list as any[]
    }
  })

  // 2. Fetch all exams
  const { data: exams = [], isLoading: loadingExams } = useQuery<any[]>({
    queryKey: ['admin-all-exams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exams')
        .select(`
          *,
          subjects (name),
          questions (id)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as any[]
    }
  })

  // Helper to parse plain text MCQ questions in the numbered format:
  // 1. Question?
  // A. Option A
  // B. Option B
  // ...
  // Answer: A
  const parseTextQuestions = (text: string) => {
    const cleanText = text.replace(/\r\n/g, '\n')
    const lines = cleanText.split('\n').map((l) => l.trim()).filter(Boolean)

    const questionsList: any[] = []
    let currentQuestion: any = null

    const mapOptionLetter = (char: string): string => {
      const mapping: { [key: string]: string } = {
        'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D',
        'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D'
      }
      return mapping[char.toUpperCase()] || char.toUpperCase()
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Match question line: starts with number (English or Bengali) followed by dot or parenthesis (e.g. "1.", "৫৯)")
      const questionMatch = line.match(/^([0-9০-৯]+)[\.\)]\s*(.+)$/i)
      if (questionMatch) {
        if (currentQuestion) {
          questionsList.push(currentQuestion)
        }
        currentQuestion = {
          question: questionMatch[2].trim(),
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_answer: '',
          difficulty: 'medium',
          tags: ''
        }
        continue
      }

      if (!currentQuestion) continue

      // Check for inline Bengali options on the same line, e.g.:
      // ক. কর্মীর     খ. মালিকের       গ. সুপারভাইজারের      ঘ. গ্রাহকের।
      const inlineBengaliMatch = line.match(/^\s*ক[\.\)]\s*(.+?)\s+খ[\.\)]\s*(.+?)\s+গ[\.\)]\s*(.+?)\s+ঘ[\.\)]\s*(.+)$/i)
      if (inlineBengaliMatch) {
        currentQuestion.option_a = inlineBengaliMatch[1].trim()
        currentQuestion.option_b = inlineBengaliMatch[2].trim()
        currentQuestion.option_c = inlineBengaliMatch[3].trim()
        currentQuestion.option_d = inlineBengaliMatch[4].trim()
        continue
      }

      // Check for inline English options on the same line, e.g.:
      // A. Option A  B. Option B  C. Option C  D. Option D
      const inlineEnglishMatch = line.match(/^\s*A[\.\)]\s*(.+?)\s+B[\.\)]\s*(.+?)\s+C[\.\)]\s*(.+?)\s+D[\.\)]\s*(.+)$/i)
      if (inlineEnglishMatch) {
        currentQuestion.option_a = inlineEnglishMatch[1].trim()
        currentQuestion.option_b = inlineEnglishMatch[2].trim()
        currentQuestion.option_c = inlineEnglishMatch[3].trim()
        currentQuestion.option_d = inlineEnglishMatch[4].trim()
        continue
      }

      // Match options on separate lines (either English A-D or Bengali ক-ঘ)
      const optAMatch = line.match(/^(?:A|ক)[\.\)]\s*(.+)$/i)
      if (optAMatch) {
        currentQuestion.option_a = optAMatch[1].trim()
        continue
      }
      const optBMatch = line.match(/^(?:B|খ)[\.\)]\s*(.+)$/i)
      if (optBMatch) {
        currentQuestion.option_b = optBMatch[1].trim()
        continue
      }
      const optCMatch = line.match(/^(?:C|গ)[\.\)]\s*(.+)$/i)
      if (optCMatch) {
        currentQuestion.option_c = optCMatch[1].trim()
        continue
      }
      const optDMatch = line.match(/^(?:D|ঘ)[\.\)]\s*(.+)$/i)
      if (optDMatch) {
        currentQuestion.option_d = optDMatch[1].trim()
        continue
      }

      // Match Answer line: Answer: A / উত্তরঃ গ / Ans: খ etc.
      const ansMatch = line.match(/^(?:Answer|Correct Answer|Ans|Correct|উত্তরঃ|উত্তর|উঃ)[:：]?\s*([A-Dক-ঘ])/i)
      if (ansMatch) {
        currentQuestion.correct_answer = mapOptionLetter(ansMatch[1].trim())
        continue
      }

      // Match Difficulty: easy/medium/hard (optional)
      const diffMatch = line.match(/^Difficulty:\s*(easy|medium|hard)/i)
      if (diffMatch) {
        currentQuestion.difficulty = diffMatch[1].trim().toLowerCase()
        continue
      }

      // Match Tags: tag1, tag2 (optional)
      const tagsMatch = line.match(/^Tags:\s*(.+)/i)
      if (tagsMatch) {
        currentQuestion.tags = tagsMatch[1].trim()
        continue
      }

      // Append multi-line question titles if options haven't started yet
      if (
        currentQuestion &&
        !currentQuestion.option_a &&
        !currentQuestion.option_b &&
        !currentQuestion.option_c &&
        !currentQuestion.option_d &&
        !currentQuestion.correct_answer
      ) {
        currentQuestion.question += ' ' + line
      }
    }

    if (currentQuestion) {
      questionsList.push(currentQuestion)
    }

    return questionsList
  }

  // Handle Create Exam
  const handleCreate = async () => {
    if (!title.trim() || !subjectId || !startDate || !endDate) {
      toast.error('Title, Subject, Start Date, and End Date are required.')
      return
    }

    // Parse and validate questions if pasted
    let parsedQuestions: any[] = []
    if (pastedQuestionsText.trim()) {
      try {
        parsedQuestions = parseTextQuestions(pastedQuestionsText)
        if (parsedQuestions.length === 0) {
          toast.error('No valid questions found in pasted text. Please check format.')
          return
        }
      } catch (err: any) {
        toast.error(`Question parsing error: ${err.message || err}`)
        return
      }
    }

    setSaving(true)
    try {
      let isoStart = ''
      let isoEnd = ''
      try {
        isoStart = new Date(startDate).toISOString()
        isoEnd = new Date(endDate).toISOString()
      } catch (dateErr) {
        toast.error('Invalid Date/Time format. Please check date inputs.')
        setSaving(false)
        return
      }

      const res = await createExam({
        title,
        subjectId,
        description,
        startDate: isoStart,
        endDate: isoEnd,
        totalMarks: 0, // will be updated below if questions are added
        passingMarks: Number(passingMarks),
        allowBacktracking,
        randomizeQuestions,
        randomizeOptions,
        maxAttempts: Number(maxAttempts),
        allowRetake,
        warningLimit: Number(warningLimit),
        autoSubmitAfterLimit,
        examDurationMinutes: examDurationMinutes ? Number(examDurationMinutes) : undefined,
        showResultAfterSubmit,
        showCorrectAnswers,
        negativeMarking,
        negativeMarkValue: Number(negativeMarkValue),
      })

      if (res.success && res.exam) {
        const newExamId = res.exam.id

        // Check if we have pre-selected questions to link
        if (preSelectedBankQuestionIds.length > 0) {
          const linkRes = await bulkLinkQuestionsFromBank(
            newExamId,
            preSelectedBankQuestionIds,
            Number(bulkQuestionMarks),
            Number(bulkQuestionTimeLimit)
          )
          if (!linkRes.success) {
            toast.error(`Exam created, but linking bank questions failed: ${linkRes.error}`)
          }
        }

        // Check if we have pasted questions to add
        if (parsedQuestions.length > 0) {
          const addRes = await bulkAddQuestionsToExamAndBank(
            newExamId,
            subjectId,
            parsedQuestions,
            Number(bulkQuestionMarks),
            Number(bulkQuestionTimeLimit)
          )
          if (!addRes.success) {
            toast.error(`Exam created, but bulk adding questions failed: ${addRes.error}`)
          }
        }

        toast.success(
          parsedQuestions.length > 0 || preSelectedBankQuestionIds.length > 0
            ? 'Exam draft created with questions!'
            : 'Exam draft created!'
        )
        handleCloseDialog()
        queryClient.invalidateQueries({ queryKey: ['admin-all-exams'] })
        router.push(`/admin/exams/${newExamId}`)
      } else {
        toast.error(res.error || 'Failed to create exam')
      }
    } catch (err: any) {
      console.error('Error creating exam')
      toast.error('Connection failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Handle Delete Exam
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exam? All student results, attempts, and questions associated with it will be permanently deleted.')) return
    try {
      const res = await deleteExam(id)
      if (res.success) {
        toast.success('Exam deleted successfully!')
        queryClient.invalidateQueries({ queryKey: ['admin-all-exams'] })
      } else {
        toast.error(res.error || 'Failed to delete')
      }
    } catch (err) {
      toast.error('Deletion error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-indigo-500" />
            Exams Oversight
          </h1>
          <p className="text-sm text-slate-400">View and manage all active, draft, and completed examinations across all subjects.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedExamIds.length > 0 && (
            <Button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white gap-2 shadow-md">
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedExamIds.length})
            </Button>
          )}
          <Button onClick={() => setIsOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md">
            <Plus className="h-4 w-4" />
            Create Exam
          </Button>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-0">
          {loadingExams ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Fetching exams database...</span>
            </div>
          ) : exams.length === 0 ? (
            <div className="text-center p-16 text-slate-500">
              No exams built yet. Click "Create Exam" to draft your first examination.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="w-[45px] text-center">
                      <input 
                        type="checkbox" 
                        checked={exams.length > 0 && selectedExamIds.length === exams.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="text-slate-400">Title</TableHead>
                    <TableHead className="text-slate-400">Subject</TableHead>
                    <TableHead className="text-slate-400">Duration / Schedule</TableHead>
                    <TableHead className="text-slate-400 text-center">Questions</TableHead>
                    <TableHead className="text-slate-400 text-center">Total Marks</TableHead>
                    <TableHead className="text-slate-400 text-center">Settings</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((exam: any) => {
                    const isSelected = selectedExamIds.includes(exam.id)
                    return (
                      <TableRow key={exam.id} className="border-b border-slate-800/60 hover:bg-slate-900/30">
                        <TableCell className="w-[45px] text-center">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => handleSelectExam(exam.id, e.target.checked)}
                            className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="font-semibold text-white max-w-[180px] truncate">
                          {exam.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-indigo-500/20 bg-indigo-500/5 text-indigo-400">
                            {exam.subjects?.name || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1 font-semibold">
                              <Clock className="h-3 w-3 text-indigo-400" />
                              {exam.exam_duration_minutes ? `${exam.exam_duration_minutes} mins` : 'Per-Question Timer'}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Calendar className="h-3 w-3" />
                              Starts: {new Date(exam.start_date).toLocaleDateString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-slate-300 font-mono text-sm">
                          {exam.questions?.length || 0}
                        </TableCell>
                        <TableCell className="text-center text-slate-300 font-semibold font-mono">
                          {exam.total_marks} / Pass: {exam.passing_marks}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-wrap gap-1 items-center justify-center">
                            {exam.negative_marking && (
                              <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] scale-90">
                                -{exam.negative_mark_value} Neg
                              </Badge>
                            )}
                            {exam.randomize_questions && (
                              <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] scale-90">
                                Rand Q
                              </Badge>
                            )}
                            {exam.randomize_options && (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] scale-90">
                                Rand Opt
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              exam.status === 'published' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : exam.status === 'completed'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                            }
                          >
                            {exam.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/exams/${exam.id}`)} className="h-8 w-8 text-indigo-400 hover:text-white">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(exam.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Creation Modal */}
      <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-5xl w-full border-slate-800 bg-slate-900 text-white max-h-[90vh] overflow-y-auto">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Draft Examination</h3>
              <p className="text-xs text-slate-400">Formulate standard details and configure exam execution settings.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Core Settings */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="exam-title">Exam Title</Label>
                  <Input
                     id="exam-title"
                     placeholder="e.g. Midterm Algebra Exam"
                     value={title}
                     onChange={(e) => setTitle(e.target.value)}
                     className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus-visible:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="exam-subject">Course Subject</Label>
                  <select
                    id="exam-subject"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500"
                  >
                    {allSubjects.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="exam-desc">Description (Optional)</Label>
                  <Textarea
                    id="exam-desc"
                    placeholder="Provide candidate instructions..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 min-h-[5rem]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="start-date">Start Time</Label>
                    <Input
                      id="start-date"
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="end-date">End Time</Label>
                    <Input
                      id="end-date"
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pass-marks">Passing Marks</Label>
                    <Input
                      id="pass-marks"
                      type="number"
                      value={passingMarks}
                      onChange={(e) => setPassingMarks(Number(e.target.value))}
                      className="bg-slate-950 border-slate-800 text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="exam-dur">Duration (Minutes)</Label>
                    <Input
                      id="exam-dur"
                      type="number"
                      placeholder="Blank for per-Q timer"
                      value={examDurationMinutes}
                      onChange={(e) => setExamDurationMinutes(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white placeholder-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Advanced Settings Panel */}
              <div className="space-y-4 border-l border-slate-800/80 pl-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Settings Panel</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Allow Backtracking</Label>
                    <p className="text-[10px] text-slate-500">Enable return to previous Qs</p>
                  </div>
                  <Switch checked={allowBacktracking} onCheckedChange={setAllowBacktracking} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Randomize Question Order</Label>
                    <p className="text-[10px] text-slate-500">Vary question sequences per student</p>
                  </div>
                  <Switch checked={randomizeQuestions} onCheckedChange={setRandomizeQuestions} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Randomize Option Order</Label>
                    <p className="text-[10px] text-slate-500">Vary option A-D listings per student</p>
                  </div>
                  <Switch checked={randomizeOptions} onCheckedChange={setRandomizeOptions} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Negative Marking</Label>
                    <p className="text-[10px] text-slate-500">Apply wrong answer penalty</p>
                  </div>
                  <Switch checked={negativeMarking} onCheckedChange={setNegativeMarking} />
                </div>

                {negativeMarking && (
                  <div className="space-y-1 pl-2">
                    <Label className="text-xs text-slate-400">Negative Penalty Value</Label>
                    <Input
                      type="number"
                      step="0.05"
                      value={negativeMarkValue}
                      onChange={(e) => setNegativeMarkValue(Number(e.target.value))}
                      className="bg-slate-950 border-slate-800 text-white h-8 text-xs"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Allow Retakes</Label>
                    <p className="text-[10px] text-slate-500">Allow extra exam attempts</p>
                  </div>
                  <Switch checked={allowRetake} onCheckedChange={setAllowRetake} />
                </div>

                {allowRetake && (
                  <div className="space-y-1 pl-2">
                    <Label className="text-xs text-slate-400">Max Attempt Count</Label>
                    <Input
                      type="number"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(Number(e.target.value))}
                      className="bg-slate-950 border-slate-800 text-white h-8 text-xs"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                  <div className="space-y-1">
                    <Label className="text-xs">Warnings Limit</Label>
                    <Input
                      type="number"
                      value={warningLimit}
                      onChange={(e) => setWarningLimit(Number(e.target.value))}
                      className="bg-slate-950 border-slate-800 text-white h-8 text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-5">
                    <Label className="text-xs text-slate-400">Auto-Submit</Label>
                    <Switch checked={autoSubmitAfterLimit} onCheckedChange={setAutoSubmitAfterLimit} />
                  </div>
                </div>
              </div>

              {/* Third Column: Bulk Questions (Optional) */}
              <div className="space-y-4 border-l border-slate-800/80 pl-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Bulk Questions (Optional)</h4>
                
                {preSelectedBankQuestionIds.length > 0 && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-400 text-xs">
                    <p className="font-semibold mb-0.5">Linked from Bank</p>
                    <p className="text-[10px] text-slate-400">
                      {preSelectedBankQuestionIds.length} question(s) will be copied to this exam.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="bulk-questions" className="text-xs text-slate-300">Paste Questions Content</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setPastedQuestionsText(`1. What is Meta?\nA. Meta is the parent company of Facebook, Instagram, and WhatsApp.\nB. Meta is a mobile phone company.\nC. Meta is a search engine.\nD. Meta is a web browser.\nAnswer: A\n\n2. Which platform belongs to Meta?\nA. YouTube\nB. Instagram\nC. LinkedIn\nD. Telegram\nAnswer: B`)}
                      className="text-indigo-400 hover:text-indigo-300 text-[10px] h-6 px-1.5"
                    >
                      Load Sample
                    </Button>
                  </div>
                  <Textarea
                    id="bulk-questions"
                    placeholder={`1. Question Title\nA. Option A\nB. Option B\nC. Option C\nD. Option D\nAnswer: A`}
                    value={pastedQuestionsText}
                    onChange={(e) => setPastedQuestionsText(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white placeholder-slate-700 font-mono text-xs min-h-[12rem] resize-y"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-400">Marks Per Q</Label>
                    <Input
                      type="number"
                      value={bulkQuestionMarks}
                      onChange={(e) => setBulkQuestionMarks(Number(e.target.value))}
                      className="bg-slate-950 border-slate-800 text-white h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-400">Time Limit (Sec)</Label>
                    <Input
                      type="number"
                      value={bulkQuestionTimeLimit}
                      onChange={(e) => setBulkQuestionTimeLimit(Number(e.target.value))}
                      className="bg-slate-950 border-slate-800 text-white h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                  <h5 className="text-[10px] font-semibold text-slate-400 mb-1">Expected Format:</h5>
                  <pre className="text-[9px] text-indigo-300 font-mono leading-tight whitespace-pre-wrap select-all">
{`1. Question?
A. Option A
B. Option B
Answer: A`}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-800/80">
              <Button variant="outline" onClick={handleCloseDialog} className="border-slate-800 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Draft...
                  </>
                ) : (
                  'Build Exam Draft'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
