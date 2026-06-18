'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Award, Calendar, CheckCircle2, XCircle, FileDown, ArrowLeft, ShieldAlert, AlertTriangle } from 'lucide-react'
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'
import { getResultDetails } from '@/app/actions/exam-engine'

export default function StudentResultPage() {
  const params = useParams()
  const router = useRouter()
  const resultId = params.id as string
  const [downloadingCert, setDownloadingCert] = useState(false)
  const [downloadingMarksheet, setDownloadingMarksheet] = useState(false)

  // Ref for certificate rendering
  const certificateRef = useRef<HTMLDivElement>(null)
  const marksheetRef = useRef<HTMLDivElement>(null)

  // Fetch all Result details via server action to bypass student RLS on submitted questions/answers
  const { data, isLoading } = useQuery({
    queryKey: ['student-result-details-full', resultId],
    queryFn: async () => {
      const res = await getResultDetails(resultId)
      if (!res.success) throw new Error(res.error || 'Failed to fetch result details')
      return res
    }
  })

  const result = data?.result as any
  const examQuestions = data?.questions || []
  const studentAnswers = data?.answers || []

  // Certificate PDF download action (html2canvas + jspdf)
  const handleDownloadCertificate = async () => {
    if (!certificateRef.current) return
    setDownloadingCert(true)
    
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2, // high quality
        useCORS: true
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('l', 'mm', 'a4') // landscape A4
      const imgWidth = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save(`Luminous_Skill_Development_Training_Centre_Certificate_${result?.users?.full_name?.replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
      console.error('Certificate generation failed')
    } finally {
      setDownloadingCert(false)
    }
  }

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
      pdf.save(`Luminous_Skill_Development_Training_Centre_Marksheet_${result?.exams?.title?.replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
      console.error('Marksheet generation failed')
    } finally {
      setDownloadingMarksheet(false)
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
          <Button variant="ghost" size="icon" onClick={() => router.push('/student')} className="h-8 w-8 text-slate-400 hover:text-white rounded-full bg-slate-900/30 border border-slate-800">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="animated-gradient-text text-glow-indigo">Exam Result Review</span>
            </h1>
            <p className="text-sm text-slate-400">{result.exams?.title} ({result.exams?.subjects?.name})</p>
          </div>
        </div>

        <div className="flex gap-2.5">
          <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-900 gap-2 hover:border-slate-600 transition-all rounded-lg" onClick={handleDownloadMarksheet} disabled={downloadingMarksheet}>
            {downloadingMarksheet ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Download Marksheet PDF
          </Button>
          <Button onClick={handleDownloadCertificate} className="animated-gradient-btn text-slate-950 font-bold gap-2 shadow-md rounded-lg" disabled={downloadingCert}>
            {downloadingCert ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Award className="h-4 w-4" />
            )}
            Download Certificate
          </Button>
        </div>
      </div>

      {result.exam_attempts?.status === 'auto_submitted' && (
        <Card className="border-red-500/30 bg-red-500/10 text-red-200 p-5 rounded-xl flex items-start gap-3.5 shadow-lg shadow-red-950/20">
          <ShieldAlert className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-red-400 text-sm tracking-wide">EXAMINATION TERMINATED (AUTO SUBMITTED)</h4>
            <p className="text-xs text-red-300/90 leading-relaxed">
              Your exam session was automatically terminated and submitted because you exceeded the warning limit. This attempt has been logged and flagged for security/proctoring violations.
            </p>
          </div>
        </Card>
      )}

      {/* MARKSHEET CONTAINER (This div will be downloaded as PDF) */}
      <div ref={marksheetRef} className="bg-slate-950 p-6 rounded-xl border border-slate-800/80 space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">Luminous Tech</h2>
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
                        <strong>Not Answered (উত্তর দেওয়া হয়নি)</strong> — You did not select any option for this question. The correct answer is highlighted in green below.
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
                            <XCircle className="h-3 w-3" /> Your Choice
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

      {/* CERTIFICATE SOURCE LAYOUT (Hidden from view, positioned absolutely far away) */}
      <div className="absolute left-[-9999px] top-[-9999px]">
        <div 
          ref={certificateRef}
          className="w-[1000px] h-[700px] bg-gradient-to-br from-[#fffdf9] via-[#fdfaf2] to-[#faf4e5] text-[#2d3748] p-12 border-[16px] border-[#0f2a4a] flex flex-col justify-between relative"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {/* Background design elements */}
          <div className="absolute inset-0 border-4 border-[#c5a059]/30 m-2 pointer-events-none" />
          <div className="absolute top-0 right-0 h-40 w-40 border-t border-r border-[#c5a059]/50 m-6" />
          <div className="absolute bottom-0 left-0 h-40 w-40 border-b border-l border-[#c5a059]/50 m-6" />

          {/* Watermark Logo / Background Pattern */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none">
            <img src="/logo.jpg" alt="Watermark Logo" className="w-[300px] h-[300px] rounded-full object-cover grayscale" />
          </div>

          {/* Logo and Institution Header */}
          <div className="text-center space-y-2 pt-6">
            <img src="/logo.jpg" alt="Logo" className="mx-auto h-24 w-24 rounded-full border-2 border-[#c5a059]/40 object-cover shadow-lg shadow-[#c5a059]/10 mb-2" />
            <h1 className="text-2xl font-black tracking-widest text-[#0f2a4a] uppercase font-sans">
              Luminous Skill Development Training Centre
            </h1>
            <p className="text-[11px] tracking-[0.25em] text-[#c5a059] font-sans uppercase font-extrabold">
              {result.is_passed ? 'Certificate of Achievement' : 'Official Examination Report'}
            </p>
          </div>

          {/* Recipient and Main Text */}
          <div className="text-center space-y-4">
            <p className="text-slate-500 italic text-sm font-sans">This document is proudly presented to</p>
            <h2 className="text-4xl font-bold text-[#0f2a4a] tracking-wide underline decoration-[#c5a059] decoration-2 underline-offset-8">
              {result.users?.full_name}
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed text-sm font-sans px-8">
              for participating in and completing the online examination of <strong className="text-slate-900 font-semibold">{result.exams?.title}</strong> in the subject course <strong className="text-slate-900 font-semibold">{result.exams?.subjects?.name}</strong>.
            </p>
          </div>

          {/* Marks and Percentage Details Grid */}
          <div className="max-w-md mx-auto w-full bg-[#f4f1ea] border border-[#e2dcd0] rounded-xl p-4 grid grid-cols-3 gap-4 text-center font-sans">
            <div>
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Marks Obtained</span>
              <span className="text-sm font-bold text-[#0f2a4a] font-mono mt-1 block">
                {result.obtained_marks} / {result.total_marks}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Percentage</span>
              <span className="text-sm font-bold text-[#0f2a4a] font-mono mt-1 block">
                {result.percentage}%
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Exam Status</span>
              <span className={`text-xs font-bold uppercase mt-1.5 inline-block px-2.5 py-0.5 rounded-full border ${
                result.is_passed 
                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-700 border-red-500/20'
              }`}>
                {result.is_passed ? 'PASSED' : 'FAILED'}
              </span>
            </div>
          </div>

          {/* Footer Signatures */}
          <div className="flex justify-between items-end border-t border-[#e2dcd0] pt-6 font-sans">
            <div className="text-left space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Date Issued</span>
              <span className="text-xs font-semibold text-slate-800">{new Date(result.created_at).toLocaleDateString()}</span>
            </div>
            <div className="text-center space-y-1">
              <Badge className="bg-[#c5a059]/10 text-[#a37f3d] border border-[#c5a059]/20 text-xs uppercase font-bold tracking-wider rounded-md">
                VERIFIED RECORD
              </Badge>
            </div>
            <div className="text-right space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Authority Signature</span>
              <span className="text-xs font-semibold text-[#0f2a4a] italic">Luminous Tech Admin</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
