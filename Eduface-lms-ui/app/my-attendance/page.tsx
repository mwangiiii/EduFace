"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Calendar } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function MyAttendancePage() {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [studentId, setStudentId] = useState<string | null>(null)

  const [presentThisWeek, setPresentThisWeek] = useState(0)
  const [lateThisWeek, setLateThisWeek] = useState(0)
  const [absentThisWeek, setAbsentThisWeek] = useState(0)
  const [attendanceRate, setAttendanceRate] = useState("0%")
  const [weeklyData, setWeeklyData] = useState<{ date: string; present: number }[]>([])
  const [recentAttendance, setRecentAttendance] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)

  // Fetch authenticated user → profile → student_id
  useEffect(() => {
    const fetchUserAndStudent = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('users')
          .select('id, first_name, last_name, role')
          .eq('id', user.id)
          .single()

        if (!profile || profile.role !== 'student') {
          setUserProfile(profile || null)
          setLoading(false)
          return
        }

        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .single()

        setUserProfile(profile)
        setStudentId(student?.id || null)
      } catch (err) {
        console.error("Error fetching user/student:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchUserAndStudent()
  }, [])

  // Fetch attendance only when we have the correct studentId
  useEffect(() => {
    if (!studentId || !userProfile || userProfile.role !== 'student') return

    const fetchAttendance = async () => {
      setStatsLoading(true)
      try {
        const now = new Date()
        const startOfWeek = new Date(now)
        const dayOfWeek = startOfWeek.getDay()
        startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        startOfWeek.setHours(0, 0, 0, 0)

        const startIso = startOfWeek.toISOString()
        const nowIso = now.toISOString()

        // 1. Enrolled courses
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', studentId)

        const courseIds = enrollments?.map(e => e.course_id) || []
        if (courseIds.length === 0) {
          setPresentThisWeek(0); setLateThisWeek(0); setAbsentThisWeek(0); setAttendanceRate("0%")
          setWeeklyData([]); setRecentAttendance([])
          return
        }

        // 2. Completed sessions this week
        const { data: sessions } = await supabase
          .from('attendance_sessions')
          .select('id, date_time')
          .in('course_id', courseIds)
          .eq('status', 'completed')
          .gte('date_time', startIso)
          .lte('date_time', nowIso)
          .order('date_time', { ascending: false })

        if (!sessions || sessions.length === 0) {
          setPresentThisWeek(0); setLateThisWeek(0); setAbsentThisWeek(0); setAttendanceRate("0%")
          setWeeklyData([]); setRecentAttendance([])
          return
        }

        const sessionIds = sessions.map(s => s.id)

        // 3. Student's records
        const { data: records } = await supabase
          .from('attendance_records')
          .select('session_id, status, timestamp, confidence_score')
          .eq('student_id', studentId)
          .in('session_id', sessionIds)

        const recordMap = new Map(records?.map(r => [r.session_id, r]) || [])

        // Stats calculation
        let present = 0
        let late = 0
        const dailyPresent: { [date: string]: number } = {}

        sessions.forEach(session => {
          const dateStr = new Date(session.date_time).toISOString().split('T')[0]
          dailyPresent[dateStr] = (dailyPresent[dateStr] || 0)

          const rec = recordMap.get(session.id)
          if (rec) {
            if (rec.status === 'present') {
              present++
              dailyPresent[dateStr]++
            } else if (rec.status === 'late') {
              late++
            }
          }
        })

        const absent = sessions.length - present - late
        const rate = sessions.length > 0 ? Math.round(((present + late) / sessions.length) * 100) : 0

        setPresentThisWeek(present)
        setLateThisWeek(late)
        setAbsentThisWeek(absent)
        setAttendanceRate(`${rate}%`)

        // Weekly trend — FIXED: renamed variable to avoid conflict
        const trend: { date: string; present: number }[] = []
        let currentDate = new Date(startOfWeek)  // ← renamed from "day" to "currentDate"
        while (currentDate <= now) {
          const dateStr = currentDate.toISOString().split('T')[0]
          const short = currentDate.toLocaleDateString('en-US', { weekday: 'short' })
          trend.push({ date: short, present: dailyPresent[dateStr] || 0 })
          currentDate.setDate(currentDate.getDate() + 1)
        }
        setWeeklyData(trend)

        // Recent 5 sessions
        const recent = sessions.slice(0, 5).map(session => {
          const rec = recordMap.get(session.id)
          const date = new Date(session.date_time).toISOString().split('T')[0]
          if (!rec) {
            return { date, status: "Absent", time: "—", confidence: "—" }
          }
          return {
            date,
            status: rec.status.charAt(0).toUpperCase() + rec.status.slice(1),
            time: new Date(rec.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            confidence: `${(rec.confidence_score * 100).toFixed(1)}%`
          }
        })
        setRecentAttendance(recent)

      } catch (err) {
        console.error("Error fetching attendance:", err)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchAttendance()
  }, [studentId, userProfile])

  // Loading & access control
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (!userProfile) return <div className="flex items-center justify-center min-h-screen">Please log in.</div>
  if (userProfile.role !== 'student') {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 pl-64">
          <Navbar />
          <main className="pt-16 p-6 text-center text-muted-foreground">
            This page is only available to students.
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">My Attendance</h1>
            <p className="text-muted-foreground">Track your attendance across all courses</p>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600">{statsLoading ? '...' : presentThisWeek}</div>
                <p className="text-sm text-muted-foreground">Present</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-amber-600">{statsLoading ? '...' : lateThisWeek}</div>
                <p className="text-sm text-muted-foreground">Late</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-red-600">{statsLoading ? '...' : absentThisWeek}</div>
                <p className="text-sm text-muted-foreground">Absent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600">{statsLoading ? '...' : attendanceRate}</div>
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Trend */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Weekly Trend</CardTitle>
              <CardDescription>Present sessions per day this week</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Records */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Attendance</CardTitle>
              <CardDescription>Last 5 class sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Date</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium">Time</th>
                      <th className="text-left py-3 px-4 font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendance.map((r, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {r.date}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={r.status === "Absent" ? "destructive" : r.status === "Late" ? "secondary" : "default"}
                            className={
                              r.status === "Present" ? "bg-green-600 text-white" :
                              r.status === "Late" ? "bg-amber-600 text-white" :
                              "bg-red-600 text-white"
                            }
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">{r.time}</td>
                        <td className="py-3 px-4">{r.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}