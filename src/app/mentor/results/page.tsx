'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { resetStudentAttempt } from '@/app/actions/student-admin'
import { getResultDetails } from '@/app/actions/exam-engine'
import { toast } from 'sonner'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Loader2, RefreshCw, Award, Filter, ShieldAlert, CheckSquare, CheckCircle2, XCircle, FileDown, AlertTriangle } from 'lucide-react'
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'

export default function MentorResultsPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Filters
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')
  const [selectedExamId, setSelectedExamId] = useState<string>('all')

  // Popup detailed review state
  const [selectedResultIdForReview, setSelectedResultIdForReview] = useState<string | null>(null)
  const [downloadingMarksheet, setDownloadingMarksheet] = useState(false)
  const [resetting, setResetting] = useState(false)
  const marksheetRef = useRef<HTMLDivElement>(null)

  // 4. Fetch selected Result details for popup review
  const { data: reviewDetails, isLoading: loadingReviewDetails } = useQuery({
    queryKey: ['mentor-student-result-details-popup', selectedResultIdForReview],
    queryFn: async () => {
      if (!selectedResultIdForReview) return null
      const res = await getResultDetails(selectedResultIdForReview)
      if (!res.success) throw new Error(res.error || 'Failed to fetch result details')
      return res
    },
    enabled: !!selectedResultIdForReview
  })

  // Handlers for popup actions
  const handleDownloadMarksheet = async () => {
    if (!marksheetRef.current) return
    setDownloadingMarksheet(true)
    try {
      const canvas = await html2canvas(marksheetRef.current, {
        scale: 2,
        useCORS: true
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      const examTitle = (reviewDetails?.result as any)?.exams?.title?.replace(' ', '_') || 'exam'
      pdf.save(`SH_TECH_ZONE_Marksheet_${examTitle}.pdf`)
    } catch (err) {
      console.error('Marksheet generation failed')
    } finally {
      setDownloadingMarksheet(false)
    }
  }

  const handleResetAttempt = async () => {
    const resultObj = reviewDetails?.result as any
    if (!resultObj) return
    if (!confirm('Are you sure you want to reset this attempt? This student\'s answers and score will be deleted immediately, allowing them to retake the exam from scratch.')) return

    setResetting(true)
    try {
      const res = await resetStudentAttempt(resultObj.student_id, resultObj.exam_id)
      if (res.success) {
        toast.success('Attempt reset successfully!')
        setSelectedResultIdForReview(null)
        queryClient.invalidateQueries({ queryKey: ['mentor-exams-results'] })
      } else {
        toast.error(res.error || 'Failed to reset attempt')
      }
    } catch (err) {
      toast.error('An unexpected error occurred during reset.')
    } finally {
      setResetting(false)
    }
  }

  // 1. Fetch mentor assigned subjects
  const { data: mentorSubjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['mentor-results-subjects', profile?.id],
    queryFn: async () => {
      if (!profile) return []
      const { data, error } = await supabase
        .from('mentor_subjects')
        .select('subject_id, subjects(name)')
        .eq('mentor_id', profile.id)

      if (error) throw error
      return data || []
    },
    enabled: !!profile
  })

  // 2. Fetch exams in mentor assigned subjects
  const { data: mentorExams = [] } = useQuery({
    queryKey: ['mentor-results-exams', mentorSubjects],
    queryFn: async () => {
      if (mentorSubjects.length === 0) return []
      const subjectIds = mentorSubjects.map((s: any) => s.subject_id)
      const { data, error } = await supabase
        .from('exams')
        .select('id, title, subject_id')
        .in('subject_id', subjectIds)

      if (error) throw error
      return data || []
    },
    enabled: mentorSubjects.length > 0
  })

  // 3. Fetch results of exams (or attempts)
  const { data: results = [], isLoading: loadingResults } = useQuery({
    queryKey: ['mentor-exams-results', selectedSubjectId, selectedExamId, mentorSubjects],
    queryFn: async () => {
      if (mentorSubjects.length === 0) return []
      
      // Get exam IDs
      let examIds = mentorExams.map((e: any) => e.id)
      if (selectedExamId !== 'all') {
        examIds = [selectedExamId]
      } else if (selectedSubjectId !== 'all') {
        examIds = mentorExams.filter((e: any) => e.subject_id === selectedSubjectId).map((e: any) => e.id)
      }

      if (examIds.length === 0) return []

      const { data, error } = await supabase
        .from('results')
        .select(`
          *,
          users:student_id (full_name, email),
          exams:exam_id (title, passing_marks, subject_id, subjects(name)),
          exam_attempts:attempt_id (warnings_count, status)
        `)
        .in('exam_id', examIds)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: mentorExams.length > 0
  })

  // Handle Reset Attempt
  const handleReset = async (studentId: string, examId: string) => {
    if (!confirm('Are you sure you want to reset this attempt? The student results and answers will be permanently deleted, allowing them a fresh retake.')) return
    
    try {
      const res = await resetStudentAttempt(studentId, examId)
      if (res.success) {
        toast.success('Attempt reset successfully!')
        queryClient.invalidateQueries({ queryKey: ['mentor-exams-results'] })
      } else {
        toast.error(res.error || 'Failed to reset attempt')
      }
    } catch (err) {
      toast.error('Error occurred during reset')
    }
  }

  // Filter exams options based on subject selection
  const filteredExamsOptions = mentorExams.filter((e: any) => 
    selectedSubjectId === 'all' || e.subject_id === selectedSubjectId
  )

  const isLoading = loadingSubjects || loadingResults

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="h-6 w-6 text-indigo-500" />
            Student Exam Performance
          </h1>
          <p className="text-sm text-slate-400">View obtained scores, check proctored cheating alerts, and reset student exam attempts.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedSubjectId}
              onChange={(e) => { setSelectedSubjectId(e.target.value); setSelectedExamId('all'); }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500 w-full sm:w-48"
            >
              <option value="all">All Subjects</option>
              {mentorSubjects.map((s: any) => (
                <option key={s.subject_id} value={s.subject_id}>{s.subjects?.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500 w-full sm:w-56"
            >
              <option value="all">All Exams</option>
              {filteredExamsOptions.map((e: any) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Results Table */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Compiling examination results...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center p-16 text-slate-500">
              No exam results recorded for the selected scope.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="text-slate-400">Student</TableHead>
                    <TableHead className="text-slate-400">Exam</TableHead>
                    <TableHead className="text-slate-400">Subject</TableHead>
                    <TableHead className="text-slate-400 text-center">Score</TableHead>
                    <TableHead className="text-slate-400 text-center">Percentage</TableHead>
                    <TableHead className="text-slate-400 text-center">Warnings</TableHead>
                    <TableHead className="text-slate-400 text-center">Outcome</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((res: any) => (
                    <TableRow key={res.id} className="border-b border-slate-800/60 hover:bg-slate-900/30">
                      <TableCell className="font-semibold text-white">
                        <div className="flex flex-col">
                          <span>{res.users?.full_name}</span>
                          <span className="text-[10px] text-slate-500 font-normal">{res.users?.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300 font-semibold">{res.exams?.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-indigo-500/20 bg-indigo-500/5 text-indigo-400 text-[10px]">
                          {res.exams?.subjects?.name || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-bold font-mono text-slate-300">
                        {res.obtained_marks} / {res.total_marks}
                      </TableCell>
                      <TableCell className="text-center font-bold font-mono text-slate-300">{res.percentage}%</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                           variant="outline" 
                           className={
                            res.exam_attempts?.warnings_count > 0 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20 font-bold'
                              : 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/20'
                          }
                        >
                          {res.exam_attempts?.warnings_count || 0} Alerts
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={res.is_passed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}>
                          {res.is_passed ? 'Passed' : 'Failed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedResultIdForReview(res.id)}
                            className="h-8 border-indigo-500/20 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 text-[11px] font-semibold"
                          >
                            View Review
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleReset(res.student_id, res.exam_id)}
                            className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                            title="Reset attempt"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Result Review Dialog */}
      <Dialog 
        open={!!selectedResultIdForReview} 
        onOpenChange={(open) => !open && setSelectedResultIdForReview(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-slate-800 bg-slate-950 text-white p-6">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-xl font-bold flex items-center justify-between gap-4">
              <span className="animated-gradient-text text-glow-indigo">Student Result Review</span>
              {reviewDetails?.result && (
                <div className="flex gap-2 mr-6">
                  <Button 
                    variant="outline" 
                    onClick={handleDownloadMarksheet} 
                    disabled={downloadingMarksheet}
                    className="border-slate-800 text-slate-300 hover:bg-slate-900 gap-2 hover:border-slate-600 transition-all rounded-lg text-xs h-8"
                  >
                    {downloadingMarksheet ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" />
                    )}
                    Download Marksheet
                  </Button>
                  <Button 
                    onClick={handleResetAttempt} 
                    disabled={resetting} 
                    className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 shadow-md rounded-lg shadow-red-900/10 text-xs h-8"
                  >
                    {resetting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Reset & Allow Retake
                  </Button>
                </div>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              {reviewDetails?.result ? (
                <>
                  Reviewing: <strong>{(reviewDetails.result as any).users?.full_name}</strong> - {(reviewDetails.result as any).exams?.title}
                </>
              ) : (
                "Loading review details..."
              )}
            </DialogDescription>
          </DialogHeader>

          {loadingReviewDetails ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Fetching student answers and scorecards...</span>
            </div>
          ) : !reviewDetails?.result ? (
            <div className="text-center p-8 text-slate-500">
              Could not load result details.
            </div>
          ) : (
            <div ref={marksheetRef} className="space-y-6 pt-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">Luminous Tech</h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">Online Examination</p>
                </div>
                <Badge className={(reviewDetails.result as any).is_passed 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] py-1 px-3' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)] py-1 px-3'
                }>
                  {(reviewDetails.result as any).is_passed ? 'Passed' : 'Failed'}
                </Badge>
              </div>

              {/* Scorecard Grid Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Card className="glow-card border-slate-800 bg-slate-900/60 text-center p-2.5 rounded-lg">
                  <CardHeader className="p-0 pb-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Total Questions</span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="text-base font-bold text-white font-mono">{(reviewDetails.result as any).total_questions}</div>
                  </CardContent>
                </Card>
                <Card className="glow-card-green border-slate-800 bg-slate-900/60 text-center p-2.5 rounded-lg">
                  <CardHeader className="p-0 pb-1">
                    <span className="text-[9px] uppercase font-bold text-emerald-500/80">Correct Answers</span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="text-base font-bold text-emerald-400 font-mono text-glow-cyan">{(reviewDetails.result as any).correct_answers}</div>
                  </CardContent>
                </Card>
                <Card className="glow-card-red border-slate-800 bg-slate-900/60 text-center p-2.5 rounded-lg">
                  <CardHeader className="p-0 pb-1">
                    <span className="text-[9px] uppercase font-bold text-red-500/80">Wrong Answers</span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="text-base font-bold text-red-400 font-mono">{(reviewDetails.result as any).wrong_answers}</div>
                  </CardContent>
                </Card>
                <Card className="glow-card border-slate-800 bg-slate-900/60 text-center p-2.5 rounded-lg">
                  <CardHeader className="p-0 pb-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Skipped Qs</span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="text-base font-bold text-slate-500 font-mono">{(reviewDetails.result as any).skipped_questions}</div>
                  </CardContent>
                </Card>
                <Card className="glow-card border-slate-800 bg-slate-900/60 text-center p-2.5 rounded-lg">
                  <CardHeader className="p-0 pb-1">
                    <span className="text-[9px] uppercase font-bold text-white">Score Obtained</span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="text-base font-bold text-white font-mono">{(reviewDetails.result as any).obtained_marks} / {(reviewDetails.result as any).total_marks}</div>
                  </CardContent>
                </Card>
                <Card className="glow-card border-slate-800 bg-slate-900/60 text-center p-2.5 rounded-lg">
                  <CardHeader className="p-0 pb-1">
                    <span className="text-[9px] uppercase font-bold text-indigo-400">Percentage</span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="text-base font-bold text-indigo-400 font-mono text-glow-indigo">{(reviewDetails.result as any).percentage}%</div>
                  </CardContent>
                </Card>
              </div>

              {/* Proctoring info */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/30 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-indigo-400" />
                  Security Proctoring Alerts warnings: <strong>{(reviewDetails.result as any).exam_attempts?.warnings_count || 0} Alerts</strong>
                </span>
                <span>Attempt Status: <strong className="uppercase">{(reviewDetails.result as any).exam_attempts?.status}</strong></span>
              </div>

              {/* Detailed Review Section */}
              <div className="space-y-4">
                <h3 className="text-white font-bold text-xs tracking-wide">Question Review & Feedback</h3>
                <div className="space-y-4">
                  {(reviewDetails.questions || []).map((q: any, idx: number) => {
                    const studentAnswers = reviewDetails.answers || []
                    const answersMap = new Map(studentAnswers.map((a: any) => [a.question_id, a]))
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
                      <div key={q.id} className={`p-4 rounded-xl border transition-all duration-300 ${
                        isCorrect === true 
                          ? 'border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.04)]' 
                          : isCorrect === false
                          ? 'border-red-500/20 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.04)]'
                          : 'border-amber-500/15 bg-amber-500/2 shadow-[0_0_15px_rgba(245,158,11,0.02)]'
                      } space-y-3`}>
                        <div className="flex justify-between items-start gap-4">
                          <h4 className="text-xs font-bold text-slate-200 leading-snug">
                            Q{idx + 1}: {q.question_title}
                          </h4>
                          <Badge variant="outline" className={
                            isCorrect === true 
                              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[9px] py-0.5 px-2 font-semibold' 
                              : isCorrect === false
                              ? 'border-red-500/20 bg-red-500/5 text-red-400 text-[9px] py-0.5 px-2 font-semibold'
                              : 'border-amber-500/20 bg-amber-500/5 text-amber-400 text-[9px] py-0.5 px-2 font-semibold'
                          }>
                            {isCorrect === true ? 'Correct' : isCorrect === false ? 'Incorrect' : 'Not Answered / Unanswered'}
                          </Badge>
                        </div>

                        {selected === null && (
                          <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300 text-[11px] flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <div>
                              <strong>Not Answered (উত্তর দেওয়া হয়নি)</strong> — The student did not select any option for this question. The correct answer is highlighted in green below.
                            </div>
                          </div>
                        )}

                        {/* Options List */}
                        <div className="grid grid-cols-1 gap-1.5 pt-1">
                          {options.map((opt) => {
                            const isSelected = selected === opt.key
                            const isCorrectOpt = correct === opt.key
                            
                            let optionStyle = "border-slate-800 bg-slate-950/40 text-slate-300"
                            let badge = null

                            if (isCorrectOpt) {
                              optionStyle = "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-semibold shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                              badge = (
                                <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                                  <CheckCircle2 className="h-3 w-3" /> Correct Answer
                                </span>
                              )
                            } else if (isSelected) {
                              optionStyle = "border-red-500/40 bg-red-500/15 text-red-300 font-semibold shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                              badge = (
                                <span className="flex items-center gap-1 text-[9px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/25 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.1)]">
                                  <XCircle className="h-3 w-3" /> Student's Choice
                                </span>
                              )
                            }

                            return (
                              <div
                                key={opt.key}
                                className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border text-xs transition-all duration-200 ${optionStyle}`}
                              >
                                <div className="flex items-start gap-2">
                                  <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                                    isCorrectOpt 
                                      ? 'bg-emerald-500 text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
