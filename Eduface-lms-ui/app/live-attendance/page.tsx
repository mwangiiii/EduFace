"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Search, Filter, Play, StopCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"

interface UserProfile {
  first_name: string
  last_name: string
  role: string
  id: string
}

interface AttendanceRecord {
  id: string
  student_name: string
  student_id: string
  confidence: number
  status: string
  time: string
  photo?: string
}

interface SessionOption {
  id: string
  session_id: string
  course_name: string
  date_time: string
  status: string
  room?: string
  access_code?: string
}

export default function LiveAttendancePage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<SessionOption | null>(null)
  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<number>(0)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$'

  const generateCode = (length = 6): string => {
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

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

        if (profileError || !profile || profile.role !== 'teacher') {
          console.error('Profile fetch error or not a teacher:', profileError)
          return
        }

        setUserProfile(profile)
        await fetchTeacherSessions(profile.id)
      } catch (error) {
        console.error('Unexpected error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [])

  const fetchTeacherSessions = async (userId: string) => {
    setDataLoading(true)
    try {
      // Get teacher's ID
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!teacher) return

      const teacherId = teacher.id
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]

      // Get teacher's units -> course_ids
      const { data: units } = await supabase
        .from('units')
        .select('course_id')
        .eq('teacher_id', teacherId)

      const courseIds = [...new Set(units?.map(u => u.course_id) || [])]

      if (courseIds.length === 0) return

      // Fetch today's sessions for teacher's courses, with details
      const { data: sessionData } = await supabase
        .from('attendance_sessions')
        .select(`
          id, session_id, date_time, status, room, access_code,
          courses!inner(name)
        `)
        .in('course_id', courseIds)
        .gte('date_time', `${today}T00:00:00Z`)
        .lt('date_time', `${tomorrow}T00:00:00Z`)
        .order('date_time', { ascending: true })

      const sessionOptions: SessionOption[] = (sessionData || []).map(s => ({
        id: s.id,
        session_id: s.session_id,
        course_name: s.courses?.name || 'Unknown Course',
        date_time: new Date(s.date_time).toLocaleString(),
        status: s.status,
        room: s.room,
        access_code: s.access_code
      }))

      setSessions(sessionOptions)

      // Auto-select first 'scheduled' session if available
      const scheduledSession = sessionOptions.find(s => s.status === 'scheduled')
      if (scheduledSession && !selectedSessionId) {
        setSelectedSessionId(scheduledSession.id)
        setSelectedSession(scheduledSession)
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setDataLoading(false)
    }
  }

  const startSession = async () => {
    if (!selectedSessionId) return

    try {
      // Generate unique access code if not already present
      if (!selectedSession?.access_code) {
        let code: string
        let unique = false
        while (!unique) {
          code = generateCode()
          const { data: existing } = await supabase
            .from('attendance_sessions')
            .select('id')
            .eq('access_code', code)
            .maybeSingle()
          if (!existing) {
            unique = true
          }
        }
        const { error: codeError } = await supabase
          .from('attendance_sessions')
          .update({ access_code: code })
          .eq('id', selectedSessionId)
        if (codeError) {
          console.error('Error generating access code:', codeError)
          return
        }
        setSelectedSession(prev => prev ? { ...prev, access_code: code } : prev)
      }

      // Update session status to 'in_progress'
      const { error: updateError } = await supabase
        .from('attendance_sessions')
        .update({ status: 'in_progress' })
        .eq('id', selectedSessionId)

      if (updateError) {
        console.error('Error starting session:', updateError)
        return
      }

      // Refresh selected session status
      setSelectedSession(prev => prev ? { ...prev, status: 'in_progress' } : prev)
      setIsSessionActive(true)

      // Fetch attendance data after starting
      await fetchAttendanceForSession(selectedSessionId)
    } catch (error) {
      console.error('Unexpected error starting session:', error)
    }
  }

  const endSession = async () => {
    if (!selectedSessionId) return

    try {
      // Update session status to 'completed'
      const { error: updateError } = await supabase
        .from('attendance_sessions')
        .update({ status: 'completed' })
        .eq('id', selectedSessionId)

      if (updateError) {
        console.error('Error ending session:', updateError)
        return
      }

      // Refresh selected session status
      setSelectedSession(prev => prev ? { ...prev, status: 'completed' } : prev)
      setIsSessionActive(false)
    } catch (error) {
      console.error('Unexpected error ending session:', error)
    }
  }

  const fetchAttendanceForSession = async (sessionId: string) => {
    setDataLoading(true)
    try {
      // Get session details to fetch course_id
      const { data: session } = await supabase
        .from('attendance_sessions')
        .select('course_id, status')
        .eq('id', sessionId)
        .single()

      if (!session) return

      const courseId = session.course_id
      const currentStatus = session.status

      // Fetch enrolled students for the course (active)
      const { count: enrolledCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId)
        .eq('status', 'active')

      setEnrolledStudents(enrolledCount || 0)

      // If session not in_progress, no records yet
      if (currentStatus !== 'in_progress') {
        setAttendanceData([])
        setDataLoading(false)
        return
      }

      // Fetch attendance records for this session
      const { data: records } = await supabase
        .from('attendance_records')
        .select(`
          id, confidence_score, status, timestamp,
          students!inner(student_id),
          students(user_id),
          users!inner(first_name, last_name)
        `)
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })

      // Build attendance data: present/late from records, absent = enrolled - records
      const presentRecords: AttendanceRecord[] = (records || []).map(r => ({
        id: r.id,
        student_name: `${r.users?.first_name || ''} ${r.users?.last_name || ''}`.trim() || 'Unknown Student',
        student_id: r.students?.student_id || '',
        confidence: Math.round((r.confidence_score || 0) * 100),
        status: r.status || 'present',
        time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        photo: getStudentPhoto(r.users?.first_name?.[0] || '', r.users?.last_name?.[0] || '')
      })).filter(r => r.status === 'present' || r.status === 'late')

      // For absent: all enrolled not in records
      const { data: allEnrollments } = await supabase
        .from('enrollments')
        .select(`
          id,
          students!inner(student_id),
          students(user_id),
          users!inner(first_name, last_name)
        `)
        .eq('course_id', courseId)
        .eq('status', 'active')

      const presentStudentIds = presentRecords.map(p => p.student_id)
      const absentStudents = (allEnrollments || [])
        .filter(e => !presentStudentIds.includes(e.students?.student_id || ''))
        .map(e => ({
          id: `absent-${e.id}`,
          student_name: `${e.users?.first_name || ''} ${e.users?.last_name || ''}`.trim() || 'Unknown Student',
          student_id: e.students?.student_id || '',
          confidence: 0,
          status: 'absent',
          time: '—',
          photo: getStudentPhoto(e.users?.first_name?.[0] || '', e.users?.last_name?.[0] || '')
        }))

      const fullData = [...presentRecords, ...absentStudents]
      setAttendanceData(fullData)
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      setDataLoading(false)
    }
  }

  const getStudentPhoto = (firstInitial: string, lastInitial: string): string => {
    const initials = `${firstInitial || ''}${lastInitial || ''}`.toUpperCase()
    const emojiMap: { [key: string]: string } = {
      'AJ': '👩‍🦰', 'BS': '👨‍🦱', 'CD': '👩‍🦱', 'DM': '👨‍🦲', 'EW': '👩‍🦳', 'FT': '👨‍🦳'
    }
    return emojiMap[initials] || '👤'
  }

  useEffect(() => {
    if (selectedSessionId) {
      const session = sessions.find(s => s.id === selectedSessionId)
      setSelectedSession(session || null)
      setIsSessionActive(session?.status === 'in_progress')
      fetchAttendanceForSession(selectedSessionId)
    }
  }, [selectedSessionId, sessions])

  const filtered = attendanceData.filter((student) => {
    const matchesSearch = student.student_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === "all" || student.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const presentCount = attendanceData.filter((s) => s.status === "present" || s.status === "late").length
  const absentCount = attendanceData.filter((s) => s.status === "absent").length
  const attendanceRate = enrolledStudents > 0 ? Math.round((presentCount / enrolledStudents) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Access denied. Please log in as a teacher.</div>
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
            <h1 className="text-3xl font-bold mb-2">Live Attendance</h1>
            <p className="text-muted-foreground">Real-time attendance tracking</p>
          </div>

          {/* Session Selector */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Select Session</CardTitle>
              <CardDescription>Choose a session to monitor attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedSessionId || ''} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.course_name} - {session.session_id} ({new Date(session.date_time).toLocaleTimeString()})
                      {session.status !== 'scheduled' && (
                        <Badge variant="secondary" className="ml-2">{session.status}</Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dataLoading && <p className="text-sm text-muted-foreground mt-2">Loading attendance data...</p>}
            </CardContent>
          </Card>

          {selectedSession && (
            <>
              {/* Session Controls */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Session Controls</CardTitle>
                  <CardDescription>Start or end the attendance session for {selectedSession.course_name}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">Session Access Code (Share with students):</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-mono text-sm">{selectedSession.access_code || 'Generating...'}</Badge>
                    </div>
                    {selectedSession.room && (
                      <p className="text-xs text-muted-foreground mt-1">Room: {selectedSession.room}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!isSessionActive ? (
                      <Button onClick={startSession} disabled={dataLoading}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Attendance
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" onClick={fetchAttendanceForSession.bind(null, selectedSession.id)} disabled={dataLoading}>
                          Refresh
                        </Button>
                        <Button variant="destructive" onClick={endSession}>
                          <StopCircle className="h-4 w-4 mr-2" />
                          End Session
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-500">{presentCount}</div>
                      <p className="text-sm text-muted-foreground">Present</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-500">{absentCount}</div>
                      <p className="text-sm text-muted-foreground">Absent</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{attendanceRate}%</div>
                      <p className="text-sm text-muted-foreground">Attendance Rate</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Student List */}
              <Card>
                <CardHeader>
                  <CardTitle>Student List</CardTitle>
                  <CardDescription>Real-time recognition data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-6">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-40">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Student</th>
                          <th className="text-left py-3 px-4 font-medium">Confidence</th>
                          <th className="text-left py-3 px-4 font-medium">Status</th>
                          <th className="text-left py-3 px-4 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((student) => (
                          <tr key={student.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{student.photo}</span>
                                <span className="font-medium">{student.student_name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {['present', 'late'].includes(student.status) ? `${student.confidence}%` : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={['present', 'late'].includes(student.status) ? "default" : "secondary"}
                                className={['present', 'late'].includes(student.status) ? "bg-green-500" : "bg-red-500"}
                              >
                                {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">{student.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filtered.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        {isSessionActive ? 'No students matching the criteria.' : 'Start the session to view attendance.'}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {!isSessionActive && selectedSession && (
                <Alert className="mt-6">
                  <Play className="h-4 w-4" />
                  <AlertDescription>
                    Click "Start Attendance" to begin the session. Share the Session Access Code with students.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}