'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  BookOpen, 
  Users, 
  FileSpreadsheet, 
  Megaphone, 
  Loader2, 
  Calendar, 
  TrendingUp 
} from 'lucide-react'

export default function MentorDashboardPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  // Fetch mentor subjects
  const { data: assignedSubjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['mentor-subjects', profile?.id],
    queryFn: async () => {
      if (!profile) return []
      const { data, error } = await supabase
        .from('mentor_subjects')
        .select('subject_id, subjects(name, description)')
        .eq('mentor_id', profile.id)

      if (error) throw error
      return data || []
    },
    enabled: !!profile
  })

  // Fetch student count in mentor's subjects
  const { data: studentCount = 0, isLoading: loadingStudents } = useQuery({
    queryKey: ['mentor-students-count', assignedSubjects],
    queryFn: async () => {
      if (assignedSubjects.length === 0) return 0
      const subjectIds = assignedSubjects.map((s: any) => s.subject_id)

      const { count, error } = await supabase
        .from('student_subjects')
        .select('*', { count: 'exact', head: true })
        .in('subject_id', subjectIds)

      if (error) throw error
      return count || 0
    },
    enabled: assignedSubjects.length > 0
  })

  // Fetch exams count built by this mentor
  const { data: examsCount = 0, isLoading: loadingExams } = useQuery({
    queryKey: ['mentor-exams-count', profile?.id],
    queryFn: async () => {
      if (!profile) return 0
      const { count, error } = await supabase
        .from('exams')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', profile.id)

      if (error) throw error
      return count || 0
    },
    enabled: !!profile
  })

  // Fetch recent announcements
  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery({
    queryKey: ['dashboard-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('publish_date', { ascending: false })
        .limit(3)

      if (error) throw error
      return data || []
    }
  })

  const isLoading = loadingSubjects || loadingStudents || loadingExams || loadingAnnouncements

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Mentor Dashboard</h1>
        <p className="text-sm text-slate-400">Manage exams, build question banks, and review student progress in your assigned subjects.</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Assigned Subjects</CardTitle>
            <BookOpen className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-white">{assignedSubjects.length}</div>
            <div className="flex flex-wrap gap-1 mt-2.5">
              {assignedSubjects.map((s: any) => (
                <Badge key={s.subject_id} className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
                  {s.subjects?.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Total Enrolled Students</CardTitle>
            <Users className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-white">{studentCount}</div>
            <p className="text-xs text-slate-500 mt-1">Students registered in your subjects</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Exams Built</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-white">{examsCount}</div>
            <p className="text-xs text-slate-500 mt-1">Exams created under your account</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subjects scope */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white text-base">Assigned Curriculums</CardTitle>
            <CardDescription className="text-slate-400 text-xs">A list of subjects assigned to you by the administrator.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignedSubjects.length === 0 ? (
              <p className="text-sm text-amber-500">No subjects currently assigned. Please contact your Admin.</p>
            ) : (
              assignedSubjects.map((s: any) => (
                <div key={s.subject_id} className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/20 flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">{s.subjects?.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{s.subjects?.description || 'No syllabus scope described'}</p>
                  </div>
                  <Badge variant="outline" className="border-slate-800 text-slate-400 text-[10px]">
                    Assigned
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Announcements bulletin */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-1.5">
              <Megaphone className="h-4 w-4 text-indigo-400" />
              Recent Announcements
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">Stay updated with bulletins and system notices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No recent notices published.</p>
            ) : (
              announcements.map((ann: any) => (
                <div key={ann.id} className="p-3 bg-slate-950/30 border border-slate-800/60 rounded-lg space-y-1">
                  <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{ann.title}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{ann.description}</p>
                  <div className="flex items-center gap-1 text-[9px] text-slate-500 font-semibold pt-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(ann.publish_date).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
