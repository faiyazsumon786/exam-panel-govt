'use server'

import { createClient } from '@/lib/supabase/server'

export async function getAdminStats() {
  const supabase = await createClient()

  // 1. Fetch counts
  const { count: totalStudents } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')

  const { count: totalMentors } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'mentor')

  const { count: totalSubjects } = await supabase
    .from('subjects')
    .select('*', { count: 'exact', head: true })

  const { count: totalExams } = await supabase
    .from('exams')
    .select('*', { count: 'exact', head: true })

  const { count: totalQuestions } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })

  // Today's exams
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const { count: todaysExams } = await supabase
    .from('exams')
    .select('*', { count: 'exact', head: true })
    .gte('start_date', todayStart.toISOString())
    .lte('start_date', todayEnd.toISOString())

  // Completed exams (exam attempts where status is 'submitted' or 'auto_submitted')
  const { count: completedExams } = await supabase
    .from('exam_attempts')
    .select('*', { count: 'exact', head: true })
    .in('status', ['submitted', 'auto_submitted'])

  // 2. Fetch Student Growth data (Group registrations by month)
  const { data: usersData } = await supabase
    .from('users')
    .select('created_at')
    .eq('role', 'student')
    .order('created_at', { ascending: true })

  const monthlyGrowth: { [key: string]: number } = {};
  (usersData as any[] | null)?.forEach((user) => {
    const date = new Date(user.created_at)
    const month = date.toLocaleString('default', { month: 'short' })
    monthlyGrowth[month] = (monthlyGrowth[month] || 0) + 1
  })

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  let cumulativeStudents = 0
  const growthChartData = months.map((month) => {
    cumulativeStudents += monthlyGrowth[month] || 0
    return {
      month,
      students: cumulativeStudents,
    }
  })

  // 3. Fetch Subject Performance data (Average score / pass rate per subject)
  const { data: subjectsList } = await supabase
    .from('subjects')
    .select('id, name')

  const performanceChartData = []

  if (subjectsList) {
    for (const sub of (subjectsList as any[])) {
      // Let's query properly: first get exams for this subject
      const { data: examsInSubject } = await supabase
        .from('exams')
        .select('id')
        .eq('subject_id', sub.id)

      const examIds = (examsInSubject as any[])?.map((e: any) => e.id) || []

      if (examIds.length > 0) {
        const { data: results } = await supabase
          .from('results')
          .select('percentage, is_passed')
          .in('exam_id', examIds)

        const resultsList = results as any[] | null
        if (resultsList && resultsList.length > 0) {
          const totalPct = resultsList.reduce((acc, r) => acc + Number(r.percentage), 0)
          const passedCount = resultsList.filter(r => r.is_passed).length
          
          performanceChartData.push({
            subject: sub.name,
            averageScore: Math.round(totalPct / resultsList.length),
            passRate: Math.round((passedCount / resultsList.length) * 100),
          })
        } else {
          performanceChartData.push({
            subject: sub.name,
            averageScore: 0,
            passRate: 0,
          })
        }
      } else {
        performanceChartData.push({
          subject: sub.name,
          averageScore: 0,
          passRate: 0,
        })
      }
    }
  }

  return {
    stats: {
      totalStudents: totalStudents || 0,
      totalMentors: totalMentors || 0,
      totalSubjects: totalSubjects || 0,
      totalExams: totalExams || 0,
      totalQuestions: totalQuestions || 0,
      todaysExams: todaysExams || 0,
      completedExams: completedExams || 0,
    },
    growthChartData,
    performanceChartData,
  }
}
