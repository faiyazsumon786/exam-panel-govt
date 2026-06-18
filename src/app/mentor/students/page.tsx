'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Search, Users, Mail, Phone, Filter } from 'lucide-react'

export default function MentorStudentsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')

  // 1. Fetch mentor assigned subjects
  const { data: mentorSubjects = [], isLoading: loadingSubjects } = useQuery<any[]>({
    queryKey: ['mentor-students-subjects', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return []
      const { data, error } = await supabase
        .from('mentor_subjects')
        .select('subject_id, subjects(id, name)')
        .eq('mentor_id', profile.id)

      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!profile?.id
  })

  // 2. Fetch students registered in those subjects
  const { data: students = [], isLoading: loadingStudents } = useQuery<any[]>({
    queryKey: ['mentor-students-list', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return []

      // Get mentor subject IDs
      const { data: mentorSubs, error: subErr } = await supabase
        .from('mentor_subjects')
        .select('subject_id')
        .eq('mentor_id', profile.id)
        
      if (subErr) throw subErr
      const mentorSubIds = (mentorSubs || []).map((ms: any) => ms.subject_id)
      if (mentorSubIds.length === 0) return []

      // Get all students with their registered subjects
      const { data: studentsData, error: studentError } = await supabase
        .from('users')
        .select(`
          *,
          student_subjects (subject_id)
        `)
        .eq('role', 'student')
        .eq('status', 'approved')

      if (studentError) throw studentError

      // Filter to only students registered in at least one of the mentor's subjects
      const filtered = (studentsData || []).filter((student: any) => 
        student.student_subjects?.some((ss: any) => mentorSubIds.includes(ss.subject_id))
      )
      return (filtered || []) as any[]
    },
    enabled: !!profile?.id
  })

  // Helper to filter students based on search term and selected subject
  const filteredStudents = students.filter((student: any) => {
    const matchesSearch = 
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesSubject = 
      subjectFilter === 'all' || 
      student.student_subjects?.some((ss: any) => ss.subject_id === subjectFilter)

    return matchesSearch && matchesSubject
  })

  // Calculate subject counts
  const getSubjectStudentCount = (subjectId: string) => {
    return students.filter((student: any) => 
      student.student_subjects?.some((ss: any) => ss.subject_id === subjectId)
    ).length
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-500" />
            My Students
          </h1>
          <p className="text-sm text-slate-400">View students enrolled in your training courses.</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardContent className="pt-6">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Enrolled Students</div>
            {loadingStudents ? (
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mt-2" />
            ) : (
              <div className="text-3xl font-bold text-white font-mono mt-1">{students.length}</div>
            )}
            <p className="text-[10px] text-slate-500 mt-1">Across all your assigned subjects</p>
          </CardContent>
        </Card>

        {/* Subjects list overview */}
        {mentorSubjects.slice(0, 2).map((ms: any) => (
          <Card key={ms.subject_id} className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">
                {ms.subjects?.name || 'Subject Course'}
              </div>
              {loadingStudents ? (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mt-2" />
              ) : (
                <div className="text-3xl font-bold text-indigo-400 font-mono mt-1">
                  {getSubjectStudentCount(ms.subject_id)}
                </div>
              )}
              <p className="text-[10px] text-slate-500 mt-1">Active student registrations</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search students by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500 w-full sm:w-48"
            >
              <option value="all">All Assigned Subjects</option>
              {mentorSubjects.map((ms: any) => (
                <option key={ms.subject_id} value={ms.subject_id}>
                  {ms.subjects?.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-0">
          {loadingStudents || loadingSubjects ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Fetching students database...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center p-16 text-slate-500">
              No students found in your assigned subjects.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="text-slate-400">Name</TableHead>
                    <TableHead className="text-slate-400">Email Address</TableHead>
                    <TableHead className="text-slate-400">Phone Number</TableHead>
                    <TableHead className="text-slate-400">Enrolled Subjects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student: any) => {
                    const fallbackChar = student.full_name.charAt(0).toUpperCase()
                    return (
                      <TableRow key={student.id} className="border-b border-slate-800/60 hover:bg-slate-900/30">
                        {/* Profile Info */}
                        <TableCell className="font-semibold flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-indigo-500/20">
                            <AvatarImage src={student.profile_picture || ''} className="object-cover" />
                            <AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">
                              {fallbackChar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-white">{student.full_name}</span>
                        </TableCell>
                        
                        {/* Email */}
                        <TableCell className="text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-500" />
                            {student.email}
                          </div>
                        </TableCell>

                        {/* Phone */}
                        <TableCell className="text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            {student.phone || 'No phone number'}
                          </div>
                        </TableCell>

                        {/* Subjects Enrolled (Only show those matching mentor's subjects) */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {student.student_subjects?.map((ss: any) => {
                              const match = mentorSubjects.find((ms) => ms.subject_id === ss.subject_id)
                              return match ? (
                                <Badge key={ss.subject_id} variant="outline" className="border-indigo-500/20 bg-indigo-500/5 text-indigo-400 font-normal">
                                  {match.subjects?.name}
                                </Badge>
                              ) : null
                            })}
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
    </div>
  )
}
