"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Download, FileText } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"

interface UserProfile {
  first_name: string
  last_name: string
  role: string
  id: string
}

interface AttendanceTrendData {
  date: string
  present: number
  absent: number
}

interface CourseAttendanceData {
  name: string
  value: number
  color: string
}

interface StudentReport {
  name: string
  totalDays: number
  present: number
  absent: number
  rate: string
}

interface KeyMetric {
  label: string
  value: string
  color?: string
}

export default function ReportsPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [dateRange, setDateRange] = useState("week")
  const [attendanceChartData, setAttendanceChartData] = useState<AttendanceTrendData[]>([])
  const [courseData, setCourseData] = useState<CourseAttendanceData[]>([])
  const [studentReports, setStudentReports] = useState<StudentReport[]>([])
  const [keyMetrics, setKeyMetrics] = useState<KeyMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          console.error('Auth error:', authError)
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('first_name, last_name, role, id')
          .eq('id', user.id)
          .single()

        if (profileError || !profile || !['administrator', 'teacher'].includes(profile.role)) {
          console.error('Profile fetch error or unauthorized role:', profileError)
          return
        }

        setUserProfile(profile)
        await fetchReportsData(dateRange)
      } catch (error) {
        console.error('Unexpected error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [])

  const fetchReportsData = async (range: string) => {
    if (!userProfile) return
    setFetching(true)
    try {
      const now = new Date('2025-11-07') // Current date as per context
      let startDate: Date
      switch (range) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'quarter':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      }

      const startIso = startDate.toISOString()
      const role = userProfile.role
      let courseIds: string[] = []

      if (role === 'teacher') {
        // Get teacher's courses via units
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', userProfile.id)
          .single()

        if (!teacher) {
          setFetching(false)
          return
        }

        const { data: units } = await supabase
          .from('units')
          .select('course_id')
          .eq('teacher_id', teacher.id)

        courseIds = [...new Set(units?.map(u => u.course_id) || [])]
      } // For admin, courseIds remains empty (all courses)

      // 1. Attendance Trend: Group by date from completed sessions (scoped by courseIds if teacher)
      let trendQuery = supabase
        .from('attendance_sessions')
        .select(`
          date_time,
          course_id,
          enrollments(course_id, count),
          attendance_records(status)
        `)
        .eq('status', 'completed')
        .gte('date_time', startIso)
        .order('date_time', { ascending: true })

      if (role === 'teacher' && courseIds.length > 0) {
        trendQuery = trendQuery.in('course_id', courseIds)
      }

      const { data: trendData } = await trendQuery

      const dailyData: { [key: string]: { present: number; absent: number } } = {}
      trendData?.forEach(session => {
        const dateKey = new Date(session.date_time).toLocaleDateString('en-US', { weekday: 'short' })
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { present: 0, absent: 0 }
        }
        const enrolled = session.enrollments?.find(e => e.course_id === session.course_id)?.count || 0
        const presents = (session.attendance_records || []).filter(r => r.status === 'present').length
        dailyData[dateKey].present += presents
        dailyData[dateKey].absent += enrolled - presents
      })

      const chartData: AttendanceTrendData[] = Object.entries(dailyData)
        .map(([date, counts]) => ({ date, present: counts.present, absent: counts.absent }))
        .slice(0, 5) // Limit to 5 days for chart

      setAttendanceChartData(chartData)

      // 2. Course-wise Attendance: Average rate per course (scoped)
      let courseQuery = supabase
        .from('courses')
        .select(`
          id, name,
          enrollments!inner(course_id, count),
          attendance_sessions!inner(course_id, date_time),
          attendance_records(status)
        `)
        .gte('attendance_sessions.date_time', startIso)

      if (role === 'teacher' && courseIds.length > 0) {
        courseQuery = courseQuery.in('id', courseIds)
      }

      const { data: courseDataRaw } = await courseQuery

      const courseStats: { [key: string]: { totalPresent: number; totalEnrolled: number } } = {}
      courseDataRaw?.forEach(course => {
        const courseId = course.id
        if (!courseStats[courseId]) {
          courseStats[courseId] = { totalPresent: 0, totalEnrolled: 0 }
        }
        const enrolled = course.enrollments?.reduce((sum, e) => sum + (e.count || 0), 0) || 0
        const presents = (course.attendance_records || []).filter(r => r.status === 'present').length
        courseStats[courseId].totalPresent += presents
        courseStats[courseId].totalEnrolled += enrolled
      })

      const colors = ['#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981']
      const pieData: CourseAttendanceData[] = Object.entries(courseStats)
        .map(([id, stats], index) => {
          const rate = stats.totalEnrolled > 0 ? Math.round((stats.totalPresent / stats.totalEnrolled) * 100) : 0
          const courseName = courseDataRaw?.find(c => c.id === id)?.name || 'Unknown'
          return {
            name: courseName,
            value: rate,
            color: colors[index % colors.length]
          }
        })
        .slice(0, 4) // Limit to 4 courses

      setCourseData(pieData)

      // 3. Key Metrics: Scoped to role
      let totalStudentsQuery = supabase.from('students').select('*', { count: 'exact', head: true })
      let sessionsQuery = supabase
        .from('attendance_sessions')
        .select('id, course_id, enrollments!inner(course_id, count)', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('date_time', startIso)

      if (role === 'teacher' && courseIds.length > 0) {
        totalStudentsQuery = supabase
          .from('enrollments')
          .select('student_id', { count: 'exact', head: true })
          .in('course_id', courseIds)
          .eq('status', 'active')
        sessionsQuery = sessionsQuery.in('course_id', courseIds)
      }

      const { count: totalStudentsCount } = await totalStudentsQuery
      const { count: totalCompletedSessions, data: allRecords } = await sessionsQuery

      const totalPresentOverall = allRecords?.reduce((sum, s) => {
        const enrolled = s.enrollments?.find(e => e.course_id === s.course_id)?.count || 0
        const presents = s.attendance_records?.filter(r => r.status === 'present').length || 0
        return sum + presents
      }, 0) || 0
      const totalEnrolledOverall = allRecords?.reduce((sum, s) => {
        const enrolled = s.enrollments?.find(e => e.course_id === s.course_id)?.count || 0
        return sum + enrolled
      }, 0) || 0
      const overallRate = totalEnrolledOverall > 0 ? Math.round((totalPresentOverall / totalEnrolledOverall) * 100) : 0
      const avgPresentPerDay = totalCompletedSessions > 0 ? Math.round(totalPresentOverall / totalCompletedSessions) : 0

      setKeyMetrics([
        { label: `${role === 'teacher' ? 'Your Classes' : 'Overall'} Attendance Rate`, value: `${overallRate}%` },
        { label: `${role === 'teacher' ? 'Students in Your Classes' : 'Total Students'}`, value: totalStudentsCount.toString() },
        { label: 'Average Present/Day', value: avgPresentPerDay.toString() },
        { label: 'System Uptime', value: '99.8%', color: 'text-green-500' }
      ])

      // 4. Student Attendance Summary: Top 3 students by rate (scoped)
      let studentQuery = supabase
        .from('students')
        .select(`
          id,
          users!inner(first_name, last_name),
          enrollments!inner(course_id),
          attendance_records(status, session_id),
          attendance_sessions!attendance_records(course_id, date_time)
        `)
        .eq('attendance_sessions.status', 'completed')
        .gte('attendance_sessions.date_time', startIso)

      if (role === 'teacher' && courseIds.length > 0) {
        studentQuery = supabase
          .from('enrollments')
          .select(`
            students!inner(id, users!inner(first_name, last_name)),
            attendance_records(status, session_id),
            attendance_sessions!attendance_records(course_id, date_time)
          `)
          .in('course_id', courseIds)
          .eq('status', 'active')
          .eq('attendance_sessions.status', 'completed')
          .gte('attendance_sessions.date_time', startIso)
      }

      const { data: studentData } = await studentQuery

      const studentStats: { [key: string]: { totalDays: number; present: number } } = {}
      studentData?.forEach(enrollOrStudent => {
        const studentId = enrollOrStudent.students?.id || enrollOrStudent.id
        if (!studentStats[studentId]) {
          studentStats[studentId] = { totalDays: 0, present: 0 }
        }
        const sessions = enrollOrStudent.attendance_records?.length || 0
        const presents = enrollOrStudent.attendance_records?.filter(r => r.status === 'present').length || 0
        studentStats[studentId].totalDays += sessions
        studentStats[studentId].present += presents
      })

      const reports: StudentReport[] = Object.entries(studentStats)
        .map(([id, stats]) => {
          const name = `${studentData?.find(s => (s.students?.id || s.id) === id)?.students?.users?.first_name || 
                       studentData?.find(s => s.id === id)?.users?.first_name || ''} ${
            studentData?.find(s => (s.students?.id || s.id) === id)?.students?.users?.last_name || 
            studentData?.find(s => s.id === id)?.users?.last_name || ''}`.trim()
          const rate = stats.totalDays > 0 ? Math.round((stats.present / stats.totalDays) * 100) : 0
          return {
            name: name || 'Unknown Student',
            totalDays: stats.totalDays,
            present: stats.present,
            absent: stats.totalDays - stats.present,
            rate: `${rate}%`
          }
        })
        .sort((a, b) => parseInt(b.rate) - parseInt(a.rate))
        .slice(0, 3)

      setStudentReports(reports)
    } catch (error) {
      console.error('Error fetching reports data:', error)
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    if (userProfile) {
      fetchReportsData(dateRange)
    }
  }, [dateRange])

  const handleExport = (format: 'pdf' | 'csv' | 'excel') => {
    // TODO: Implement export logic (e.g., generate PDF/CSV from data)
    console.log(`Exporting reports as ${format.toUpperCase()}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading reports...</div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Access denied. Admin or Teacher only.</div>
      </div>
    )
  }

  const role = userProfile.role
  const pageTitle = role === 'teacher' ? 'Your Attendance Reports' : 'System Reports'
  const description = role === 'teacher' ? 'Analytics for your assigned classes' : 'Attendance analytics and insights'

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">{pageTitle}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>

          <div className="flex gap-4 mb-6">
            <Select value={dateRange} onValueChange={setDateRange} disabled={fetching}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={fetching}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={fetching}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={fetching}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>

          {fetching && <div className="mb-4 text-center text-muted-foreground">Fetching data...</div>}

          <div className="grid gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>{role === 'teacher' ? 'Your Classes Trend' : 'Attendance Trend'}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="present" fill="#3b82f6" name="Present" />
                    <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{role === 'teacher' ? 'Your Courses Attendance' : 'Course-wise Attendance'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={courseData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {courseData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Key Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {keyMetrics.map((metric, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-muted rounded">
                      <span className="text-sm">{metric.label}</span>
                      <span className={`font-bold text-lg ${metric.color || ''}`}>{metric.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{role === 'teacher' ? 'Students in Your Classes' : 'Student Attendance Summary'}</CardTitle>
              <CardDescription>Individual student attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Student Name</th>
                      <th className="text-left py-3 px-4 font-medium">Total Days</th>
                      <th className="text-left py-3 px-4 font-medium">Present</th>
                      <th className="text-left py-3 px-4 font-medium">Absent</th>
                      <th className="text-left py-3 px-4 font-medium">Rate</th>
                      <th className="text-left py-3 px-4 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentReports.map((student, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">{student.name}</td>
                        <td className="py-3 px-4">{student.totalDays}</td>
                        <td className="py-3 px-4 text-green-600 font-medium">{student.present}</td>
                        <td className="py-3 px-4 text-red-600 font-medium">{student.absent}</td>
                        <td className="py-3 px-4 font-bold">{student.rate}</td>
                        <td className="py-3 px-4">
                          <Button variant="ghost" size="sm">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {studentReports.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No student data available for the selected range.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}