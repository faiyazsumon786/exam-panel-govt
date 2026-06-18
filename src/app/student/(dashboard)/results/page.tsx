'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  Award,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  FileText,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react'

export default function StudentResultsPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'fail'>('all')

  // Fetch student exam results history
  const { data: rawExamHistory = [], isLoading } = useQuery({
    queryKey: ['student-results-history-page', profile?.id],
    queryFn: async () => {
      if (!profile) return []
      const { data, error } = await supabase
        .from('results')
        .select(`
          *,
          exams (
            title, 
            passing_marks,
            total_marks,
            subjects (name)
          ),
          exam_attempts:attempt_id (warnings_count, status)
        `)
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false }) as any

      if (error) throw error
      return data || []
    },
    enabled: !!profile
  })
  const examHistory = rawExamHistory as any[]

  // Filter history
  const filteredHistory = examHistory.filter((res) => {
    const matchesSearch = 
      res.exams?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.exams?.subjects?.name?.toLowerCase().includes(searchQuery.toLowerCase())

    const isPassed = res.score_obtained >= (res.exams?.passing_marks || 0)
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'pass' && isPassed) ||
      (statusFilter === 'fail' && !isPassed)

    return matchesSearch && matchesStatus
  })

  // Calculations
  const totalExams = examHistory.length
  const passedExams = examHistory.filter(
    (res) => res.score_obtained >= (res.exams?.passing_marks || 0)
  ).length
  const failedExams = totalExams - passedExams
  const averagePercentage = totalExams > 0 
    ? Math.round(examHistory.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / totalExams)
    : 0
  const totalWarnings = examHistory.reduce((acc, curr) => acc + (curr.exam_attempts?.warnings_count || 0), 0)

  if (isLoading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span>Loading your result transcripts...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6 text-indigo-500" />
          My Exam Results & History
        </h1>
        <p className="text-sm text-slate-400">Access performance reports, marksheet transcripts, and printable certificates.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-500 uppercase font-semibold">Exams Taken</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-white font-mono">{totalExams}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-500 uppercase font-semibold">Exams Passed</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-emerald-400 font-mono">
              {passedExams} <span className="text-sm text-slate-500 font-normal">({totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0}%)</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-500 uppercase font-semibold">Average Accuracy</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-indigo-400 font-mono">{averagePercentage}%</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-500 uppercase font-semibold">Security Warnings</CardDescription>
            <CardTitle className={`text-3xl font-extrabold font-mono ${totalWarnings > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
              {totalWarnings}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by Exam or Subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-800 text-white placeholder-slate-500 focus-visible:ring-indigo-500 h-9"
          />
        </div>
        <div className="flex gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${statusFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('pass')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${statusFilter === 'pass' ? 'bg-emerald-600/20 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            Passed
          </button>
          <button
            onClick={() => setStatusFilter('fail')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${statusFilter === 'fail' ? 'bg-red-600/20 text-red-400 shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            Failed
          </button>
        </div>
      </div>

      {/* Results List */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-0">
          {filteredHistory.length === 0 ? (
            <div className="text-center p-16 text-slate-500 space-y-2">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-700" />
              <p>No results records matched your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="text-slate-400">Exam Title</TableHead>
                    <TableHead className="text-slate-400">Subject</TableHead>
                    <TableHead className="text-slate-400">Date Taken</TableHead>
                    <TableHead className="text-slate-400 text-center">Score</TableHead>
                    <TableHead className="text-slate-400 text-center">Percentage</TableHead>
                    <TableHead className="text-slate-400 text-center">Warnings</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((res) => {
                    const isPassed = res.score_obtained >= (res.exams?.passing_marks || 0)
                    return (
                      <TableRow key={res.id} className="border-b border-slate-800/60 hover:bg-slate-900/30">
                        <TableCell className="font-semibold text-white max-w-[200px] truncate">
                          {res.exams?.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-indigo-500/20 bg-indigo-500/5 text-indigo-400">
                            {res.exams?.subjects?.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300 text-xs">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                            {new Date(res.created_at).toLocaleDateString()} {new Date(res.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-slate-300 font-mono text-sm">
                          {res.score_obtained} / <span className="text-slate-500 text-xs">{res.exams?.total_marks || 0}</span>
                        </TableCell>
                        <TableCell className="text-center font-semibold text-white font-mono">
                          {res.percentage}%
                        </TableCell>
                        <TableCell className="text-center">
                          {res.exam_attempts?.warnings_count > 0 ? (
                            <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold gap-1 font-mono text-xs">
                              <AlertTriangle className="h-3 w-3" />
                              {res.exam_attempts?.warnings_count}
                            </Badge>
                          ) : (
                            <span className="text-slate-500 font-mono text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPassed ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Passed
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 font-bold gap-1">
                              <XCircle className="h-3.5 w-3.5" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => router.push(`/student/result/${res.id}`)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 h-8"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            View Transcript
                          </Button>
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
    </div>
  )
}
