'use client'

import { useQuery } from '@tanstack/react-query'
import { getAdminStats } from '@/app/actions/admin-stats'
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileSpreadsheet, 
  HelpCircle, 
  Calendar, 
  CheckSquare,
  Loader2 
} from 'lucide-react'

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => await getAdminStats()
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Admin Dashboard</h1>
          <p className="text-sm text-slate-400">Loading system statistics and performance data...</p>
        </div>
        
        {/* Skeleton Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-slate-800 bg-slate-900/40 animate-pulse">
              <CardHeader className="h-20" />
              <CardContent className="h-10" />
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80 bg-slate-900/20 rounded-xl border border-slate-800 animate-pulse" />
      </div>
    )
  }

  const stats = data?.stats || {
    totalStudents: 0,
    totalMentors: 0,
    totalSubjects: 0,
    totalExams: 0,
    totalQuestions: 0,
    todaysExams: 0,
    completedExams: 0,
  }

  const statCards = [
    { title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-indigo-500 bg-indigo-500/10' },
    { title: 'Total Mentors', value: stats.totalMentors, icon: GraduationCap, color: 'text-emerald-500 bg-emerald-500/10' },
    { title: 'Total Subjects', value: stats.totalSubjects, icon: BookOpen, color: 'text-cyan-500 bg-cyan-500/10' },
    { title: 'Total Exams', value: stats.totalExams, icon: FileSpreadsheet, color: 'text-pink-500 bg-pink-500/10' },
    { title: 'Total Questions', value: stats.totalQuestions, icon: HelpCircle, color: 'text-amber-500 bg-amber-500/10' },
    { title: "Today's Exams", value: stats.todaysExams, icon: Calendar, color: 'text-violet-500 bg-violet-500/10' },
    { title: 'Completed Exams', value: stats.completedExams, icon: CheckSquare, color: 'text-teal-500 bg-teal-500/10' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Admin Dashboard</h1>
        <p className="text-sm text-slate-400">Welcome to Luminous Tech system administrator control center.</p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon
          return (
            <Card key={idx} className="border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-md hover:border-slate-700 transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.title}</CardTitle>
                <div className={`p-2 rounded-full ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white tracking-tight">{card.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Analytics Charts */}
      {data && (
        <AnalyticsChart 
          growthData={data.growthChartData}
          performanceData={data.performanceChartData}
        />
      )}
    </div>
  )
}
