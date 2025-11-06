"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Users, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function DashboardPage() {
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string; role: string; id: string } | null>(null)
  const [coursesCount, setCoursesCount] = useState(0)
  const [presentToday, setPresentToday] = useState(0)
  const [absentToday, setAbsentToday] = useState(0)
  const [attendanceRate, setAttendanceRate] = useState("0%")
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Get the current authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          // Redirect to login if no user (add your router logic here, e.g., via useRouter)
          console.error('Auth error:', authError)
          return
        }

        // Fetch profile from custom 'users' table (include id for queries)
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('first_name, last_name, role, id')
          .eq('id', user.id)
          .single()

        if (profileError || !profile) {
          console.error('Profile fetch error:', profileError)
          // Handle fallback (e.g., show generic message or redirect)
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

    const fetchStudentStats = async () => {
      setStatsLoading(true)
      try {
        const userId = userProfile.id
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
        const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]

        // Fetch enrolled courses count (assuming 'enrollments' table links student_id to course_id)
        const { count: enrollmentsCount } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', userId)

        setCoursesCount(enrollmentsCount || 0)

        // Fetch today's sessions for the student's enrolled courses
        const { data: sessions, error: sessionsError } = await supabase
          .from('attendance_sessions')
          .select('id, course_id')
          .gte('date_time', `${today}T00:00:00Z`)
          .lt('date_time', `${tomorrow}T00:00:00Z`)
          .in('course_id', 
            // Subquery: Get enrolled course_ids
            (await supabase
              .from('enrollments')
              .select('course_id')
              .eq('student_id', userId)
            ).data?.map(enroll => enroll.course_id) || []
          )

        if (sessionsError) {
          console.error('Sessions fetch error:', sessionsError)
          return
        }

        const totalSessionsToday = sessions?.length || 0
        const sessionIds = sessions?.map(s => s.id) || []

        // Fetch attendance records for today's sessions
        const { data: records, error: recordsError } = await supabase
          .from('attendance_records')
          .select('id, status')
          .eq('student_id', userId)
          .in('session_id', sessionIds)

        if (recordsError) {
          console.error('Records fetch error:', recordsError)
          return
        }

        const presentCount = records?.filter(r => r.status === 'present').length || 0
        const absentCount = totalSessionsToday - presentCount // Assumes no record or non-present = absent

        setPresentToday(presentCount)
        setAbsentToday(absentCount)

        const rate = totalSessionsToday > 0 ? Math.round((presentCount / totalSessionsToday) * 100) : 0
        setAttendanceRate(`${rate}%`)
      } catch (error) {
        console.error('Unexpected error fetching stats:', error)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchStudentStats()
  }, [userProfile])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div> // Or a spinner component
  }

  if (!userProfile) {
    return <div className="flex items-center justify-center min-h-screen">No profile found. Please log in again.</div> // Or redirect
  }

  const role = userProfile.role

  // Dynamic stats for student; hardcoded fallback for others
  const stats = [
    {
      title: "Present Today",
      value: role === 'student' ? presentToday.toString() : role === "admin" ? "487" : role === "teacher" ? "45" : "1",
      icon: CheckCircle2,
      color: "text-green-500",
    },
    {
      title: "Absent",
      value: role === 'student' ? absentToday.toString() : role === "admin" ? "23" : role === "teacher" ? "3" : "0",
      icon: AlertCircle,
      color: "text-red-500",
    },
    {
      title: "Classes/Courses",
      value: role === 'student' ? coursesCount.toString() : role === "admin" ? "24" : role === "teacher" ? "6" : "5",
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Attendance Rate",
      value: role === 'student' ? attendanceRate : "92%",
      icon: TrendingUp,
      color: "text-teal-500",
    },
  ]

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
                      {role === 'student' && statsLoading && stat.title.includes('Today') && <span className="text-xs text-muted-foreground">Loading...</span>}
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

          {role === "student" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You haven't captured your facial data yet. Visit the enrollment page to capture your face for attendance
                tracking.
              </AlertDescription>
            </Alert>
          )}

          {role === "teacher" && (
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Today's Classes</CardTitle>
                  <CardDescription>Classes scheduled for today</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {["Mathematics - 9:00 AM", "Physics - 11:30 AM", "Chemistry - 2:00 PM"].map((cls) => (
                      <div key={cls} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm">{cls}</span>
                        <Button size="sm" variant="outline">
                          Start Attendance
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {role === "admin" && (
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
          )}
        </main>
      </div>
    </div>
  )
}