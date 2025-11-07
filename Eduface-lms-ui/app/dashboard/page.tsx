"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Users, CheckCircle2, AlertCircle, TrendingUp, Clock, MapPin, Settings, ShieldAlert, FileText, Database, BookOpen } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from 'next/navigation'

interface UserProfile {
  first_name: string
  last_name: string
  role: string
  id: string
}

interface Stat {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

interface UpcomingSession {
  id: string
  session_id: string
  course_name: string
  unit_name?: string
  date_time: string
  duration: string
  room: string | null
  status: string
  teacher_name?: string // For students to see who teaches
}

export default function DashboardPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  // Student states
  const [coursesCount, setCoursesCount] = useState(0)
  const [presentToday, setPresentToday] = useState(0)
  const [absentToday, setAbsentToday] = useState(0)
  const [attendanceRate, setAttendanceRate] = useState("0%")
  // Teacher states
  const [teacherCoursesCount, setTeacherCoursesCount] = useState(0)
  const [teacherPresentToday, setTeacherPresentToday] = useState(0)
  const [teacherAbsentToday, setTeacherAbsentToday] = useState(0)
  const [teacherAttendanceRate, setTeacherAttendanceRate] = useState("0%")
  // Admin states
  const [adminCoursesCount, setAdminCoursesCount] = useState(0)
  const [adminPresentToday, setAdminPresentToday] = useState(0)
  const [adminAbsentToday, setAdminAbsentToday] = useState(0)
  const [adminAttendanceRate, setAdminAttendanceRate] = useState("0%")
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const router = useRouter()

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
    if (!userProfile) return

    const fetchData = async () => {
      setStatsLoading(true)
      try {
        if (userProfile.role === 'student') {
          await fetchStudentStats()
        } else if (userProfile.role === 'teacher') {
          await fetchTeacherStats()
        } else if (userProfile.role === 'administrator') {
          await fetchAdminStats()
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setStatsLoading(false)
      }

      if (userProfile.role === 'student') {
        await fetchUpcomingSessionsForStudent()
      } else if (userProfile.role === 'teacher') {
        await fetchUpcomingSessionsForTeacher()
      }
    }

    fetchData()
  }, [userProfile])

  const fetchStudentStats = async () => {
    const userId = userProfile!.id
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]

    // Fetch enrolled courses count
    const { count: enrollmentsCount } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', userId)

    setCoursesCount(enrollmentsCount || 0)

    // Get enrolled course_ids
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', userId)

    const courseIds = enrollments?.map(e => e.course_id) || []

    if (courseIds.length === 0) {
      setPresentToday(0)
      setAbsentToday(0)
      setAttendanceRate('0%')
      return
    }

    // Fetch today's sessions for enrolled courses
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id')
      .gte('date_time', `${today}T00:00:00Z`)
      .lt('date_time', `${tomorrow}T00:00:00Z`)
      .in('course_id', courseIds)

    const totalSessionsToday = sessions?.length || 0
    const sessionIds = sessions?.map(s => s.id) || []

    // Fetch attendance records for today's sessions
    const { data: records } = await supabase
      .from('attendance_records')
      .select('status')
      .eq('student_id', userId)
      .in('session_id', sessionIds)

    const presentCount = records?.filter(r => r.status === 'present').length || 0
    const absentCount = totalSessionsToday - presentCount

    setPresentToday(presentCount)
    setAbsentToday(absentCount)

    const rate = totalSessionsToday > 0 ? Math.round((presentCount / totalSessionsToday) * 100) : 0
    setAttendanceRate(`${rate}%`)
  }

  const fetchTeacherStats = async () => {
    const userId = userProfile!.id
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]

    // Get teacher's ID
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (!teacher) {
      setTeacherCoursesCount(0)
      setTeacherPresentToday(0)
      setTeacherAbsentToday(0)
      setTeacherAttendanceRate('0%')
      return
    }

    const teacherId = teacher.id

    // Fetch count of assigned units (as "Classes/Courses")
    const { count: unitsCount } = await supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)

    setTeacherCoursesCount(unitsCount || 0)

    // Get teacher's units -> course_ids
    const { data: units } = await supabase
      .from('units')
      .select('course_id')
      .eq('teacher_id', teacherId)

    const courseIds = [...new Set(units?.map(u => u.course_id) || [])] // Distinct courses

    if (courseIds.length === 0) {
      setTeacherPresentToday(0)
      setTeacherAbsentToday(0)
      setTeacherAttendanceRate('0%')
      return
    }

    // Fetch today's sessions for teacher's courses
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id')
      .gte('date_time', `${today}T00:00:00Z`)
      .lt('date_time', `${tomorrow}T00:00:00Z`)
      .in('course_id', courseIds)

    const sessionIds = sessions?.map(s => s.id) || []

    let totalPresent = 0
    let totalExpected = 0

    // For each session, get enrollments count (expected) and present count
    for (const sessionId of sessionIds) {
      // Get session's course_id
      const { data: session } = await supabase
        .from('attendance_sessions')
        .select('course_id')
        .eq('id', sessionId)
        .single()

      if (!session) continue

      // Expected: active enrollments for the course
      const { count: expected } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', session.course_id)
        .eq('status', 'active')

      // Present: records with 'present' for this session
      const { count: present } = await supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .eq('status', 'present')

      totalExpected += expected || 0
      totalPresent += present || 0
    }

    const totalAbsent = totalExpected - totalPresent
    const rate = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0

    setTeacherPresentToday(totalPresent)
    setTeacherAbsentToday(totalAbsent)
    setTeacherAttendanceRate(`${rate}%`)
  }

  const fetchAdminStats = async () => {
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]

    // Fetch total courses count
    const { count: totalCourses } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })

    setAdminCoursesCount(totalCourses || 0)

    // Fetch today's sessions
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id, course_id')
      .gte('date_time', `${today}T00:00:00Z`)
      .lt('date_time', `${tomorrow}T00:00:00Z`)
      .eq('status', 'completed') // Assume only completed sessions have records

    const sessionIds = sessions?.map(s => s.id) || []

    let totalPresent = 0
    let totalExpected = 0

    // For each session, get expected and present
    for (const session of sessions || []) {
      // Expected: active enrollments for the course
      const { count: expected } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', session.course_id)
        .eq('status', 'active')

      // Present: records with 'present' for this session
      const { count: present } = await supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('status', 'present')

      totalExpected += expected || 0
      totalPresent += present || 0
    }

    const totalAbsent = totalExpected - totalPresent
    const rate = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0

    setAdminPresentToday(totalPresent)
    setAdminAbsentToday(totalAbsent)
    setAdminAttendanceRate(`${rate}%`)
  }

  const fetchUpcomingSessionsForStudent = async () => {
    setSessionsLoading(true)
    try {
      const userId = userProfile!.id
      const now = new Date().toISOString()

      // Get enrolled course_ids
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', userId)

      const courseIds = enrollments?.map(e => e.course_id) || []

      if (courseIds.length === 0) return

      // Fetch upcoming sessions for enrolled courses
      const { data: sessions, error: sessionsError } = await supabase
        .from('attendance_sessions')
        .select(`
          id, session_id, date_time, duration, room, status, course_id
        `)
        .in('course_id', courseIds)
        .gt('date_time', now)
        .order('date_time', { ascending: true })
        .limit(10)

      if (sessionsError) {
        console.error('Upcoming sessions fetch error:', sessionsError)
        return
      }

      // For each session, fetch course name, unit name (if any), and teacher name
      const sessionsWithDetails: UpcomingSession[] = await Promise.all(
        (sessions || []).map(async (session) => {
          // Fetch course name
          const { data: course } = await supabase
            .from('courses')
            .select('name')
            .eq('id', session.course_id)
            .single()

          // Fetch unit (assuming one unit per session/course for simplicity; adjust if multiple)
          const { data: unit } = await supabase
            .from('units')
            .select('name, teacher_id')
            .eq('course_id', session.course_id)
            .limit(1)
            .single()

          let teacherName = ''
          if (unit?.teacher_id) {
            const { data: t } = await supabase
              .from('teachers')
              .select('user_id')
              .eq('id', unit.teacher_id)
              .single()
            if (t?.user_id) {
              const { data: u } = await supabase
                .from('users')
                .select('first_name, last_name')
                .eq('id', t.user_id)
                .single()
              teacherName = `${u?.first_name || ''} ${u?.last_name || ''}`.trim()
            }
          }

          return {
            id: session.id,
            session_id: session.session_id,
            course_name: course?.name || 'Unknown Course',
            unit_name: unit?.name || undefined,
            date_time: new Date(session.date_time).toLocaleString(),
            duration: session.duration,
            room: session.room,
            status: session.status,
            teacher_name: teacherName || undefined
          }
        })
      )

      setUpcomingSessions(sessionsWithDetails)
    } catch (error) {
      console.error('Unexpected error fetching upcoming sessions:', error)
    } finally {
      setSessionsLoading(false)
    }
  }

  const fetchUpcomingSessionsForTeacher = async () => {
    setSessionsLoading(true)
    try {
      const userId = userProfile!.id
      const now = new Date().toISOString()

      // Get teacher's ID
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!teacher) return

      const teacherId = teacher.id

      // Get teacher's units and course_ids
      const { data: units } = await supabase
        .from('units')
        .select('id, course_id, name')
        .eq('teacher_id', teacherId)

      const courseIds = [...new Set(units?.map(u => u.course_id) || [])]
      const unitMap = new Map(units?.map(u => [u.course_id, { name: u.name, unitId: u.id }]) || [])

      if (courseIds.length === 0) return

      // Fetch upcoming sessions for teacher's courses
      const { data: sessions, error } = await supabase
        .from('attendance_sessions')
        .select(`
          id, session_id, date_time, duration, room, status, course_id
        `)
        .in('course_id', courseIds)
        .gt('date_time', now)
        .order('date_time', { ascending: true })
        .limit(10)

      if (error) {
        console.error('Upcoming sessions fetch error:', error)
        return
      }

      const sessionsWithDetails: UpcomingSession[] = await Promise.all(
        (sessions || []).map(async (session) => {
          // Fetch course name
          const { data: course } = await supabase
            .from('courses')
            .select('name')
            .eq('id', session.course_id)
            .single()

          const unitInfo = unitMap.get(session.course_id)
          const unit_name = unitInfo?.name

          return {
            id: session.id,
            session_id: session.session_id,
            course_name: course?.name || 'Unknown Course',
            unit_name,
            date_time: new Date(session.date_time).toLocaleString(),
            duration: session.duration,
            room: session.room,
            status: session.status
          }
        })
      )

      setUpcomingSessions(sessionsWithDetails)
    } catch (error) {
      console.error('Unexpected error fetching upcoming sessions:', error)
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleAdminQuickAction = (path: string) => {
    router.push(path)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!userProfile) {
    return <div className="flex items-center justify-center min-h-screen">No profile found. Please log in again.</div>
  }

  const role = userProfile.role

  const stats: Stat[] = [
    {
      title: "Present Today",
      value: role === 'student' ? presentToday.toString() : 
             role === 'teacher' ? teacherPresentToday.toString() : 
             role === 'administrator' ? adminPresentToday.toString() : "0",
      icon: CheckCircle2,
      color: "text-green-500",
    },
    {
      title: "Absent",
      value: role === 'student' ? absentToday.toString() : 
             role === 'teacher' ? teacherAbsentToday.toString() : 
             role === 'administrator' ? adminAbsentToday.toString() : "0",
      icon: AlertCircle,
      color: "text-red-500",
    },
    {
      title: "Classes/Courses",
      value: role === 'student' ? coursesCount.toString() : 
             role === 'teacher' ? teacherCoursesCount.toString() : 
             role === 'administrator' ? adminCoursesCount.toString() : "0",
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Attendance Rate",
      value: role === 'student' ? attendanceRate : 
             role === 'teacher' ? teacherAttendanceRate : 
             role === 'administrator' ? adminAttendanceRate : "0%",
      icon: TrendingUp,
      color: "text-teal-500",
    },
  ]

  const renderUpcomingSessions = () => {
    if (sessionsLoading) {
      return <div className="text-center py-8">Loading upcoming classes...</div>
    }

    if (upcomingSessions.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">No upcoming classes today.</div>
    }

    // Group by date for multi-day view
    const groupedByDate = upcomingSessions.reduce((acc: { [key: string]: UpcomingSession[] }, session) => {
      const dateKey = new Date(session.date_time).toLocaleDateString()
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(session)
      return acc
    }, {})

    return Object.entries(groupedByDate).map(([date, sessions]) => (
      <div key={date} className="mb-6">
        <h3 className="text-lg font-semibold mb-2">{date}</h3>
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h4 className="font-medium">{session.course_name}</h4>
                    {session.unit_name && <p className="text-sm text-muted-foreground">{session.unit_name}</p>}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(session.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {session.duration}</span>
                    </div>
                    {role === 'student' && session.teacher_name && (
                      <p className="text-xs text-muted-foreground">Taught by: {session.teacher_name}</p>
                    )}
                    {session.status === 'scheduled' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        Upcoming
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {session.room && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{session.room}</span>
                      </div>
                    )}
                    {role === 'student' ? (
                      <Button size="sm" variant="outline" onClick={() => {/* Navigate to attendance view */}}>
                        View Attendance
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => {/* Start facial attendance session */}}>
                        Start Attendance
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    ))
  }

  const renderAdminQuickActions = () => (
    <Card>
      <CardHeader>
        <CardTitle>Admin Tools</CardTitle>
        <CardDescription>Quick access to management features</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Button
          variant="outline"
          className="flex flex-col items-center gap-2 p-3 h-auto"
          onClick={() => handleAdminQuickAction('/admin/users')}
        >
          <Users className="h-5 w-5" />
          <span className="text-sm">Users</span>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col items-center gap-2 p-3 h-auto"
          onClick={() => handleAdminQuickAction('/admin/courses')}
        >
          <BookOpen className="h-5 w-5" />
          <span className="text-sm">Courses</span>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col items-center gap-2 p-3 h-auto"
          onClick={() => handleAdminQuickAction('/admin/settings')}
        >
          <Settings className="h-5 w-5" />
          <span className="text-sm">Settings</span>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col items-center gap-2 p-3 h-auto"
          onClick={() => handleAdminQuickAction('/admin/logs')}
        >
          <ShieldAlert className="h-5 w-5" />
          <span className="text-sm">Spoofing Logs</span>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col items-center gap-2 p-3 h-auto"
          onClick={() => handleAdminQuickAction('/admin/audit')}
        >
          <FileText className="h-5 w-5" />
          <span className="text-sm">Audit Logs</span>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col items-center gap-2 p-3 h-auto"
          onClick={() => handleAdminQuickAction('/admin/backup')}
        >
          <Database className="h-5 w-5" />
          <span className="text-sm">Backup</span>
        </Button>
      </CardContent>
    </Card>
  )

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground capitalize">
              Welcome back, {userProfile.first_name} {userProfile.last_name} ({role})
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <Card key={stat.title}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      {stat.title}
                      {statsLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {(role === 'student' || role === 'teacher') && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Upcoming Classes</CardTitle>
                <CardDescription>
                  {role === 'student' ? 'Your enrolled courses and units' : 'Your assigned units and courses'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderUpcomingSessions()}
              </CardContent>
            </Card>
          )}

          {role === "student" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Remember to attend all classes for optimal learning!
              </AlertDescription>
            </Alert>
          )}

          {role === "administrator" && (
            <div className="space-y-6">
              {renderAdminQuickActions()}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>System Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>Camera Status</span>
                      <span className="text-green-500 font-medium">Online</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Database Status</span>
                      <span className="text-green-500 font-medium">Healthy</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Active Sessions</span>
                      <span className="font-medium">128</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Alerts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm p-2 bg-yellow-500/10 rounded">
                      <span className="font-medium">⚠ </span>
                      Spoofing attempt detected in Room 101
                    </div>
                    <div className="text-sm p-2 bg-blue-500/10 rounded">
                      <span className="font-medium">ℹ </span>
                      System backup scheduled tonight
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}