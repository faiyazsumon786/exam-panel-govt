'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
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
  FileSpreadsheet,
  Check,
  Maximize2
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
  const [acknowledged, setAcknowledged] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [animationClass, setAnimationClass] = useState('animate-fade-in-up')

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

  // Load all saved answers for the current attempt to initialize the progress indicator & answers map
  const fetchAllSavedAnswers = async (attemptId: string) => {
    try {
      const { data } = await supabase
        .from('exam_answers')
        .select('question_id, selected_option')
        .eq('attempt_id', attemptId) as any

      if (data) {
        const answersMap: { [key: string]: 'A' | 'B' | 'C' | 'D' | null } = {}
        data.forEach((ans: any) => {
          if (ans.selected_option) {
            answersMap[ans.question_id] = ans.selected_option
          }
        })
        setAnswers(answersMap)
      }
    } catch (err) {
      console.error('Error prefetching saved answers:', err)
    }
  }

  // Prepopulate answers cache if attempt changes
  useEffect(() => {
    if (attempt?.id) {
      fetchAllSavedAnswers(attempt.id)
    }
  }, [attempt?.id])

  // Sync selectedOption locally when question or answers changes (avoids constant DB fetch)
  useEffect(() => {
    if (questions.length === 0) return
    const currentQ = questions[currentQIndex]
    if (currentQ) {
      setSelectedOption(answers[currentQ.id] || null)
    }
  }, [currentQIndex, questions, answers])

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
        
        // Load existing answers if any (to resume mid-way attempt)
        await fetchAllSavedAnswers(res.attempt.id)
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

  // Local handler to save option choice and update cache instantly
  const handleSelectOption = (key: 'A' | 'B' | 'C' | 'D') => {
    setSelectedOption(key)
    const currentQ = questions[currentQIndex]
    if (currentQ) {
      setAnswers((prev) => ({ ...prev, [currentQ.id]: key }))
    }
  }

  // Save current answer and progress to next question (non-blocking visual transitions)
  const handleNextQuestion = async (timeExpired = false) => {
    if (questions.length === 0 || !attempt) return
    const currentQ = questions[currentQIndex]
    if (!currentQ) return

    setIsNavigating(true)

    // Trigger slide out left
    setAnimationClass('animate-slide-out-left')
    await new Promise((resolve) => setTimeout(resolve, 250))

    // Save current answer in background (non-blocking)
    saveAnswerAndProgress(
      attempt.id,
      currentQ.id,
      selectedOption,
      currentQIndex + 1,
      timeRemaining
    ).catch((err) => {
      console.error('Error saving answer:', err)
    })

    // Move next
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1)
      setSelectedOption(null)

      // Reset per question timer if applicable
      if (qTimeRemaining !== null) {
        const nextQ = questions[currentQIndex + 1]
        setQTimeRemaining(nextQ?.time_limit || 30)
      }
      setIsNavigating(false)
      setAnimationClass('animate-slide-in-right')
    } else {
      setIsNavigating(false)
      // Completed last question
      // Check if there are any unanswered questions left
      const unansweredIndex = questions.findIndex(q => !answers[q.id])
      if (unansweredIndex !== -1) {
        toast.info('Reviewing skipped questions...', {
          description: 'You skipped some questions. Redirecting to the first unanswered question.',
          duration: 4000
        })
        
        setIsNavigating(true)
        // Slide out to the appropriate direction based on index difference
        const direction = unansweredIndex > currentQIndex ? 'animate-slide-out-left' : 'animate-slide-out-right'
        const incoming = unansweredIndex > currentQIndex ? 'animate-slide-in-right' : 'animate-slide-in-left'
        
        setAnimationClass(direction)
        setTimeout(() => {
          setCurrentQIndex(unansweredIndex)
          setSelectedOption(null)
          setIsNavigating(false)
          setAnimationClass(incoming)
        }, 250)
      } else {
        handleManualSubmit()
      }
    }
  }

  // Previous Question (Only if backtracking allowed, non-blocking visual transitions)
  const handlePrevQuestion = async () => {
    if (currentQIndex > 0 && exam?.allow_backtracking && attempt) {
      const currentQ = questions[currentQIndex]
      if (!currentQ) return

      setIsNavigating(true)

      // Trigger slide out right
      setAnimationClass('animate-slide-out-right')
      await new Promise((resolve) => setTimeout(resolve, 250))

      // Save current answer in background (non-blocking)
      saveAnswerAndProgress(
        attempt.id,
        currentQ.id,
        selectedOption,
        currentQIndex - 1,
        timeRemaining
      ).catch((err) => {
        console.error('Error saving answer:', err)
      })

      setCurrentQIndex((prev) => prev - 1)
      setSelectedOption(null)
      setIsNavigating(false)
      setAnimationClass('animate-slide-in-left')
    }
  }

  // Submit Actions (trigger custom modal confirmation)
  const handleManualSubmit = () => {
    if (!attempt) return
    isSubmittingRef.current = true
    setShowSubmitConfirm(true)
  }

  // Executed on confirming in the modal
  const executeSubmit = async () => {
    setSubmitting(true)
    let success = false
    try {
      const currentQ = questions[currentQIndex]
      if (currentQ) {
        await saveAnswerAndProgress(attempt.id, currentQ.id, selectedOption, currentQIndex, timeRemaining)
      }

      const res = await submitExamAttempt(attempt.id)
      if (res.success && res.result) {
        success = true
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
      if (!success) {
        setSubmitting(false)
        setShowSubmitConfirm(false)
      }
    }
  }

  const handleAutoSubmit = async () => {
    if (!attempt) return
    isSubmittingRef.current = true
    setSubmitting(true)
    let success = false
    try {
      const res = await submitExamAttempt(attempt.id, true)
      if (res.success && res.result) {
        success = true
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
      if (!success) {
        setSubmitting(false)
      }
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
      <div className="relative flex min-h-screen items-center justify-center bg-slate-950 p-4 overflow-hidden">
        {/* Decorative background glowing orbs */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-violet-600/10 blur-[100px] pointer-events-none animate-pulse" />

        <Card className="relative w-full max-w-lg border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 animate-fade-in-up shadow-2xl shadow-indigo-950/40">
          <CardHeader className="text-center pb-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-3 shadow-inner shadow-indigo-500/10 animate-pulse">
              <Lock className="h-6 w-6 text-indigo-400" />
            </div>
            <CardTitle className="text-xl font-bold text-white tracking-tight">Exam Entry Portal</CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1 font-medium">{exam.title} ({exam.subjects?.name})</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-slate-300">
            
            <div className="space-y-3">
              <p className="font-semibold text-indigo-400 text-xs px-1 uppercase tracking-wider">Mandatory Security Guidelines:</p>
              
              <div className="grid gap-2.5">
                <div className="flex items-start gap-3 p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl hover:border-slate-700/80 hover:bg-slate-900/40 transition-all duration-200">
                  <div className="p-1.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs">Mandatory Fullscreen</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">The exam must be taken in fullscreen. Exiting fullscreen mode triggers a violation.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl hover:border-slate-700/80 hover:bg-slate-900/40 transition-all duration-200">
                  <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs">Strict Tab Lockout</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">Do not switch tabs, minimize the browser, or lose focus. Any navigation is flagged.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl hover:border-slate-700/80 hover:bg-slate-900/40 transition-all duration-200">
                  <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                    <ShieldAlert className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs">Disabled Interactions</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">Copying, pasting, cut actions, and right-clicking are completely disabled.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl hover:border-slate-700/80 hover:bg-slate-900/40 transition-all duration-200">
                  <div className="p-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 shrink-0 mt-0.5">
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs">Automatic Termination</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">Exceeding {exam.warning_limit} security warnings terminates and submits the exam immediately.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-2 text-slate-400 border-t border-slate-800/60 font-semibold">
              <span className="flex items-center gap-1.5 bg-slate-950/30 px-3 py-2 border border-slate-800/40 rounded-lg"><Clock className="h-4 w-4 text-indigo-400" /> {exam.exam_duration_minutes ? `${exam.exam_duration_minutes} Mins` : 'Per-Question Timer'}</span>
              <span className="flex items-center gap-1.5 bg-slate-950/30 px-3 py-2 border border-slate-800/40 rounded-lg"><FileSpreadsheet className="h-4 w-4 text-indigo-400" /> {exam.total_marks} Marks / Pass {exam.passing_marks}</span>
            </div>

            <div 
              onClick={() => setAcknowledged(!acknowledged)}
              style={{ cursor: 'pointer' }}
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-300 select-none ${
                acknowledged 
                  ? 'bg-indigo-950/20 border-indigo-500/50 shadow-lg shadow-indigo-500/5' 
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/60'
              }`}
            >
              <div className="pt-0.5 shrink-0">
                <div className={`h-5 w-5 rounded border flex items-center justify-center transition-all duration-300 ${
                  acknowledged 
                    ? 'bg-indigo-600 border-indigo-500 text-white scale-105 shadow-md shadow-indigo-600/30' 
                    : 'border-slate-600 bg-slate-950 hover:border-indigo-400'
                }`}>
                  {acknowledged && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
              </div>
              <span className="text-[11px] md:text-xs text-slate-300 leading-relaxed font-semibold cursor-pointer">
                I acknowledge that I have read the guidelines and agree to comply with all proctoring rules.
              </span>
            </div>

          </CardContent>
          <CardFooter className="pt-1">
            <Button 
              onClick={handleStartExam} 
              disabled={!acknowledged}
              style={{ cursor: acknowledged ? 'pointer' : 'not-allowed' }}
              className={`group w-full text-white font-bold h-11 transition-all duration-300 flex items-center justify-center gap-2 rounded-xl select-none ${
                acknowledged 
                  ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:via-indigo-400 hover:to-violet-500 shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 cursor-pointer active:scale-[0.985] hover:scale-[1.015] border border-indigo-400/20' 
                  : 'bg-slate-800 border border-slate-700/50 text-slate-500 shadow-none cursor-not-allowed opacity-50'
              }`}
            >
              Acknowledge & Enter Exam
              <ArrowRight className={`h-4 w-4 transition-transform duration-300 ${acknowledged ? 'group-hover:translate-x-1' : ''}`} />
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
      <header className="sticky top-0 z-40 min-h-14 py-2 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 md:px-6 flex flex-wrap gap-3 items-center justify-between">
        {/* Dynamic overall or per-question timer & warnings count */}
        <div className="flex items-center gap-3">
          {timeRemaining !== null ? (
            <div className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/20 px-3 py-1.5 rounded-full text-indigo-400 text-sm md:text-base font-mono font-extrabold animate-pulse shadow-md">
              <Clock className="h-4 w-4 md:h-5 md:w-5" />
              {formatTimer()}
            </div>
          ) : qTimeRemaining !== null ? (
            <div className="flex items-center gap-2 bg-cyan-600/10 border border-cyan-500/20 px-3 py-1.5 rounded-full text-cyan-400 text-sm md:text-base font-mono font-extrabold animate-pulse shadow-md">
              <Clock className="h-4 w-4 md:h-5 md:w-5" />
              {qTimeRemaining}s
            </div>
          ) : null}

          {/* Warnings Count indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] md:text-xs font-bold ${
            warnings > 0 
              ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
              : 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20'
          }`}>
            <AlertTriangle className="h-3.5 w-3.5" />
            Warnings: {warnings}/{exam.warning_limit}
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-xs md:text-sm font-bold text-slate-200">{exam.title}</h2>
          <span className="text-[9px] md:text-[10px] text-slate-500">Question {currentQIndex + 1} of {questions.length}</span>
        </div>
      </header>

      {/* Main Question view Card */}
      <main className="flex-1 flex items-start justify-center p-4 md:p-8 overflow-y-auto pt-6 pb-16">
        <div className="w-full max-w-2xl space-y-4">
          
          {/* Question grid navigator (Interactive and responsive progress bar) */}
          <div className="bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl space-y-2.5">
            <div className="flex justify-between items-center text-xs text-slate-400 px-1">
              <span>Exam Navigation</span>
              <span className="font-semibold text-slate-300">
                {Object.keys(answers).length}/{questions.length} Answered
              </span>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentQIndex
                const isAnswered = !!answers[q.id]
                const canJump = exam?.allow_backtracking
                return (
                  <button
                    key={q.id}
                    disabled={!canJump}
                    onClick={async () => {
                      if (idx === currentQIndex) return
                      setIsNavigating(true)
                      const direction = idx > currentQIndex ? 'animate-slide-out-left' : 'animate-slide-out-right'
                      const incoming = idx > currentQIndex ? 'animate-slide-in-right' : 'animate-slide-in-left'
                      setAnimationClass(direction)
                      await new Promise(resolve => setTimeout(resolve, 250))
                      const currentQ = questions[currentQIndex]
                      if (currentQ) {
                        saveAnswerAndProgress(
                          attempt.id,
                          currentQ.id,
                          selectedOption,
                          idx,
                          timeRemaining
                        ).catch(err => console.error(err))
                      }
                      if (qTimeRemaining !== null) {
                        const targetQ = questions[idx]
                        setQTimeRemaining(targetQ?.time_limit || 30)
                      }
                      setCurrentQIndex(idx)
                      setSelectedOption(answers[q.id] || null)
                      setIsNavigating(false)
                      setAnimationClass(incoming)
                    }}
                    className={`min-w-[32px] h-8 rounded-lg text-xs font-bold border transition-all duration-200 ${
                      isCurrent
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 scale-105 shadow-indigo-600/20'
                        : isAnswered
                        ? 'bg-slate-800 border-indigo-500/30 text-indigo-400 hover:border-slate-700'
                        : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700'
                    } ${canJump ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-55'}`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Question progress indicator */}
          <Progress value={((currentQIndex + 1) / questions.length) * 100} className="h-1.5 bg-slate-900 transition-all duration-300" />
          
          {/* Animated Card Container */}
          <div className={`${animationClass} transition-all duration-200 relative`}>
            <Card className="relative border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 md:p-6 shadow-xl overflow-hidden">
              {isNavigating && (
                <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center animate-fade-in">
                  <Loader2 className="h-7 w-7 animate-spin text-indigo-400 mb-2" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider animate-pulse">Saving Progress...</span>
                </div>
              )}
              <CardHeader className="p-0 pb-4 border-b border-slate-800">
                <div className="flex justify-between items-start gap-4">
                  <CardTitle className="text-white text-sm md:text-base leading-relaxed font-semibold">
                    {currentQuestion.question_title}
                  </CardTitle>
                  <div className="flex flex-col items-end shrink-0 gap-1.5">
                    <Badge variant="outline" className="border-slate-800 text-slate-400 font-mono text-[9px] md:text-[10px]">
                      {currentQuestion.marks} pt(s)
                    </Badge>
                    
                    {/* Per question timer indicator */}
                    {qTimeRemaining !== null && (
                      <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/5 text-cyan-400 font-mono text-[10px] md:text-xs px-2 py-0.5">
                        {qTimeRemaining}s left
                      </Badge>
                    )}

                    {/* Overall timer indicator */}
                    {timeRemaining !== null && (
                      <Badge variant="outline" className="border-indigo-500/20 bg-indigo-500/5 text-indigo-400 font-mono text-[10px] md:text-xs px-2 py-0.5">
                        {formatTimer()} left
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 pt-6 space-y-3">
                {/* Options list with visual & tactile feedback */}
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
                      onClick={() => handleSelectOption(key)}
                      className={`w-full p-4 text-left rounded-xl border transition-all duration-200 text-xs md:text-sm font-medium flex items-center gap-3 active:scale-[0.985] hover:scale-[1.005] cursor-pointer ${
                        isSelected 
                          ? 'bg-gradient-to-r from-indigo-600/20 to-violet-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10 scale-[1.01] animate-pop-in'
                          : 'border-slate-800 bg-slate-950/40 hover:bg-slate-900/60 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className={`h-5 w-5 md:h-6 md:w-6 rounded-full flex items-center justify-center font-bold text-[10px] md:text-xs transition-colors duration-200 shrink-0 ${
                        isSelected 
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-900 border border-slate-800 text-slate-400'
                      }`}>
                        {key}
                      </span>
                      <span className="leading-relaxed">{optText}</span>
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
                    className="border-slate-800 text-slate-400 hover:text-white active:scale-95 transition-all text-xs h-9 md:h-10 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Previous
                  </Button>
                ) : (
                  <div /> // empty flex spacer
                )}

                {currentQIndex < questions.length - 1 ? (
                  <Button onClick={() => handleNextQuestion(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 px-4 md:px-5 active:scale-95 transition-all text-xs h-9 md:h-10 cursor-pointer">
                    Save & Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleManualSubmit} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white gap-1.5 px-5 md:px-6 shadow-lg shadow-emerald-600/10 active:scale-95 transition-all text-xs h-9 md:h-10 cursor-pointer" disabled={submitting}>
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
        </div>
      </main>

      {/* Mandatory Fullscreen Overlay guard if exited */}
      {!isFullscreen && !isSubmittingRef.current && !submitting && (
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

      {/* Custom Glassmorphic Submission Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in-up">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900/95 backdrop-blur-md p-6 shadow-2xl">
            <CardHeader className="text-center p-0 pb-4 border-b border-slate-800">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-3">
                <FileSpreadsheet className="h-6 w-6 text-emerald-500 animate-pulse" />
              </div>
              <CardTitle className="text-lg md:text-xl font-bold text-white">Submit Examination</CardTitle>
              <CardDescription className="text-slate-400 text-xs md:text-sm mt-1">Please confirm if you are ready to finalize your exam.</CardDescription>
            </CardHeader>
            
            <CardContent className="py-6 space-y-4">
              <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs md:text-sm">
                  <span className="text-slate-400">Total Questions:</span>
                  <span className="font-bold text-white">{questions.length}</span>
                </div>
                <div className="flex justify-between items-center text-xs md:text-sm">
                  <span className="text-slate-400">Answered Questions:</span>
                  <span className="font-bold text-emerald-400">
                    {Object.keys(answers).length}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs md:text-sm">
                  <span className="text-slate-400">Unanswered Questions:</span>
                  <span className={`font-bold ${
                    (questions.length - Object.keys(answers).length) > 0 ? 'text-amber-500' : 'text-slate-500'
                  }`}>
                    {questions.length - Object.keys(answers).length}
                  </span>
                </div>
              </div>
              
              <p className="text-[10px] md:text-xs text-slate-500 text-center leading-relaxed">
                Once submitted, you will not be able to modify your answers or re-enter the exam attempt.
              </p>
            </CardContent>
            
            <CardFooter className="p-0 pt-4 border-t border-slate-800 flex justify-end gap-3 items-center">
              {(questions.length - Object.keys(answers).length) > 0 && (
                <Button
                  onClick={() => {
                    const unansweredIndex = questions.findIndex(q => !answers[q.id])
                    if (unansweredIndex !== -1) {
                      isSubmittingRef.current = false
                      setShowSubmitConfirm(false)
                      
                      const direction = unansweredIndex > currentQIndex ? 'animate-slide-out-left' : 'animate-slide-out-right'
                      const incoming = unansweredIndex > currentQIndex ? 'animate-slide-in-right' : 'animate-slide-in-left'
                      
                      setAnimationClass(direction)
                      setTimeout(() => {
                        setCurrentQIndex(unansweredIndex)
                        setSelectedOption(answers[questions[unansweredIndex].id] || null)
                        setAnimationClass(incoming)
                      }, 200)
                    }
                  }}
                  className="bg-amber-600/10 border border-amber-500/20 text-amber-400 hover:bg-amber-600/20 active:scale-95 transition-all text-xs h-9 md:h-10 cursor-pointer mr-auto"
                  disabled={submitting}
                >
                  Review Skipped
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  isSubmittingRef.current = false
                  setShowSubmitConfirm(false)
                }}
                className="border-slate-800 text-slate-400 hover:text-white active:scale-95 transition-all text-xs h-9 md:h-10 cursor-pointer"
                disabled={submitting}
              >
                Go Back
              </Button>
              <Button
                onClick={executeSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 active:scale-95 transition-all text-xs h-9 md:h-10 cursor-pointer"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Confirm Submission'
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
