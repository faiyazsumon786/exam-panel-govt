'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Award, Calendar, CheckCircle2, XCircle, FileDown, ArrowLeft, ShieldAlert, RefreshCw, AlertTriangle } from 'lucide-react'
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'
import { getResultDetails } from '@/app/actions/exam-engine'
import { resetStudentAttempt } from '@/app/actions/student-admin'
import { toast } from 'sonner'

export default function MentorResultDetailPage() {
  const params = useParams()
  const router = useRouter()
  const resultId = params.id as string
  const [downloadingCert, setDownloadingCert] = useState(false)
  const [downloadingMarksheet, setDownloadingMarksheet] = useState(false)
  const [resetting, setResetting] = useState(false)

  const marksheetRef = useRef<HTMLDivElement>(null)

  // Fetch all Result details via server action (secure bypass of RLS on submitted questions/answers)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mentor-student-result-details', resultId],
    queryFn: async () => {
      const res = await getResultDetails(resultId)
      if (!res.success) throw new Error(res.error || 'Failed to fetch result details')
      return res
    }
  })

  const result = data?.result as any
  const examQuestions = data?.questions || []
  const studentAnswers = data?.answers || []

  // Marksheet PDF download action
  const handleDownloadMarksheet = async () => {
    if (!marksheetRef.current) return
    setDownloadingMarksheet(true)
    
    try {
      const canvas = await html2canvas(marksheetRef.current, {
        scale: 2,
        useCORS: true
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4') // portrait A4
      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save(`SH_TECH_ZONE_Marksheet_${result?.exams?.title?.replace(' ', '_')}.pdf`)
    } catch (err) {
      console.error('Marksheet generation failed')
    } finally {
      setDownloadingMarksheet(false)
    }
  }

  // Handle Reset Attempt
  const handleResetAttempt = async () => {
    if (!result) return
    if (!confirm('Are you sure you want to reset this attempt? This student\'s answers and score will be deleted immediately, allowing them to retake the exam from scratch.')) return

    setResetting(true)
    try {
      const res = await resetStudentAttempt(result.student_id, result.exam_id)
      if (res.success) {
        toast.success('Attempt reset successfully!')
        router.push('/mentor/results')
      } else {
        toast.error(res.error || 'Failed to reset attempt')
      }
    } catch (err) {
      toast.error('An unexpected error occurred during reset.')
    } finally {
      setResetting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!result) return <div className="text-white text-center p-12">Result record not resolved.</div>

  const answersMap = new Map(studentAnswers.map((a: any) => [a.question_id, a]))

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/mentor/results')} className="h-8 w-8 text-slate-400 hover:text-white rounded-full bg-slate-900/30 border border-slate-800">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="animated-gradient-text text-glow-indigo">Student Result Review</span>
            </h1>
            <p className="text-sm text-slate-400">
              Reviewing: <strong>{result.users?.full_name}</strong> - {result.exams?.title}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5">
          <Button 
            variant="outline" 
            onClick={handleDownloadMarksheet} 
            disabled={downloadingMarksheet}
            className="border-slate-800 text-slate-300 hover:bg-slate-900 gap-2 hover:border-slate-600 transition-all rounded-lg"
          >
            {downloadingMarksheet ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Download Marksheet
          </Button>

          <Button 
            onClick={handleResetAttempt} 
            disabled={resetting} 
            className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 shadow-md rounded-lg shadow-red-900/10"
          >
            {resetting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Reset & Allow Retake
          </Button>
        </div>
      </div>

      {/* MARKSHEET CONTAINER */}
      <div ref={marksheetRef} className="bg-slate-950 p-6 rounded-xl border border-slate-800/80 space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">Luminous Tech</h2>
            <p className="text-xs text-slate-500 mt-0.5">Online Examination</p>
          </div>
          <Badge className={result.is_passed 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] py-1 px-3' 
            : 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)] py-1 px-3'
          }>
            {result.is_passed ? 'Passed' : 'Failed'}
          </Badge>
        </div>

        {/* Scorecard Grid Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="glow-card border-slate-800 bg-slate-900/60 text-center p-3 rounded-lg">
            <CardHeader className="p-0 pb-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">Total Questions</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-lg font-bold text-white font-mono">{result.total_questions}</div>
            </CardContent>
          </Card>
          <Card className="glow-card-green border-slate-800 bg-slate-900/60 text-center p-3 rounded-lg">
            <CardHeader className="p-0 pb-1">
              <span className="text-[10px] uppercase font-bold text-emerald-500/80">Correct Answers</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-lg font-bold text-emerald-400 font-mono text-glow-cyan">{result.correct_answers}</div>
            </CardContent>
          </Card>
          <Card className="glow-card-red border-slate-800 bg-slate-900/60 text-center p-3 rounded-lg">
            <CardHeader className="p-0 pb-1">
              <span className="text-[10px] uppercase font-bold text-red-500/80">Wrong Answers</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-lg font-bold text-red-400 font-mono">{result.wrong_answers}</div>
            </CardContent>
          </Card>
          <Card className="glow-card border-slate-800 bg-slate-900/60 text-center p-3 rounded-lg">
            <CardHeader className="p-0 pb-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">Skipped Qs</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-lg font-bold text-slate-500 font-mono">{result.skipped_questions}</div>
            </CardContent>
          </Card>
          <Card className="glow-card border-slate-800 bg-slate-900/60 text-center p-3 rounded-lg">
            <CardHeader className="p-0 pb-1">
              <span className="text-[10px] uppercase font-bold text-white">Score Obtained</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-lg font-bold text-white font-mono">{result.obtained_marks} / {result.total_marks}</div>
            </CardContent>
          </Card>
          <Card className="glow-card border-slate-800 bg-slate-900/60 text-center p-3 rounded-lg">
            <CardHeader className="p-0 pb-1">
              <span className="text-[10px] uppercase font-bold text-indigo-400">Percentage</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-lg font-bold text-indigo-400 font-mono text-glow-indigo">{result.percentage}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Proctoring info */}
        <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/30 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-indigo-400" />
            Security Proctoring Alerts warnings: <strong>{result.exam_attempts?.warnings_count || 0} Alerts</strong>
          </span>
          <span>Attempt Status: <strong className="uppercase">{result.exam_attempts?.status}</strong></span>
        </div>

        {/* Detailed Review Section */}
        <div className="space-y-4">
          <h3 className="text-white font-bold text-sm tracking-wide">Question Review & Feedback</h3>
          <div className="space-y-4">
            {examQuestions.map((q: any, idx: number) => {
              const ansObj = answersMap.get(q.id) as any
              const selected = ansObj?.selected_option || null
              const correct = q.correct_answer
              const isCorrect = ansObj?.is_correct

              const options = [
                { key: 'A', text: q.option_a },
                { key: 'B', text: q.option_b },
                { key: 'C', text: q.option_c },
                { key: 'D', text: q.option_d },
              ].filter(opt => opt.text)

              return (
                <div key={q.id} className={`p-5 rounded-xl border transition-all duration-300 ${
                  isCorrect === true 
                    ? 'border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.04)] hover:border-emerald-500/40' 
                    : isCorrect === false
                    ? 'border-red-500/20 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.04)] hover:border-red-500/40'
                    : 'border-amber-500/15 bg-amber-500/2 shadow-[0_0_15px_rgba(245,158,11,0.02)] hover:border-amber-500/30'
                } space-y-4`}>
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="text-sm font-bold text-slate-200 leading-snug">
                      Q{idx + 1}: {q.question_title}
                    </h4>
                    <Badge variant="outline" className={
                      isCorrect === true 
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[10px] py-0.5 px-2 shadow-[0_0_10px_rgba(16,185,129,0.1)] font-semibold' 
                        : isCorrect === false
                        ? 'border-red-500/20 bg-red-500/5 text-red-400 text-[10px] py-0.5 px-2 shadow-[0_0_10px_rgba(239,68,68,0.1)] font-semibold'
                        : 'border-amber-500/20 bg-amber-500/5 text-amber-400 text-[10px] py-0.5 px-2 shadow-[0_0_10px_rgba(245,158,11,0.1)] font-semibold'
                    }>
                      {isCorrect === true ? 'Correct' : isCorrect === false ? 'Incorrect' : 'Not Answered / Unanswered'}
                    </Badge>
                  </div>

                  {selected === null && (
                    <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      <div>
                        <strong>Not Answered (উত্তর দেওয়া হয়নি)</strong> — The student did not select any option for this question. The correct answer is highlighted in green below.
                      </div>
                    </div>
                  )}

                  {/* Options List */}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {options.map((opt) => {
                      const isSelected = selected === opt.key
                      const isCorrectOpt = correct === opt.key
                      
                      let optionStyle = "border-slate-800 bg-slate-950/40 text-slate-300"
                      let badge = null

                      if (isCorrectOpt) {
                        optionStyle = "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-semibold shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                        badge = (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                            <CheckCircle2 className="h-3 w-3" /> Correct Answer
                          </span>
                        )
                      } else if (isSelected) {
                        optionStyle = "border-red-500/40 bg-red-500/15 text-red-300 font-semibold shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                        badge = (
                          <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/25 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.1)]">
                            <XCircle className="h-3 w-3" /> Student's Choice
                          </span>
                        )
                      }

                      return (
                        <div
                          key={opt.key}
                          className={`flex items-center justify-between gap-3 p-3 rounded-lg border text-xs transition-all duration-200 ${optionStyle}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                              isCorrectOpt 
                                ? 'bg-emerald-500 text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse' 
                                : isSelected 
                                ? 'bg-red-500 text-slate-950 shadow-[0_0_8px_rgba(239,68,68,0.4)]' 
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {opt.key}
                            </span>
                            <span className="leading-relaxed">{opt.text}</span>
                          </div>
                          {badge}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
