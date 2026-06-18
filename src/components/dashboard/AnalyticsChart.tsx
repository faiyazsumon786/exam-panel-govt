'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts'

interface AnalyticsChartProps {
  growthData: { month: string; students: number }[]
  performanceData: { subject: string; averageScore: number; passRate: number }[]
}

export function AnalyticsChart({ growthData, performanceData }: AnalyticsChartProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Student Growth Chart */}
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white text-base">Student Growth Trend</CardTitle>
          <CardDescription className="text-slate-400 text-xs">Monthly registration counts for the current year.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={growthData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                itemStyle={{ color: '#6366f1' }}
              />
              <Line type="monotone" dataKey="students" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Subject Performance Chart */}
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white text-base">Subject Performance Overview</CardTitle>
          <CardDescription className="text-slate-400 text-xs">Average examination score and passing rate per subject.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={performanceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="subject" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="averageScore" name="Avg Score (%)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="passRate" name="Pass Rate (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
export default AnalyticsChart;
