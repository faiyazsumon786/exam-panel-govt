'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, BookOpen, Star, Loader2, Award, ArrowUp } from 'lucide-react'

export default function AdminAnalyticsPage() {
  const supabase = createClient()
  const [subjectId, setSubjectId] = useState<string>('all')

  // Fetch subjects
  const { data: subjects = [] as any[] } = useQuery({
    queryKey: ['admin-leaderboard-subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('*').order('name', { ascending: true })
      if (error) throw error
      return data || []
    }
  })

  // Fetch leaderboard data
  const { data: leaderboard = [] as any[], isLoading } = useQuery({
    queryKey: ['admin-leaderboard', subjectId],
    queryFn: async () => {
      let query = supabase
        .from('results')
        .select(`
          student_id,
          obtained_marks,
          percentage,
          is_passed,
          users:student_id (full_name, email),
          exams:exam_id (title, subject_id)
        `)

      const { data, error } = await query

      if (error) throw error
      if (!data) return []

      // Filter by subject_id manually if not 'all'
      let filteredData = data
      if (subjectId !== 'all') {
        filteredData = data.filter((row: any) => row.exams?.subject_id === subjectId)
      }

      // Group by student
      const studentMap: { [key: string]: any } = {}
      filteredData.forEach((row: any) => {
        const id = row.student_id
        if (!studentMap[id]) {
          studentMap[id] = {
            id,
            name: row.users?.full_name || 'Anonymous Student',
            email: row.users?.email || '',
            totalMarks: 0,
            avgPercentage: 0,
            passedCount: 0,
            attemptsCount: 0,
            percentages: [] as number[],
          }
        }
        studentMap[id].totalMarks += Number(row.obtained_marks)
        studentMap[id].attemptsCount += 1
        if (row.is_passed) studentMap[id].passedCount += 1
        studentMap[id].percentages.push(Number(row.percentage))
      })

      // Convert to array and calculate averages
      const list = Object.values(studentMap).map((student: any) => {
        const sum = student.percentages.reduce((acc: number, val: number) => acc + val, 0)
        return {
          ...student,
          avgPercentage: student.attemptsCount > 0 ? Math.round(sum / student.attemptsCount) : 0,
        }
      })

      // Sort by total marks desc, then avg percentage desc
      list.sort((a, b) => b.totalMarks - a.totalMarks || b.avgPercentage - a.avgPercentage)

      // Add ranks
      return list.map((item, index) => ({
        ...item,
        rank: index + 1,
      }))
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Student Leaderboards & Analytics
          </h1>
          <p className="text-sm text-slate-400">View performance standings, score ranks, and subject average metrics.</p>
        </div>

        {/* Subject Standings Selector */}
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500 w-full sm:w-48"
        >
          <option value="all">Overall Standings</option>
          {subjects.map((sub) => (
            <option key={sub.id} value={sub.id}>{sub.name}</option>
          ))}
        </select>
      </div>

      {/* Top 3 Podiums (Render cards if overall leaderboard has students) */}
      {!isLoading && leaderboard.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {leaderboard.slice(0, 3).map((student, idx) => {
            const rankStyles = [
              { border: 'border-amber-500/30', bg: 'bg-amber-500/5', iconColor: 'text-amber-500', title: '1st Standings' },
              { border: 'border-slate-300/30', bg: 'bg-slate-300/5', iconColor: 'text-slate-300', title: '2nd Standings' },
              { border: 'border-amber-700/30', bg: 'bg-amber-700/5', iconColor: 'text-amber-700', title: '3rd Standings' }
            ]
            const styles = rankStyles[idx] || rankStyles[2]
            return (
              <Card key={student.id} className={`border ${styles.border} ${styles.bg} backdrop-blur-md relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-4 opacity-15">
                  <Trophy className={`h-20 w-20 ${styles.iconColor}`} />
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Star className={`h-4 w-4 ${styles.iconColor} fill-current`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{styles.title}</span>
                  </div>
                  <CardTitle className="text-white text-lg font-bold mt-1 truncate">{student.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-400 space-y-1">
                  <p>Cumulative Score: <span className="text-white font-semibold">{student.totalMarks} Marks</span></p>
                  <p>Average Accuracy: <span className="text-white font-semibold">{student.avgPercentage}%</span></p>
                  <p>Pass Rate: <span className="text-white font-semibold">{student.passedCount} / {student.attemptsCount} Exams</span></p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Leaderboard Rankings List */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white text-base">Rankings Standings</CardTitle>
          <CardDescription className="text-slate-400 text-xs">Sorted by cumulative obtained marks and accuracy.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Compiling standings...</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center p-16 text-slate-500">
              No examination records recorded for this scope.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="text-slate-400 w-16 text-center">Rank</TableHead>
                    <TableHead className="text-slate-400">Student</TableHead>
                    <TableHead className="text-slate-400 text-center">Exams Attempted</TableHead>
                    <TableHead className="text-slate-400 text-center">Exams Passed</TableHead>
                    <TableHead className="text-slate-400 text-center">Total Score</TableHead>
                    <TableHead className="text-slate-400 text-center">Avg Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((student) => (
                    <TableRow key={student.id} className="border-b border-slate-800/60 hover:bg-slate-900/30">
                      <TableCell className="text-center font-bold">
                        {student.rank === 1 ? (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/10 text-amber-500 text-xs border border-amber-500/20">
                            1
                          </span>
                        ) : student.rank === 2 ? (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-300/10 text-slate-300 text-xs border border-slate-300/20">
                            2
                          </span>
                        ) : student.rank === 3 ? (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-700/10 text-amber-700 text-xs border border-amber-700/20">
                            3
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs font-mono">{student.rank}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-white">
                        <div className="flex flex-col">
                          <span>{student.name}</span>
                          <span className="text-[10px] text-slate-500 font-normal">{student.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-slate-300 font-mono text-xs">
                        {student.attemptsCount}
                      </TableCell>
                      <TableCell className="text-center text-slate-300 font-mono text-xs">
                        {student.passedCount}
                      </TableCell>
                      <TableCell className="text-center text-emerald-400 font-semibold font-mono text-xs">
                        {student.totalMarks} pts
                      </TableCell>
                      <TableCell className="text-center text-slate-300 font-semibold font-mono text-xs">
                        {student.avgPercentage}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
