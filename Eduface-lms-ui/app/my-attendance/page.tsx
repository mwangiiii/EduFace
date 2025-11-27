"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Calendar, UserCheck, UserX, AlertCircle, Clock, Filter } from "lucide-react"
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
  id: string
  student_id: string
  session_id: string
  status: "present" | "late" | "absent"
  timestamp: string
  confidence_score: number
  created_at: string
}

export default function MyAttendancePage() {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<"week" | "month" | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "late" | "absent">("all")

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
  useEffect(() => {
    if (!studentId) return

    const fetchUnits = async () => {
      try {
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
  const fetchAttendance = async () => {
    if (!studentId || !selectedUnitId) return

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
        startDate.setFullYear(now.getFullYear() - 2)
      }

      startDate.setHours(0, 0, 0, 0)
      const startIso = startDate.toISOString()

      // Fetch sessions for this unit in range
      const { data: sessionList, error: sessionsError } = await supabase
        .from("attendance_sessions")
        .select("id, date_time, status")
        .eq("unit_id", selectedUnitId)
        .gte("date_time", startIso)
        .order("date_time", { ascending: false })

      if (sessionsError) {
        console.error("Sessions error:", sessionsError)
        setSessions([])
        setRecords([])
        setDataLoading(false)
        return
      }

      if (!sessionList?.length) {
        setSessions([])
        setRecords([])
        setDataLoading(false)
        return
      }

      setSessions(sessionList)

      const sessionIds = sessionList.map(s => s.id)

      // Fetch this student's attendance records for these sessions
      const { data: recordList, error: recordsError } = await supabase
        .from("attendance_records")
        .select("id, student_id, session_id, status, timestamp, confidence_score, created_at")
        .eq("student_id", studentId)
        .in("session_id", sessionIds)
        .order("timestamp", { ascending: false })

      if (recordsError) {
        console.error("Records error:", recordsError)
        setRecords([])
      } else {
        setRecords(recordList || [])
      }
    } catch (err: any) {
      setError("Failed to load attendance data")
      console.error(err)
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => {
    fetchAttendance()
  }, [studentId, selectedUnitId, timeRange])

  // Real-time subscription for new attendance records
  useEffect(() => {
    if (!studentId) return

    console.log("Setting up real-time subscription for student:", studentId)

    const channel = supabase
      .channel('attendance_records_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_records',
          filter: `student_id=eq.${studentId}`
        },
        (payload) => {
          console.log("New attendance record received:", payload)
          
          // Add the new record to our state
          const newRecord = payload.new as AttendanceRecord
          
          // Check if this record is for the currently selected unit's sessions
          if (sessions.some(s => s.id === newRecord.session_id)) {
            setRecords(prev => [newRecord, ...prev])
            
            // Optional: Show a notification
            console.log(`New ${newRecord.status} record added at ${newRecord.timestamp}`)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'attendance_records',
          filter: `student_id=eq.${studentId}`
        },
        (payload) => {
          console.log("Attendance record updated:", payload)
          
          const updatedRecord = payload.new as AttendanceRecord
          
          setRecords(prev => 
            prev.map(r => r.id === updatedRecord.id ? updatedRecord : r)
          )
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status)
      })

    return () => {
      console.log("Cleaning up subscription")
      supabase.removeChannel(channel)
    }
  }, [studentId, sessions])

  // Compute stats & chart with status filter
  const { stats, chartData, recent, filteredRecords } = useMemo(() => {
    const completedSessions = sessions.filter(s => s.status === "completed")
    const recordMap = new Map(records.map(r => [r.session_id, r]))

    let present = 0, late = 0, absent = 0
    const daily: { [date: string]: { present: number; late: number; absent: number } } = {}

    completedSessions.forEach(session => {
      const dateStr = new Date(session.date_time).toISOString().split("T")[0]
      
      if (!daily[dateStr]) {
        daily[dateStr] = { present: 0, late: 0, absent: 0 }
      }

      const rec = recordMap.get(session.id)
      if (rec?.status === "present") {
        present++
        daily[dateStr].present++
      } else if (rec?.status === "late") {
        late++
        daily[dateStr].late++
      } else {
        absent++
        daily[dateStr].absent++
      }
    })

    const total = present + late + absent
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0

    // Chart data
    const chart: { date: string; present: number; late: number; absent: number }[] = []
    
    if (timeRange === "week") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      const today = new Date()
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        const key = d.toISOString().split("T")[0]
        chart.push({ 
          date: days[d.getDay()], 
          present: daily[key]?.present || 0,
          late: daily[key]?.late || 0,
          absent: daily[key]?.absent || 0
        })
      }
    } else {
      // Weekly grouping
      const weeks: { [week: string]: { present: number; late: number; absent: number } } = {}
      
      Object.entries(daily).forEach(([dateStr, counts]) => {
        const d = new Date(dateStr)
        d.setDate(d.getDate() - d.getDay())
        const weekKey = d.toISOString().split("T")[0]
        
        if (!weeks[weekKey]) {
          weeks[weekKey] = { present: 0, late: 0, absent: 0 }
        }
        
        weeks[weekKey].present += counts.present
        weeks[weekKey].late += counts.late
        weeks[weekKey].absent += counts.absent
      })
      
      Object.keys(weeks).sort().forEach(week => {
        const d = new Date(week)
        chart.push({
          date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          ...weeks[week]
        })
      })
    }

    // Get all records with session info for display
    const allRecordsWithSessions = sessions.map(session => {
      const rec = recordMap.get(session.id)
      const date = new Date(session.date_time).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })

      if (!rec) {
        return { 
          sessionId: session.id,
          date, 
          status: "absent" as const, 
          time: "—", 
          confidence: "—",
          timestamp: session.date_time
        }
      }

      return {
        sessionId: session.id,
        date,
        status: rec.status,
        time: new Date(rec.timestamp).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit"
        }),
        confidence: `${Math.round(rec.confidence_score * 100)}%`,
        timestamp: rec.timestamp
      }
    })

    // Apply status filter
    const filtered = statusFilter === "all" 
      ? allRecordsWithSessions
      : allRecordsWithSessions.filter(r => r.status === statusFilter)

    // Get recent 10
    const recentList = filtered.slice(0, 10).map(r => ({
      ...r,
      status: r.status.charAt(0).toUpperCase() + r.status.slice(1)
    }))

    return {
      stats: { present, late, absent, rate },
      chartData: chart,
      recent: recentList,
      filteredRecords: filtered
    }
  }, [sessions, records, timeRange, statusFilter])

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
      <div className="flex flex-col gap-4">
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

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-medium">Filter by status:</label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
            >
              All ({filteredRecords.length})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "present" ? "default" : "outline"}
              onClick={() => setStatusFilter("present")}
              className={statusFilter === "present" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              Present ({stats.present})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "late" ? "default" : "outline"}
              onClick={() => setStatusFilter("late")}
              className={statusFilter === "late" ? "bg-amber-600 hover:bg-amber-700" : ""}
            >
              Late ({stats.late})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "absent" ? "default" : "outline"}
              onClick={() => setStatusFilter("absent")}
              className={statusFilter === "absent" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              Absent ({stats.absent})
            </Button>
          </div>
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
                  <div className="text-5xl">📊</div>
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
                          const data = payload[0].payload
                          return (
                            <div className="bg-white p-3 border rounded shadow-lg">
                              <p className="font-medium mb-2">{data.date}</p>
                              <p className="text-green-600">Present: {data.present}</p>
                              <p className="text-amber-600">Late: {data.late}</p>
                              <p className="text-red-600">Absent: {data.absent}</p>
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
                      strokeWidth={2}
                      dot={{ fill: "#10b981", r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="late"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: "#f59e0b", r: 4 }}
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
              <CardDescription>
                {statusFilter === "all" 
                  ? "Your latest attendance records"
                  : `Showing ${statusFilter} records only`}
              </CardDescription>
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
                          {statusFilter === "all" ? "No sessions yet" : `No ${statusFilter} records`}
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