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
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string; role: string; id: string } | null>(null)
  const [presentThisWeek, setPresentThisWeek] = useState(0)
  const [absentThisWeek, setAbsentThisWeek] = useState(0)
  const [attendanceRate, setAttendanceRate] = useState("0%")
  const [weeklyData, setWeeklyData] = useState<{ date: string; present: number }[]>([])
  const [recentAttendance, setRecentAttendance] = useState<{ date: string; status: string; time: string; confidence: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Get the current authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          console.error('Auth error:', authError)
          return
        }

        // Fetch profile from custom 'users' table
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('first_name, last_name, role, id')
          .eq('id', user.id)
          .single()

        if (profileError || !profile) {
          console.error('Profile fetch error:', profileError)
          return
        }

        setUserProfile(profile)
      } catch (error) {
        console.error('Unexpected error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [])

  useEffect(() => {
    if (!userProfile || userProfile.role !== 'student') return

    const fetchAttendanceStats = async () => {
      setStatsLoading(true)
      try {
        const userId = userProfile.id
        const now = new Date()
        const startOfWeek = new Date(now)
        const dayOfWeek = startOfWeek.getDay()
        startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)) // Monday
        const startIso = startOfWeek.toISOString()
        const nowIso = now.toISOString()

        // Fetch enrolled course IDs
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', userId)

        const courseIds = enrollments?.map(e => e.course_id) || []
        if (courseIds.length === 0) {
          // No enrollments, set defaults
          setPresentThisWeek(0)
          setAbsentThisWeek(0)
          setAttendanceRate("0%")
          setWeeklyData([])
          setRecentAttendance([])
          return
        }

        // Fetch sessions this week
        const { data: sessions, error: sessionsError } = await supabase
          .from('attendance_sessions')
          .select('id, date_time, course_id')
          .in('course_id', courseIds)
          .gte('date_time', startIso)
          .lte('date_time', nowIso)
          .eq('status', 'completed') // Only completed sessions
          .order('date_time', { ascending: false })

        if (sessionsError) {
          console.error('Sessions fetch error:', sessionsError)
          return
        }

        const sessionIds = sessions.map(s => s.id)
        const totalSessions = sessions.length

        // Fetch records for these sessions
        const { data: records, error: recordsError } = await supabase
          .from('attendance_records')
          .select('session_id, status, timestamp, confidence_score')
          .eq('student_id', userId)
          .in('session_id', sessionIds)

        if (recordsError) {
          console.error('Records fetch error:', recordsError)
          return
        }

        const recordMap = new Map(records.map(r => [r.session_id, r]))

        // Calculate weekly stats
        let totalPresent = 0
        const dailyPresent: { [key: string]: number } = {}
        sessions.forEach(s => {
          const dateStr = new Date(s.date_time).toISOString().split('T')[0]
          if (!dailyPresent[dateStr]) dailyPresent[dateStr] = 0
          const rec = recordMap.get(s.id)
          if (rec && rec.status === 'present') {
            totalPresent++
            dailyPresent[dateStr]++
          }
        })

        const totalAbsent = totalSessions - totalPresent
        const rate = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0

        setPresentThisWeek(totalPresent)
        setAbsentThisWeek(totalAbsent)
        setAttendanceRate(`${rate}%`)

        // Build weekly trend data
        const trendData: { date: string; present: number }[] = []
        let currentDay = new Date(startOfWeek)
        while (currentDay <= now) {
          const dateStr = currentDay.toISOString().split('T')[0]
          const present = dailyPresent[dateStr] || 0
          const dayShort = currentDay.toLocaleDateString('en-US', { weekday: 'short' })
          trendData.push({ date: dayShort, present })
          currentDay.setDate(currentDay.getDate() + 1)
        }
        setWeeklyData(trendData)

        // Recent attendance (last 5 sessions)
        const recentSessions = sessions.slice(0, 5)
        const recentList: { date: string; status: string; time: string; confidence: string }[] = []
        recentSessions.forEach(session => {
          const rec = recordMap.get(session.id)
          const date = new Date(session.date_time).toISOString().split('T')[0]
          let status = 'Absent'
          let time = '—'
          let confidence = '—'
          if (rec) {
            status = rec.status.charAt(0).toUpperCase() + rec.status.slice(1)
            time = formatTime(rec.timestamp)
            confidence = `${(rec.confidence_score * 100).toFixed(1)}%`
          } else {
            status = 'Absent'
          }
          recentList.push({ date, status, time, confidence })
        })
        setRecentAttendance(recentList)
      } catch (error) {
        console.error('Unexpected error fetching attendance stats:', error)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchAttendanceStats()
  }, [userProfile])

  const formatTime = (isoStr: string) => {
    return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!userProfile) {
    return <div className="flex items-center justify-center min-h-screen">No profile found. Please log in again.</div>
  }

  const role = userProfile.role
  if (role !== 'student') {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 pl-64">
          <Navbar />
          <main className="pt-16 p-6">
            <div className="text-center text-muted-foreground">
              Attendance view is available for students only.
            </div>
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
            <p className="text-muted-foreground">Your attendance records and statistics</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-500">{statsLoading ? '...' : presentThisWeek}</div>
                  <p className="text-sm text-muted-foreground">Present This Week</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-500">{statsLoading ? '...' : absentThisWeek}</div>
                  <p className="text-sm text-muted-foreground">Absent This Week</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">{statsLoading ? '...' : attendanceRate}</div>
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Weekly Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="present" stroke="#3b82f6" name="Present" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Records</CardTitle>
              <CardDescription>Your last 5 attendance entries</CardDescription>
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
                    {recentAttendance.map((record, index) => {
                      let variant = "default"
                      let bgClass = "bg-green-500"
                      if (record.status === "Absent") {
                        variant = "destructive"
                        bgClass = "bg-red-500"
                      } else if (record.status === "Late") {
                        variant = "secondary"
                        bgClass = "bg-yellow-500"
                      }
                      return (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {record.date}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={variant} className={bgClass}>
                              {record.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">{record.time}</td>
                          <td className="py-3 px-4">{record.confidence}</td>
                        </tr>
                      )
                    })}
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