"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Calendar, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function MyAttendancePage() {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [studentUUID, setStudentUUID] = useState<string | null>(null)

  const [presentCount, setPresentCount] = useState(0)
  const [lateCount, setLateCount] = useState(0)
  const [absentCount, setAbsentCount] = useState(0)
  const [attendanceRate, setAttendanceRate] = useState("0%")
  const [chartData, setChartData] = useState<{ date: string; present: number }[]>([])
  const [recentAttendance, setRecentAttendance] = useState<any[]>([])

  const [availableUnits, setAvailableUnits] = useState<any[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('all')

  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch authenticated user → profile → student UUID
  useEffect(() => {
    const fetchUserAndStudent = async () => {
      try {
        setError(null)
        
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) {
          setError("No authenticated user found")
          setLoading(false)
          return
        }

        console.log("Authenticated user ID:", user.id)

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id, first_name, last_name, role')
          .eq('id', user.id)
          .single()

        if (profileError) throw profileError
        console.log("User profile:", profile)

        if (!profile || profile.role !== 'student') {
          setUserProfile(profile || null)
          setLoading(false)
          return
        }

        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id, student_id, user_id')
          .eq('user_id', user.id)
          .single()

        if (studentError) throw studentError
        console.log("Student record:", student)

        setUserProfile(profile)
        setStudentUUID(student?.id || null)
        
      } catch (err: any) {
        console.error("Error fetching user/student:", err)
        setError(err.message || "Failed to load user data")
      } finally {
        setLoading(false)
      }
    }

    fetchUserAndStudent()
  }, [])

  // Fetch available units for the student
  useEffect(() => {
    if (!studentUUID) return

    const fetchUnits = async () => {
      try {
        // Get enrolled courses
        const { data: enrollments, error: enrollError } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', studentUUID)

        if (enrollError) throw enrollError
        
        const courseIds = enrollments?.map(e => e.course_id) || []
        if (courseIds.length === 0) return

        // Get units with course names
        const { data: units, error: unitsError } = await supabase
          .from('units')
          .select(`
            id,
            unit_id,
            name,
            course_id,
            courses!inner(name)
          `)
          .in('course_id', courseIds)

        if (unitsError) throw unitsError
        
        console.log("Available units:", units)
        setAvailableUnits(units || [])
        
        // Auto-select first unit if available
        if (units && units.length > 0 && !selectedUnitId) {
          setSelectedUnitId(units[0].id)
        }
        
      } catch (err: any) {
        console.error("Error fetching units:", err)
      }
    }

    fetchUnits()
  }, [studentUUID])

  // Fetch attendance data when unit or time range changes
  useEffect(() => {
    if (!studentUUID || !selectedUnitId) return

    const fetchAttendance = async () => {
      setStatsLoading(true)
      setError(null)
      
      try {
        console.log("Fetching attendance for student:", studentUUID, "unit:", selectedUnitId)

        const now = new Date()
        let startDate = new Date()
        
        if (timeRange === 'week') {
          const dayOfWeek = startDate.getDay()
          startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        } else if (timeRange === 'month') {
          startDate.setDate(startDate.getDate() - 30)
        } else {
          // All time - go back 1 year
          startDate.setFullYear(startDate.getFullYear() - 1)
        }
        
        startDate.setHours(0, 0, 0, 0)
        const startIso = startDate.toISOString()
        const nowIso = now.toISOString()

        console.log("Date range:", startIso, "to", nowIso)

        // Get all sessions for this unit in date range
        const { data: sessions, error: sessionsError } = await supabase
          .from('attendance_sessions')
          .select('id, date_time, status')
          .eq('unit_id', selectedUnitId)
          .gte('date_time', startIso)
          .lte('date_time', nowIso)
          .order('date_time', { ascending: false })

        if (sessionsError) throw sessionsError
        console.log("Sessions found:", sessions?.length || 0, sessions)

        if (!sessions || sessions.length === 0) {
          console.log("No sessions found for this unit in date range")
          setPresentCount(0)
          setLateCount(0)
          setAbsentCount(0)
          setAttendanceRate("0%")
          setChartData([])
          setRecentAttendance([])
          setStatsLoading(false)
          return
        }

        const sessionIds = sessions.map(s => s.id)

        // Get student's attendance records for these sessions
        const { data: records, error: recordsError } = await supabase
          .from('attendance_records')
          .select('session_id, status, timestamp, confidence_score')
          .eq('student_id', studentUUID)
          .in('session_id', sessionIds)

        if (recordsError) throw recordsError
        console.log("Attendance records found:", records?.length || 0, records)

        const recordMap = new Map(records?.map(r => [r.session_id, r]) || [])

        // Calculate stats
        let present = 0
        let late = 0
        let absent = 0
        const dailyPresent: { [date: string]: number } = {}

        sessions.forEach(session => {
          // Only count completed sessions
          if (session.status !== 'completed') return

          const dateStr = new Date(session.date_time).toISOString().split('T')[0]
          if (!dailyPresent[dateStr]) dailyPresent[dateStr] = 0

          const rec = recordMap.get(session.id)
          if (rec) {
            if (rec.status === 'present') {
              present++
              dailyPresent[dateStr]++
            } else if (rec.status === 'late') {
              late++
              dailyPresent[dateStr]++
            } else if (rec.status === 'absent') {
              absent++
            }
          } else {
            // No record = absent
            absent++
          }
        })

        const completedSessions = sessions.filter(s => s.status === 'completed').length
        const rate = completedSessions > 0 ? Math.round(((present + late) / completedSessions) * 100) : 0

        console.log("Stats - Present:", present, "Late:", late, "Absent:", absent, "Rate:", rate + "%")

        setPresentCount(present)
        setLateCount(late)
        setAbsentCount(absent)
        setAttendanceRate(`${rate}%`)

        // Build chart data
        const trend: { date: string; present: number }[] = []
        
        if (timeRange === 'week') {
          let currentDate = new Date(startDate)
          while (currentDate <= now) {
            const dateStr = currentDate.toISOString().split('T')[0]
            const short = currentDate.toLocaleDateString('en-US', { weekday: 'short' })
            trend.push({ date: short, present: dailyPresent[dateStr] || 0 })
            currentDate.setDate(currentDate.getDate() + 1)
          }
        } else {
          // Group by week for month/all view
          const weeks: { [weekStart: string]: number } = {}
          Object.entries(dailyPresent).forEach(([dateStr, count]) => {
            const date = new Date(dateStr)
            const weekStart = new Date(date)
            weekStart.setDate(date.getDate() - date.getDay())
            const weekKey = weekStart.toISOString().split('T')[0]
            weeks[weekKey] = (weeks[weekKey] || 0) + count
          })
          
          Object.entries(weeks).sort().forEach(([weekStr, count]) => {
            const weekDate = new Date(weekStr)
            const label = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            trend.push({ date: label, present: count })
          })
        }
        
        setChartData(trend)

        // Recent 10 sessions (all statuses)
        const recent = sessions.slice(0, 10).map(session => {
          const rec = recordMap.get(session.id)
          const date = new Date(session.date_time).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          })
          
          if (!rec && session.status !== 'completed') {
            return { 
              date, 
              status: session.status === 'scheduled' ? 'Scheduled' : 
                      session.status === 'in_progress' ? 'In Progress' : 'Cancelled',
              time: "—", 
              confidence: "—" 
            }
          }
          
          if (!rec) {
            return { date, status: "Absent", time: "—", confidence: "—" }
          }
          
          return {
            date,
            status: rec.status.charAt(0).toUpperCase() + rec.status.slice(1),
            time: new Date(rec.timestamp).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit' 
            }),
            confidence: `${(rec.confidence_score * 100).toFixed(1)}%`
          }
        })
        
        setRecentAttendance(recent)

      } catch (err: any) {
        console.error("Error fetching attendance:", err)
        setError(err.message || "Failed to load attendance data")
      } finally {
        setStatsLoading(false)
      }
    }

    fetchAttendance()
  }, [studentUUID, selectedUnitId, timeRange])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p className="font-semibold mb-2">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!userProfile || userProfile.role !== 'student') {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        {!userProfile ? 'Please log in.' : 'This page is only available to students.'}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Attendance</h1>
        <p className="text-muted-foreground">Track your attendance across all units</p>
      </div>

      {/* Unit Selector */}
      {availableUnits.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Unit</label>
          <select
            value={selectedUnitId || ''}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableUnits.map(unit => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({unit.courses.name})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Time Range Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTimeRange('week')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            timeRange === 'week'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          This Week
        </button>
        <button
          onClick={() => setTimeRange('month')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            timeRange === 'month'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Last 30 Days
        </button>
        <button
          onClick={() => setTimeRange('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            timeRange === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Time
        </button>
      </div>

      {!selectedUnitId ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No units available. Please enroll in a course first.</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {statsLoading ? '...' : presentCount}
                </div>
                <p className="text-sm text-muted-foreground">Present</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-amber-600">
                  {statsLoading ? '...' : lateCount}
                </div>
                <p className="text-sm text-muted-foreground">Late</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-red-600">
                  {statsLoading ? '...' : absentCount}
                </div>
                <p className="text-sm text-muted-foreground">Absent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {statsLoading ? '...' : attendanceRate}
                </div>
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Attendance Trend</CardTitle>
              <CardDescription>
                {timeRange === 'week' 
                  ? 'Daily attendance this week' 
                  : 'Weekly attendance over time'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="present" 
                      stroke="#10b981" 
                      strokeWidth={3} 
                      dot={{ fill: '#10b981' }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No attendance data available for selected time range
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Records */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>Latest class sessions for this unit</CardDescription>
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
                    {recentAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-muted-foreground">
                          No sessions found
                        </td>
                      </tr>
                    ) : (
                      recentAttendance.map((r, i) => (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {r.date}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                r.status === "Absent" ? "destructive" : 
                                r.status === "Late" ? "secondary" : 
                                "default"
                              }
                              className={
                                r.status === "Present" ? "bg-green-600 text-white" :
                                r.status === "Late" ? "bg-amber-600 text-white" :
                                r.status === "Absent" ? "bg-red-600 text-white" :
                                "bg-gray-500 text-white"
                              }
                            >
                              {r.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">{r.time}</td>
                          <td className="py-3 px-4">{r.confidence}</td>
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