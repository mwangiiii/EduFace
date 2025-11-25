"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Calendar, UserCheck, UserX, AlertCircle, Clock } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"

interface Unit {
  id: string
  name: string
  course_name: string
}

interface Session {
  id: string
  date_time: string
  status: "in_progress" | "completed" | "scheduled"
}

interface AttendanceRecord {
  session_id: string
  status: "present" | "late" | "absent"
  timestamp: string
  confidence_score: number
}

export default function MyAttendancePage() {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<"week" | "month" | "all">("all")

  const [sessions, setSessions] = useState<Session[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch user → student UUID
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const { data: profile } = await supabase
          .from("users")
          .select("role, first_name, last_name")
          .eq("id", user.id)
          .single()

        if (profile?.role !== "student") {
          setError("This page is only for students")
          setLoading(false)
          return
        }

        const { data: student } = await supabase
          .from("students")
          .select("id")
          .eq("user_id", user.id)
          .single()

        if (!student) throw new Error("Student profile not found")

        setUserProfile(profile)
        setStudentId(student.id)
      } catch (err: any) {
        setError(err.message || "Failed to load profile")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Fetch student's enrolled units
  // Fetch student's enrolled units — FINAL WORKING VERSION
useEffect(() => {
  if (!studentId) return

  const fetchUnits = async () => {
    try {
      // Step 1: Get all active enrollments for this student
      const { data: enrollments, error: e1 } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", studentId)
        .eq("status", "active")

      if (e1 || !enrollments?.length) {
        console.log("No active enrollments", e1)
        setUnits([])
        return
      }

      const courseIds = enrollments.map(e => e.course_id)

      // Step 2: Get units + course name in one flat query
      const { data: unitsData, error: e2 } = await supabase
        .from("units")
        .select(`
          id,
          name,
          course_id,
          courses!inner (
            id,
            name
          )
        `)
        .in("course_id", courseIds)

      if (e2) {
        console.error("Units query error:", e2)
        setUnits([])
        return
      }

      console.log("Raw units from Supabase:", unitsData)

      const formatted: Unit[] = (unitsData || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        course_name: u.courses.name
      }))

      setUnits(formatted)

      if (formatted.length > 0 && !selectedUnitId) {
        setSelectedUnitId(formatted[0].id)
      }
    } catch (err) {
      console.error("fetchUnits error:", err)
    }
  }

  fetchUnits()
}, [studentId])

  // Fetch attendance data
  useEffect(() => {
    if (!studentId || !selectedUnitId) return

    const fetchAttendance = async () => {
      setDataLoading(true)
      setError(null)

      try {
        // Determine date range
        const now = new Date()
        let startDate = new Date()

        if (timeRange === "week") {
          startDate.setDate(now.getDate() - 7)
        } else if (timeRange === "month") {
          startDate.setDate(now.getDate() - 30)
        } else {
          startDate.setFullYear(now.getFullYear() - 2) // 2 years of history
        }

        startDate.setHours(0, 0, 0, 0)
        const startIso = startDate.toISOString()

        // Fetch sessions for this unit in range
        const { data: sessionList } = await supabase
          .from("attendance_sessions")
          .select("id, date_time, status")
          .eq("unit_id", selectedUnitId)
          .gte("date_time", startIso)
          .order("date_time", { ascending: true })

        if (!sessionList?.length) {
          setSessions([])
          setRecords([])
          setDataLoading(false)
          return
        }

        setSessions(sessionList)

        const sessionIds = sessionList.map(s => s.id)

        // Fetch this student's records
        const { data: recordList } = await supabase
          .from("attendance_records")
          .select("session_id, status, timestamp, confidence_score")
          .eq("student_id", studentId)
          .in("session_id", sessionIds)

        setRecords(recordList || [])
      } catch (err: any) {
        setError("Failed to load attendance data")
        console.error(err)
      } finally {
        setDataLoading(false)
      }
    }

    fetchAttendance()
  }, [studentId, selectedUnitId, timeRange])

  // Compute stats & chart
  const { stats, chartData, recent } = useMemo(() => {
    const completedSessions = sessions.filter(s => s.status === "completed")
    const recordMap = new Map(records.map(r => [r.session_id, r]))

    let present = 0, late = 0, absent = 0
    const daily: { [date: string]: number } = {}

    completedSessions.forEach(session => {
      const dateStr = new Date(session.date_time).toISOString().split("T")[0]
      daily[dateStr] = (daily[dateStr] || 0)

      const rec = recordMap.get(session.id)
      if (rec?.status === "present") {
        present++
        daily[dateStr]++
      } else if (rec?.status === "late") {
        late++
        daily[dateStr]++
      } else {
        absent++
      }
    })

    const total = present + late + absent
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0

    // Chart data
    const chart: { date: string; present: number }[] = []
    if (timeRange === "week") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      const today = new Date()
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        const key = d.toISOString().split("T")[0]
        chart.push({ date: days[d.getDay()], present: daily[key] || 0 })
      }
    } else {
      // Weekly grouping
      const weeks: { [week: string]: number } = {}
      Object.entries(daily).forEach(([dateStr, count]) => {
        const d = new Date(dateStr)
        d.setDate(d.getDate() - d.getDay())
        const weekKey = d.toISOString().split("T")[0]
        weeks[weekKey] = (weeks[weekKey] || 0) + count
      })
      Object.keys(weeks).sort().forEach(week => {
        const d = new Date(week)
        chart.push({
          date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          present: weeks[week]
        })
      })
    }

    // Recent 10 sessions
    const recentList = sessions.slice(0, 10).map(session => {
      const rec = recordMap.get(session.id)
      const date = new Date(session.date_time).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })

      if (!rec) {
        return { date, status: "Absent", time: "—", confidence: "—" }
      }

      return {
        date,
        status: rec.status.charAt(0).toUpperCase() + rec.status.slice(1),
        time: new Date(rec.timestamp).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit"
        }),
        confidence: `${Math.round(rec.confidence_score * 100)}%`
      }
    })

    return {
      stats: { present, late, absent, rate },
      chartData: chart,
      recent: recentList
    }
  }, [sessions, records, timeRange])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !userProfile || userProfile.role !== "student") {
    return (
      <div className="flex items-center justify-center min-h-screen text-center">
        <div>
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-medium">{error || "Access denied. Students only."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Attendance</h1>
        <p className="text-muted-foreground">Welcome back, {userProfile.first_name}!</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">Unit</label>
          <Select value={selectedUnitId || ""} onValueChange={setSelectedUnitId}>
  <SelectTrigger className="w-full md:w-96">
    <SelectValue placeholder="Select a unit..." />
  </SelectTrigger>
  <SelectContent>
    {units.length === 0 ? (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No units found
      </div>
    ) : (
      units.map(unit => (
        <SelectItem key={unit.id} value={unit.id}>
          {unit.name} — {unit.course_name}
        </SelectItem>
      ))
    )}
  </SelectContent>
</Select>
        </div>

        <div className="flex gap-2 items-end">
          <Button
            variant={timeRange === "week" ? "default" : "outline"}
            onClick={() => setTimeRange("week")}
          >
            Week
          </Button>
          <Button
            variant={timeRange === "month" ? "default" : "outline"}
            onClick={() => setTimeRange("month")}
          >
            Month
          </Button>
          <Button
            variant={timeRange === "all" ? "default" : "outline"}
            onClick={() => setTimeRange("all")}
          >
            All Time
          </Button>
        </div>
      </div>

      {!selectedUnitId ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">Select a unit to view your attendance</p>
          </CardContent>
        </Card>
      ) : dataLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Present</p>
                    <p className="text-3xl font-bold text-green-600">{stats.present}</p>
                  </div>
                  <UserCheck className="h-10 w-10 text-green-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Late</p>
                    <p className="text-3xl font-bold text-amber-600">{stats.late}</p>
                  </div>
                  <Clock className="h-10 w-10 text-amber-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Absent</p>
                    <p className="text-3xl font-bold text-red-600">{stats.absent}</p>
                  </div>
                  <UserX className="h-10 w-10 text-red-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Attendance Rate</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.rate}%</p>
                  </div>
                  <div className="text-5xl">→</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trend</CardTitle>
              <CardDescription>
                {timeRange === "week" ? "This week" : timeRange === "month" ? "Last 30 days" : "Long-term trend"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">No data in selected range</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload?.[0]) {
                          return (
                            <div className="bg-white p-3 border rounded shadow-lg">
                              <p className="font-medium">{payload[0].payload.date}</p>
                              <p className="text-green-600">Present: {payload[0].value}</p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="present"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ fill: "#10b981", r: 6 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Recent Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>Your latest attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Time</th>
                      <th className="pb-3">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-muted-foreground">
                          No sessions yet
                        </td>
                      </tr>
                    ) : (
                      recent.map((r, i) => (
                        <tr key={i} className="border-b hover:bg-muted/50 transition">
                          <td className="py-4 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {r.date}
                          </td>
                          <td className="py-4">
                            <Badge
                              variant={
                                r.status === "Present" ? "default" :
                                r.status === "Late" ? "secondary" :
                                "destructive"
                              }
                              className={
                                r.status === "Present" ? "bg-green-600" :
                                r.status === "Late" ? "bg-amber-600" :
                                "bg-red-600"
                              }
                            >
                              {r.status}
                            </Badge>
                          </td>
                          <td className="py-4 text-muted-foreground">{r.time}</td>
                          <td className="py-4 font-medium">{r.confidence}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}