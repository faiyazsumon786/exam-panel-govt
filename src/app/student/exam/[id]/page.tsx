'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { 
  startExamAttempt, 
  saveAnswerAndProgress, 
  logCheatingEvent, 
  submitExamAttempt 
} from '@/app/actions/exam-engine'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Loader2, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  ArrowRight, 
  ArrowLeft,
  Lock,
  FileSpreadsheet
} from 'lucide-react'

export default function StudentExamTakingPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string
  const supabase = createClient()

  // State
  const [attempt, setAttempt] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null)
  const [answers, setAnswers] = useState<{ [key: string]: 'A' | 'B' | 'C' | 'D' | null }>({})
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [qTimeRemaining, setQTimeRemaining] = useState<number | null>(null)
  const [warnings, setWarnings] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [examStarted, setExamStarted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Refs for tracking timers
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const qTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isSubmittingRef = useRef(false)

  // 1. Fetch Exam details
  const { data: rawExam, isLoading: loadingExam, refetch: refetchExam } = useQuery({
    queryKey: ['student-exam-taking-details', examId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exams')
        .select('*, subjects(name), questions(*)')
        .eq('id', examId)
        .single()

      if (error) throw error
      return data
    }
  })
  const exam = rawExam as any

  // Start exam trigger
  const handleStartExam = async () => {
    // Enter fullscreen
    try {
      const docEl = document.documentElement
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen()
      }
      setIsFullscreen(true)
    } catch (err) {
      toast.error('Failed to enter fullscreen mode. Fullscreen is mandatory for taking this exam.')
      return
    }

    try {
      const res = await startExamAttempt(examId)
      if (res.success && res.attempt) {
        // Refetch exam details to load questions now that active attempt RLS is satisfied
        const { data: updatedExam } = await refetchExam()
        const examDetails = updatedExam as any

        setAttempt(res.attempt)
        setWarnings(res.attempt.warnings_count)
        
        // Re-order questions based on attempt.question_order
        if (examDetails?.questions) {
          const qMap = new Map(examDetails.questions.map((q: any) => [q.id, q]))
          const ordered = res.attempt.question_order.map((qId: string) => qMap.get(qId)).filter(Boolean)
          setQuestions(ordered)
        }

        // Set timers
        if (res.attempt.time_remaining_seconds !== null) {
          setTimeRemaining(res.attempt.time_remaining_seconds)
        } else {
          // If per-question timer
          const currentQ = examDetails?.questions?.find((q: any) => q.id === res.attempt.question_order[0])
          setQTimeRemaining(currentQ?.time_limit || 30)
        }

        setExamStarted(true)
        toast.success('Exam started! All anti-cheating protocols are active.')
      } else {
        toast.error(res.error || 'Failed to start exam attempt.')
      }
    } catch (err: any) {
      toast.error('Error starting attempt')
    }
  }

  // Proctoring Violation Logger
  const triggerViolation = async (eventType: string, details: string) => {
    if (!attempt || isSubmittingRef.current) return

    toast.warning(`Security warning triggered: ${eventType.replace('_', ' ').toUpperCase()}`, {
      icon: <ShieldAlert className="h-5 w-5 text-red-500" />
    })

    try {
      const res = await logCheatingEvent(attempt.id, eventType, details)
      if (res.success) {
        setWarnings(res.warningsCount)
        if (res.autoSubmitted) {
          isSubmittingRef.current = true
          toast.error('EXAM TERMINATED: You have exceeded the warning limit. Exam submitted automatically.')
          document.exitFullscreen().catch(() => {})
          router.push(`/student/result/${res.resultId}`)
        }
      }
    } catch (err) {
      console.error('Error logging violation')
    }
  }

  // Safe window actions
  useEffect(() => {
    if (!examStarted || !attempt) return

    // 1. Prevent Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      triggerViolation('right_click', 'Prevented right-click menu')
    }

    // 2. Prevent Copy/Paste/Cut
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault()
      triggerViolation('copy_paste', `Prevented keyboard clipboard action: ${e.type}`)
    }

    // 3. Tab Switches & Minimization
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        triggerViolation('tab_switch', 'Student switched tabs or minimized browser')
      }
    }

    // 4. Window focus lose
    const handleBlur = () => {
      triggerViolation('window_blur', 'Student switched focus away from exam screen')
    }

    // 5. Keyboard shortcuts block (F12, Ctrl+Shift+I, Command+Alt+I)
    const handleKeys = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.metaKey && e.altKey && e.key === 'i')
      ) {
        e.preventDefault()
        triggerViolation('devtools_open', 'Attempted to open Developer Tools')
      }
    }

    // 6. Fullscreen exit check
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false)
        triggerViolation('fullscreen_exit', 'Student exited fullscreen mode')
      } else {
        setIsFullscreen(true)
      }
    }

    // Bind listeners
    window.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('copy', handleCopyPaste)
    window.addEventListener('paste', handleCopyPaste)
    window.addEventListener('cut', handleCopyPaste)
    document.addEventListener('visibilitychange', handleVisibility)
    // window.addEventListener('blur', handleBlur) // Commented out to prevent dev/reload false positive focus violations
    window.addEventListener('keydown', handleKeys)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('copy', handleCopyPaste)
      window.removeEventListener('paste', handleCopyPaste)
      window.removeEventListener('cut', handleCopyPaste)
      document.removeEventListener('visibilitychange', handleVisibility)
      // window.removeEventListener('blur', handleBlur)
      window.removeEventListener('keydown', handleKeys)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [examStarted, attempt])

  // Countdowns implementation
  useEffect(() => {
    if (!examStarted || !attempt) return

    // Standard Full Exam Duration Timer
    if (timeRemaining !== null) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null) return null
          if (prev <= 1) {
            clearInterval(timerRef.current!)
            setTimeout(() => handleAutoSubmit(), 0)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    // Per Question Timer
    if (qTimeRemaining !== null) {
      qTimerRef.current = setInterval(() => {
        setQTimeRemaining((prev) => {
          if (prev === null) return null
          if (prev <= 1) {
            clearInterval(qTimerRef.current!)
            setTimeout(() => handleNextQuestion(true), 0) // Auto move to next Q on time expired
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (qTimerRef.current) clearInterval(qTimerRef.current)
    }
  }, [examStarted, attempt, currentQIndex, qTimeRemaining])

  // Periodic Telemetry Push (every 5 seconds)
  useEffect(() => {
    if (!examStarted || !attempt) return

    const pushTelemetry = setInterval(async () => {
      try {
        await (supabase
          .from('exam_attempts') as any)
          .update({
            time_remaining_seconds: timeRemaining,
            current_question_index: currentQIndex
          })
          .eq('id', attempt.id)
      } catch (err) {
        console.error('Telemetry push failed')
      }
    }, 5000)

    return () => clearInterval(pushTelemetry)
  }, [examStarted, attempt, timeRemaining, currentQIndex])

  // Load current option selection if saved
  useEffect(() => {
    if (questions.length === 0 || !attempt) return
    const currentQ = questions[currentQIndex]
    if (!currentQ) return
    
    // Fetch answer if already saved
    const fetchSavedAnswer = async () => {
      const { data } = await supabase
        .from('exam_answers')
        .select('selected_option')
        .eq('attempt_id', attempt.id)
        .eq('question_id', currentQ.id)
        .single() as any

      if (data?.selected_option) {
        setSelectedOption(data.selected_option as any)
      } else {
        setSelectedOption(null)
      }
    }
    fetchSavedAnswer()
  }, [currentQIndex, questions, attempt])

  // Save current answer and progress to next question
  const handleNextQuestion = async (timeExpired = false) => {
    if (questions.length === 0 || !attempt) return
    const currentQ = questions[currentQIndex]
    if (!currentQ) return

    // Save current answer
    try {
      await saveAnswerAndProgress(
        attempt.id,
        currentQ.id,
        selectedOption,
        currentQIndex + 1,
        timeRemaining
      )
    } catch (err) {
      console.error('Error saving answer')
    }

    // Move next
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => {
        if (prev >= questions.length - 1) return prev
        return prev + 1
      })
      setSelectedOption(null)

      // Reset per question timer if applicable
      if (qTimeRemaining !== null) {
        const nextQ = questions[currentQIndex + 1]
        setQTimeRemaining(nextQ?.time_limit || 30)
      }
    } else {
      // Completed last question
      handleManualSubmit()
    }
  }

  // Previous Question (Only if backtracking allowed)
  const handlePrevQuestion = async () => {
    if (currentQIndex > 0 && exam?.allow_backtracking && attempt) {
      const currentQ = questions[currentQIndex]
      if (!currentQ) return
      // Save current answer first
      try {
        await saveAnswerAndProgress(
          attempt.id,
          currentQ.id,
          selectedOption,
          currentQIndex - 1,
          timeRemaining
        )
      } catch (err) {
        console.error('Error saving answer')
      }

      setCurrentQIndex((prev) => {
        if (prev <= 0) return prev
        return prev - 1
      })
      setSelectedOption(null)
    }
  }

  // Submit Actions
  const handleManualSubmit = async () => {
    if (!attempt) return
    
    // Set submitting flag synchronously before confirm blocks the thread
    isSubmittingRef.current = true
    
    if (!confirm('Are you sure you want to finish and submit your exam?')) {
      isSubmittingRef.current = false
      return
    }
    
    setSubmitting(true)
    try {
      // Save last question answer
      const currentQ = questions[currentQIndex]
      if (currentQ) {
        await saveAnswerAndProgress(attempt.id, currentQ.id, selectedOption, currentQIndex, timeRemaining)
      }

      const res = await submitExamAttempt(attempt.id)
      if (res.success && res.result) {
        toast.success('Exam submitted successfully!')
        document.exitFullscreen().catch(() => {})
        router.push(`/student/result/${res.result.id}`)
      } else {
        toast.error(res.error || 'Failed to submit exam')
        isSubmittingRef.current = false
      }
    } catch (err) {
      toast.error('Submission error occurred')
      isSubmittingRef.current = false
    } finally {
      setSubmitting(false)
    }
  }

  const handleAutoSubmit = async () => {
    if (!attempt) return
    isSubmittingRef.current = true
    setSubmitting(true)
    try {
      const res = await submitExamAttempt(attempt.id, true)
      if (res.success && res.result) {
        toast.success('Exam duration expired! Exam submitted automatically.')
        document.exitFullscreen().catch(() => {})
        router.push(`/student/result/${res.result.id}`)
      } else {
        isSubmittingRef.current = false
      }
    } catch (err) {
      console.error('Auto submission error')
      isSubmittingRef.current = false
    } finally {
      setSubmitting(false)
    }
  }

  // Format Overall Timer
  const formatTimer = () => {
    if (timeRemaining === null) return ''
    const mins = Math.floor(timeRemaining / 60)
    const secs = timeRemaining % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loadingExam) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white" suppressHydrationWarning>
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!exam) return <div className="text-white text-center p-12">Exam details could not be found.</div>

  // RENDER PHASE 1: START SCREEN (Enforces Fullscreen start)
  if (!examStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <Card className="w-full max-w-lg border-slate-800 bg-slate-900/60 backdrop-blur-md p-4">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-2">
              <Lock className="h-6 w-6 text-indigo-500" />
            </div>
            <CardTitle className="text-lg font-bold text-white">Exam Entry Portal</CardTitle>
            <CardDescription className="text-slate-400 text-xs">{exam.title} ({exam.subjects?.name})</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg space-y-1.5 text-xs">
              <p className="font-bold text-indigo-400">Important Instructions:</p>
              <p>• Fullscreen mode is mandatory and will be locked upon starting.</p>
              <p>• Shifting tabs, minimizing the browser, or losing focus will trigger violations.</p>
              <p>• Copying, pasting, and right-clicking are strictly disabled.</p>
              <p>• Exceeding {exam.warning_limit} warnings will terminate and auto-submit the exam.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1 text-slate-400 font-semibold">
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {exam.exam_duration_minutes ? `${exam.exam_duration_minutes} Minutes` : 'Per-Question Timer'}</span>
              <span className="flex items-center gap-1"><FileSpreadsheet className="h-4 w-4" /> {exam.total_marks} Marks / Passing {exam.passing_marks}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleStartExam} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md h-10">
              Acknowledge & Enter Exam
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // RENDER PHASE 2: EXAM CORE TAKING INTERFACE
  const currentQuestion = questions[currentQIndex]
  if (!currentQuestion) return null

  // Resolve randomized option rendering order
  const resolvedOptionsOrder = attempt.option_orders?.[currentQuestion.id] || ['A', 'B', 'C', 'D']

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white select-none">
      {/* Top Header Monitor Bar */}
      <header className="sticky top-0 z-40 h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between">
        {/* Dynamic overall or per-question timer & warnings count */}
        <div className="flex items-center gap-4">
          {timeRemaining !== null ? (
            <div className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/20 px-4 py-1.5 rounded-full text-indigo-400 text-base md:text-lg lg:text-xl font-mono font-extrabold animate-pulse shadow-md">
              <Clock className="h-5 w-5 md:h-6 md:w-6" />
              {formatTimer()}
            </div>
          ) : qTimeRemaining !== null ? (
            <div className="flex items-center gap-2 bg-cyan-600/10 border border-cyan-500/20 px-4 py-1.5 rounded-full text-cyan-400 text-base md:text-lg lg:text-xl font-mono font-extrabold animate-pulse shadow-md">
              <Clock className="h-5 w-5 md:h-6 md:w-6" />
              {qTimeRemaining}s
            </div>
          ) : null}

          {/* Warnings Count indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${
            warnings > 0 
              ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
              : 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20'
          }`}>
            <AlertTriangle className="h-4 w-4" />
            Warnings: {warnings} / {exam.warning_limit}
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-sm font-bold text-slate-200">{exam.title}</h2>
          <span className="text-[10px] text-slate-500">Question {currentQIndex + 1} of {questions.length}</span>
        </div>
      </header>

      {/* Main Question view Card */}
      <main className="flex-1 flex items-start justify-center p-4 md:p-8 overflow-y-auto pt-6 pb-12">
        <div className="w-full max-w-2xl space-y-4">
          {/* Question progress */}
          <Progress value={((currentQIndex + 1) / questions.length) * 100} className="h-1.5 bg-slate-900" />
          
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-800">
              <div className="flex justify-between items-start gap-4">
                <CardTitle className="text-white text-base leading-relaxed font-semibold">
                  {currentQuestion.question_title}
                </CardTitle>
                <div className="flex flex-col items-end shrink-0 gap-1.5">
                  <Badge variant="outline" className="border-slate-800 text-slate-400 font-mono text-[10px]">
                    {currentQuestion.marks} pt(s)
                  </Badge>
                  
                  {/* Per question timer indicator */}
                  {qTimeRemaining !== null && (
                    <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/5 text-cyan-400 font-mono text-xs md:text-sm px-2.5 py-1">
                      {qTimeRemaining}s left
                    </Badge>
                  )}

                  {/* Overall timer indicator */}
                  {timeRemaining !== null && (
                    <Badge variant="outline" className="border-indigo-500/20 bg-indigo-500/5 text-indigo-400 font-mono text-xs md:text-sm px-2.5 py-1">
                      {formatTimer()} left
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-6 space-y-3">
              {/* Options lists */}
              {resolvedOptionsOrder.map((key: 'A' | 'B' | 'C' | 'D') => {
                const optText = 
                  key === 'A' ? currentQuestion.option_a :
                  key === 'B' ? currentQuestion.option_b :
                  key === 'C' ? currentQuestion.option_c :
                  currentQuestion.option_d

                const isSelected = selectedOption === key
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedOption(key)}
                    className={`w-full p-4 text-left rounded-xl border transition-all text-sm font-medium flex items-center gap-3 ${
                      isSelected 
                        ? 'bg-indigo-600/20 border-indigo-600 text-white shadow-lg shadow-indigo-600/5'
                        : 'border-slate-800 bg-slate-950/40 hover:bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <span className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      isSelected 
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-500'
                    }`}>
                      {key}
                    </span>
                    <span>{optText}</span>
                  </button>
                )
              })}
            </CardContent>
            
            <CardFooter className="p-0 pt-6 mt-6 border-t border-slate-800 flex justify-between gap-3">
              {exam.allow_backtracking ? (
                <Button 
                  onClick={handlePrevQuestion} 
                  disabled={currentQIndex === 0} 
                  variant="outline" 
                  className="border-slate-800 text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              ) : (
                <div /> // empty flex spacer
              )}

              {currentQIndex < questions.length - 1 ? (
                <Button onClick={() => handleNextQuestion(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-5">
                  Save & Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleManualSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6 shadow-lg shadow-emerald-600/10" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Submit Exam'
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </main>

      {/* Mandatory Fullscreen Overlay guard if exited */}
      {!isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur flex items-center justify-center p-4">
          <Card className="max-w-md border-red-500 bg-slate-900 text-center p-4 shadow-2xl">
            <CardHeader className="pb-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 mb-2 animate-bounce">
                <ShieldAlert className="h-6 w-6 text-red-500" />
              </div>
              <CardTitle className="text-lg font-bold text-white">Security Block</CardTitle>
              <CardDescription className="text-red-400 font-semibold">Mandatory Fullscreen Exited!</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-300">
                You exited fullscreen mode. This is a severe security violation. Return to fullscreen immediately to avoid examination cancellation.
              </p>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={async () => {
                  try {
                    await document.documentElement.requestFullscreen()
                    setIsFullscreen(true)
                  } catch (err) {
                    toast.error('Re-entry failed. Click again.')
                  }
                }} 
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                Re-enter Fullscreen Mode
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
