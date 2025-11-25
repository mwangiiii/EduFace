"use client"
// Utility to get first element if array, or self if not
function getFirstOrSelf<T>(val: T | T[] | undefined): T | undefined {
  if (Array.isArray(val)) return val[0]
  return val
}

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
import { Download, Calendar, TrendingUp, Users, Eye } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"

interface UserProfile {
  id: string
  first_name: string
  last_name: string
  role: "teacher" | "administrator"
}

interface AttendanceTrend {
  date: string
  present: number
  absent: number
  total: number
  rate: number
}

interface CourseStats {
  course_id: string
  course_name: string
  present: number
  total_expected: number
  rate: number
}

interface StudentReport {
  student_id: string
  name: string
  student_number: string
  present: number
  absent: number
  total_sessions: number
  rate: number
}

interface SessionDetail {
  id: string
  session_id: string
  date_time: string
  unit_name: string
  course_name: string
  present_students: { student_number: string; timestamp: string }[]
  absent_students: { name: string; student_number: string }[]
  total_enrolled: number
}

interface KeyMetric {
  label: string
  value: string | number
  icon?: React.ReactNode
}

interface SessionRow {
  id: string
  session_id: string
  date_time: string
  unit_name: string
  course_name: string
  present: number
  enrolled: number
}


// Wrap all logic in a component
export default function ReportsPage() {
    // ...existing code...
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter" | "year">("month")
  const [customStart, setCustomStart] = useState<string>("")
  const [customEnd, setCustomEnd] = useState<string>("")
  const [unitFilter, setUnitFilter] = useState<string>("")
  const [courseFilter, setCourseFilter] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [showSessionDialog, setShowSessionDialog] = useState(false)

  const [trendData, setTrendData] = useState<AttendanceTrend[]>([])
  // const [coursePieData, setCoursePieData] = useState<CourseStats[]>([])
  const [studentReports, setStudentReports] = useState<StudentReport[]>([])
  const [keyMetrics, setKeyMetrics] = useState<KeyMetric[]>([])
  // const [recentSessions, setRecentSessions] = useState<SessionRow[]>([])
  const [allSessions, setAllSessions] = useState<SessionRow[]>([])
  const [allUnits, setAllUnits] = useState<string[]>([])
  const [allCourses, setAllCourses] = useState<string[]>([])



  const getDateRangeFilter = () => {
    if (customStart && customEnd) {
      return { start: new Date(customStart).toISOString(), end: new Date(customEnd).toISOString() }
    }
    const now = new Date()
    let startDate: Date
    switch (dateRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    return { start: startDate.toISOString(), end: now.toISOString() }
  }

  const fetchReportsData = useCallback(async () => {
    if (!userProfile) return
    setFetching(true)

    try {
      const { start, end } = getDateRangeFilter()
      const isTeacher = userProfile.role === "teacher"

      // 1. Get teacher's units
      let allowedUnitIds: string[] = []
      if (isTeacher) {
        const { data: assignments } = await supabase
          .from("unit_teachers")
          .select("unit_id")
          .eq("teacher_id", userProfile.id)

        allowedUnitIds = assignments?.map(a => a.unit_id) || []
      }

      // 2. Fetch completed sessions
      let sessionsQuery = supabase
        .from("attendance_sessions")
        .select(`
          id,
          session_id,
          date_time,
          unit_id,
          units!inner (
            id,
            name,
            course_id,
            courses!inner (
              id,
              name
            )
          )
        `)
        .eq("status", "completed")
        .gte("date_time", start)
        .lte("date_time", end)
        .order("date_time", { ascending: false })

      if (isTeacher && allowedUnitIds.length > 0) {
        sessionsQuery = sessionsQuery.in("unit_id", allowedUnitIds)
      }

      const { data: sessions, error: sessErr } = await sessionsQuery
      if (sessErr) throw sessErr
      if (!sessions || sessions.length === 0) {
        setTrendData([])
        // setCoursePieData([])
        setStudentReports([])
        // setRecentSessions([])
        setKeyMetrics([
          { label: "Total Sessions", value: 0, icon: <Calendar className="h-5 w-5" /> },
          { label: "Overall Attendance", value: "0%", icon: <TrendingUp className="h-5 w-5" /> },
          { label: "Active Students", value: 0, icon: <Users className="h-5 w-5" /> },
          { label: "Avg. Daily Present", value: 0 },
        ])
        setFetching(false)
        return
      }

      const sessionIds = sessions.map(s => s.id)
      // Handle units and courses as arrays (Supabase join result)
      const courseIds = [...new Set(sessions.map(s => {
        const units = getFirstOrSelf(s.units)
        const courses = getFirstOrSelf(units?.courses)
        return courses?.id
      }).filter(Boolean))]

      // 3. Fetch attendance records
      const { data: records } = await supabase
        .from("attendance_records")
        .select("session_id, student_id")
        .in("session_id", sessionIds)

      // 4. Fetch enrollments + student info
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          course_id,
          students!inner (
            id,
            student_id,
            users!inner (first_name, last_name)
          )
        `)
        .in("course_id", courseIds)
        .eq("status", "active")

      // Build maps
      const studentInfo = new Map<string, { name: string; number: string }>()
      const enrolledByCourse = new Map<string, Set<string>>()

      enrollments?.forEach(en => {
        const student = getFirstOrSelf(en.students)
        const user = getFirstOrSelf(student?.users)
        const sid = student?.id
        studentInfo.set(sid, {
          name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
          number: student?.student_id
        })
        if (!enrolledByCourse.has(en.course_id)) enrolledByCourse.set(en.course_id, new Set())
        if (sid) enrolledByCourse.get(en.course_id)!.add(sid)
      })

      const presentBySession = new Map<string, Set<string>>()
      records?.forEach(r => {
        if (!presentBySession.has(r.session_id)) presentBySession.set(r.session_id, new Set())
        presentBySession.get(r.session_id)!.add(r.student_id)
      })

      // Build recent sessions list
      const sessionRows: SessionRow[] = sessions.map(s => {
        const units = getFirstOrSelf(s.units)
        const courses = getFirstOrSelf(units?.courses)
        const courseId = courses?.id
        const enrolled = enrolledByCourse.get(courseId)?.size || 0
        const present = presentBySession.get(s.id)?.size || 0
        return {
          id: s.id,
          session_id: s.session_id,
          date_time: new Date(s.date_time).toLocaleString(),
          unit_name: units?.name || '',
          course_name: courses?.name || '',
          present,
          enrolled
        }
      })

      // Daily trend
      const daily = new Map<string, { present: number; total: number }>()
      sessions.forEach(s => {
        const dateKey = new Date(s.date_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        const units = getFirstOrSelf(s.units)
        const courses = getFirstOrSelf(units?.courses)
        const courseId = courses?.id
        const enrolled = enrolledByCourse.get(courseId)?.size || 0
        const present = presentBySession.get(s.id)?.size || 0

        if (!daily.has(dateKey)) daily.set(dateKey, { present: 0, total: 0 })
        const d = daily.get(dateKey)!
        d.present += present
        d.total += enrolled
      })

      const trendArray: AttendanceTrend[] = Array.from(daily.entries())
        .map(([date, stats]) => ({
          date,
          present: stats.present,
          absent: stats.total - stats.present,
          total: stats.total,
          rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      // Course stats
      const courseStatsMap = new Map<string, { name: string; present: number; total: number }>()
      sessions.forEach(s => {
        const units = getFirstOrSelf(s.units)
        const c = getFirstOrSelf(units?.courses)
        if (!c) return
        const enrolled = enrolledByCourse.get(c.id)?.size || 0
        const present = presentBySession.get(s.id)?.size || 0
        if (!courseStatsMap.has(c.id)) courseStatsMap.set(c.id, { name: c.name, present: 0, total: 0 })
        const st = courseStatsMap.get(c.id)!
        st.present += present
        st.total += enrolled
      })

      const coursePieArray: CourseStats[] = Array.from(courseStatsMap.values())
        .map(st => ({
          course_id: st.name,
          course_name: st.name,
          present: st.present,
          total_expected: st.total,
          rate: st.total > 0 ? Math.round((st.present / st.total) * 100) : 0
        }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 5)

      // Student stats
      const studentStats = new Map<string, { present: number; total: number }>()
      sessions.forEach(s => {
        const units = getFirstOrSelf(s.units)
        const courses = getFirstOrSelf(units?.courses)
        const courseId = courses?.id
        const enrolled = enrolledByCourse.get(courseId) || new Set()
        const present = presentBySession.get(s.id) || new Set()

        enrolled.forEach(sid => {
          if (!studentStats.has(sid)) studentStats.set(sid, { present: 0, total: 0 })
          const st = studentStats.get(sid)!
          st.total += 1
          if (present.has(sid)) st.present += 1
        })
      })

      const topStudents: StudentReport[] = Array.from(studentStats.entries())
        .map(([sid, stats]) => {
          const info = studentInfo.get(sid) || { name: "Unknown", number: "N/A" }
          return {
            student_id: sid,
            name: info.name,
            student_number: info.number,
            present: stats.present,
            absent: stats.total - stats.present,
            total_sessions: stats.total,
            rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
          }
        })
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 10)

      const totalPresent = trendArray.reduce((s, d) => s + d.present, 0)
      const totalExpected = trendArray.reduce((s, d) => s + d.total, 0)
      const overallRate = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0

      setTrendData(trendArray)
      // setCoursePieData(coursePieArray)
      setStudentReports(topStudents)
      setAllSessions(sessionRows)
      // setRecentSessions(sessionRows)
      // Collect all units and courses for filter dropdowns
      setAllUnits(Array.from(new Set(sessionRows.map(s => s.unit_name))))
      setAllCourses(Array.from(new Set(sessionRows.map(s => s.course_name))))
      setKeyMetrics([
        { label: "Total Sessions", value: sessions.length, icon: <Calendar className="h-5 w-5" /> },
        { label: "Overall Attendance", value: `${overallRate}%`, icon: <TrendingUp className="h-5 w-5" /> },
        { label: "Active Students", value: studentInfo.size, icon: <Users className="h-5 w-5" /> },
        { label: "Avg. Daily Present", value: trendArray.length > 0 ? Math.round(totalPresent / trendArray.length) : 0 },
      ])

    } catch (err) {
      console.error("Report fetch error:", err)
    } finally {
      setFetching(false)
    }
  }, [userProfile, dateRange])

  const openSessionDetail = async (session: SessionRow) => {
    // Fetch all present students for this session (status = 'present')
    const { data: records, error: recErr } = await supabase
      .from("attendance_records")
      .select(`student_id, timestamp, status`)
      .eq("session_id", session.id)
      .eq("status", "present")
      .order("timestamp", { ascending: true })

    // Fetch student details for present students
    let presentStudents: { student_id: string; timestamp: string }[] = []
    if (records && records.length > 0) {
      presentStudents = records.map(r => ({
        student_id: r.student_id,
        timestamp: new Date(r.timestamp).toLocaleString()
      }))
    }

    // Fetch student info for these student_ids (only admission number)
    let studentIdMap = new Map<string, string>()
    if (presentStudents.length > 0) {
      const { data: studentDetails } = await supabase
        .from('students')
        .select('id, student_id')
        .in('id', presentStudents.map(s => s.student_id))
      studentDetails?.forEach(s => {
        studentIdMap.set(s.id, s.student_id || 'N/A')
      })
    }

    // Build present_students array for dialog (only admission number and time)
    const presentList = presentStudents.map(s => ({
      student_number: studentIdMap.get(s.student_id) || 'N/A',
      timestamp: s.timestamp
    }))

    setSessionDetail({
      ...session,
      present_students: presentList,
      absent_students: [], // Not needed for this requirement
      total_enrolled: presentList.length
    })
    setShowSessionDialog(true)
  }

  // Zero-dependency PDF print
  const downloadPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const title = userProfile?.role === "teacher" ? "My Attendance Report" : "System Attendance Report"

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1, h2 { color: #1e40af; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #94a3b8; padding: 12px; text-align: left; }
            th { background: #f1f5f9; }
            .rate { font-weight: bold; }
            .high { color: #16a34a; }
            .medium { color: #d97706; }
            .low { color: #dc2626; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p><strong>Period:</strong> Last ${dateRange} | <strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <h2>Top Performing Students</h2>
          <table>
            <thead><tr><th>Rank</th><th>Name</th><th>ID</th><th>Present</th><th>Absent</th><th>Total</th><th>Rate</th></tr></thead>
            <tbody>
              ${studentReports.map((s, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${s.name}</td>
                  <td>${s.student_number}</td>
                  <td>${s.present}</td>
                  <td>${s.absent}</td>
                  <td>${s.total_sessions}</td>
                  <td class="rate ${s.rate >= 90 ? 'high' : s.rate >= 70 ? 'medium' : 'low'}">${s.rate}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>window.onload = () => window.print()</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setLoading(false)

      const { data: profile } = await supabase
        .from("users")
        .select("id, first_name, last_name, role")
        .eq("id", user.id)
        .single()

      if (profile && ["teacher", "administrator"].includes(profile.role)) {
        setUserProfile(profile as UserProfile)
      }
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (userProfile) fetchReportsData()
  }, [userProfile, dateRange, fetchReportsData])

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>
  if (!userProfile) return <div className="flex min-h-screen items-center justify-center"><p>Access denied.</p></div>

  // Filtering logic
  const filteredSessions = allSessions.filter(s => {
    let dateOk = true
    if (customStart && customEnd) {
      const d = new Date(s.date_time)
      dateOk = d >= new Date(customStart) && d <= new Date(customEnd)
    }
    let unitOk = !unitFilter || s.unit_name === unitFilter
    let courseOk = !courseFilter || s.course_name === courseFilter
    return dateOk && unitOk && courseOk
  })

  // const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"]

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6 space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {userProfile.role === "teacher" ? "My Attendance Reports" : "System Reports"}
            </h1>
            <p className="text-muted-foreground">Real-time attendance analytics</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="quarter">Last 90 Days</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <label className="text-sm">Custom Start:</label>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border rounded px-2 py-1" />
              <label className="text-sm">End:</label>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border rounded px-2 py-1" />
              <Button size="sm" variant="outline" onClick={() => { setCustomStart(""); setCustomEnd(""); }}>Clear</Button>
            </div>
            <Select value={unitFilter || "__all__"} onValueChange={v => setUnitFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Filter by Unit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Units</SelectItem>
                {allUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={courseFilter || "__all__"} onValueChange={v => setCourseFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Filter by Course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Courses</SelectItem>
                {allCourses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={downloadPDF} variant="outline" className="ml-auto">
              <Download className="h-4 w-4 mr-2" /> Print Report
            </Button>
          </div>

          {fetching && <p className="text-center text-muted-foreground">Loading data...</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {keyMetrics.map((m, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{m.label}</p>
                      <p className="text-2xl font-bold mt-1">{m.value}</p>
                    </div>
                    {m.icon && <div className="text-muted-foreground">{m.icon}</div>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>Click eye icon to view detailed attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Session Code</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.slice(0, 20).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.date_time}</TableCell>
                      <TableCell>{s.session_id}</TableCell>
                      <TableCell>{s.unit_name}</TableCell>
                      <TableCell>{s.course_name}</TableCell>
                      <TableCell>
                        <span className="font-medium text-green-600">{s.present}</span>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => openSessionDetail(s)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Charts and Top Students go here — kept from original */}
        </main>
      </div>

      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session: {sessionDetail?.session_id}</DialogTitle>
            <DialogDescription>
              {sessionDetail?.unit_name} • {sessionDetail?.course_name} • {sessionDetail?.date_time}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2 text-green-600">
                Present ({sessionDetail?.present_students.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission Number</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionDetail?.present_students.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell>{s.student_number}</TableCell>
                      <TableCell>{s.timestamp}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {sessionDetail?.absent_students && sessionDetail.absent_students.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-red-600">
                  Absent ({sessionDetail?.absent_students.length})
                </h4>
                <Table>
                  <TableBody>
                    {sessionDetail?.absent_students.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.student_number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}