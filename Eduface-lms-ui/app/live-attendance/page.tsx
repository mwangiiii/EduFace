"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Search, Filter, Play, StopCircle, RefreshCw, Users, UserCheck, UserX, AlertCircle } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
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
  status: "present" | "late" | "absent" | "in_progress"
  time: string
  photo?: string
}

interface AllocationOption {
  id: string
  course_name: string
  unit_name: string
  room?: string
  unit_id: string
  course_id: string
  schedule: any
}

interface ActiveSession {
  id: string
  session_id: string
  date_time: string
  status: "in_progress" | "completed"
  room: string
  access_code: string
}

interface Notification {
  id: string
  title: string
  description?: string
  variant: "default" | "destructive"
}

export default function LiveAttendancePage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null)
  const [selectedAllocation, setSelectedAllocation] = useState<AllocationOption | null>(null)
  const [allocations, setAllocations] = useState<AllocationOption[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<number>(0)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "present" | "absent" | "in_progress">("all")
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((title: string, description?: string, variant: "default" | "destructive" = "default") => {
    const id = Math.random().toString(36).substr(2, 9)
    setNotifications(prev => [...prev, { id, title, description, variant }])
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 6000)
  }, [])

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&'
  const generateCode = useCallback((): string => {
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }, [])

  const getStudentPhoto = useCallback((firstInitial: string, lastInitial: string): string => {
    if (!firstInitial || !lastInitial) return '👤'
    const initials = `${firstInitial}${lastInitial}`.toUpperCase()
    const emojis = ['👦', '👧', '🧒', '👨‍🎓', '👩‍🎓']
    const hash = (initials.charCodeAt(0) + initials.charCodeAt(1)) % emojis.length
    return emojis[hash]
  }, [])

  const fetchTeacherAllocations = useCallback(async (userId: string) => {
    setDataLoading(true)
    try {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!teacher) {
        addNotification("No Teacher Profile", "Teacher profile not found.", "destructive")
        return
      }

      const { data: assignments, error } = await supabase
        .from('unit_teachers')
        .select(`
          id,
          room,
          schedule,
          unit_id,
          units!inner (
            id,
            name,
            courses!inner (
              id,
              name
            )
          )
        `)
        .eq('teacher_id', teacher.id)

      if (error) throw error

      const allocationOptions: AllocationOption[] = (assignments || [])
        .map((a: any) => {
          const unit = a.units
          if (!unit) return null
          return {
            id: a.id,
            course_name: unit.courses?.name || 'Unknown Course',
            unit_name: unit.name || 'Unknown Unit',
            room: a.room,
            unit_id: a.unit_id,
            course_id: unit.courses?.id || '',
            schedule: a.schedule || {}
          }
        })
        .filter((a): a is AllocationOption => a !== null)

      setAllocations(allocationOptions)

      if (allocationOptions.length === 0) {
        addNotification("No Allocations", "You have no classes allocated yet.", "destructive")
      } else if (!selectedAllocationId && allocationOptions.length > 0) {
        setSelectedAllocationId(allocationOptions[0].id)
      }
    } catch (err: any) {
      addNotification("Failed to Load Classes", err.message || "Unknown error", "destructive")
    } finally {
      setDataLoading(false)
    }
  }, [addNotification, selectedAllocationId])

  const generateUniqueSessionId = useCallback(async (unitName: string): Promise<string> => {
    let generated: string
    let unique = false
    while (!unique) {
      const prefix = unitName.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase()
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
      generated = `${prefix}-${timestamp}-${random}`

      const { data } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('session_id', generated)
        .maybeSingle()

      if (!data) unique = true
    }
    return generated!
  }, [])

  const generateUniqueAccessCode = useCallback(async (): Promise<string> => {
    let code: string
    let unique = false
    let attempts = 0

    while (!unique && attempts < 50) {
      code = generateCode()
      const { data } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('access_code', code)
        .maybeSingle()

      if (!data) unique = true
      attempts++
    }

    if (!unique) {
      code = `TMP${Date.now().toString(36).slice(-5).toUpperCase()}`
    }

    return code!
  }, [generateCode])

  const loadAttendanceData = useCallback(async (sessionId?: string) => {
  setDataLoading(true)
  try {
    if (!sessionId) {
      setAttendanceData([])
      return
    }

    // 1. Get session + course_id
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('status, unit_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      addNotification("Session Not Found", "Could not load session.", "destructive")
      return
    }

    if (!['in_progress', 'completed'].includes(session.status)) {
      setAttendanceData([])
      return
    }

    const { data: unitData } = await supabase
      .from('units')
      .select('course_id')
      .eq('id', session.unit_id)
      .single()

    const courseId = unitData?.course_id
    if (!courseId) {
      addNotification("No Course", "Unit has no course linked.", "destructive")
      return
    }

    // 2. Fetch attendance records (only student_id from students table)
    const { data: records } = await supabase
      .from('attendance_records')
      .select(`
        id,
        student_id,
        confidence_score,
        status,
        timestamp
      `)
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })

    // 3. Fetch ALL active enrollments for this course (only student_id)
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('course_id', courseId)
      .eq('status', 'active')

    const enrolledStudentIds = new Set(enrollments?.map(e => e.student_id) || [])
    setEnrolledStudents(enrolledStudentIds.size)

    // 4. Collect ALL unique student UUIDs we need names for
    const allStudentIds = new Set<string>()
    records?.forEach(r => r.student_id && allStudentIds.add(r.student_id))
    enrollments?.forEach(e => e.student_id && allStudentIds.add(e.student_id))

    // 5. ONE FLAT QUERY to get all student details + names (this bypasses nested RLS bugs)
    let studentDetailsMap = new Map<string, any>()
    if (allStudentIds.size > 0) {
      const { data: studentDetails } = await supabase
        .from('students')
        .select(`
          id,
          student_id,
          user_id,
          users!user_id (
            first_name,
            last_name
          )
        `)
        .in('id', Array.from(allStudentIds))

      studentDetails?.forEach(s => {
        studentDetailsMap.set(s.id, {
          student_id: s.student_id,
          first_name: s.users?.first_name?.trim() || '',
          last_name: s.users?.last_name?.trim() || ''
        })
      })
    }

    // 6. Build final attendance list
    const recordedStudents: AttendanceRecord[] = (records || []).map(r => {
      const details = studentDetailsMap.get(r.student_id) || {}
      const fullName = `${details.first_name || ''} ${details.last_name || ''}`.trim() || 'Unknown Student'

      return {
        id: r.id,
        student_name: fullName,
        student_id: details.student_id || 'N/A',
        confidence: r.status === 'in_progress' ? 0 : Math.round((r.confidence_score || 0) * 100),
        status: (r.status as AttendanceRecord['status']) || 'present',
        time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        photo: getStudentPhoto(details.first_name?.[0] || '', details.last_name?.[0] || '')
      }
    })

    // 7. Absent students
    const recordedIds = new Set(records?.map(r => r.student_id) || [])
    const absentStudents: AttendanceRecord[] = Array.from(enrolledStudentIds)
      .filter(id => !recordedIds.has(id))
      .map(id => {
        const details = studentDetailsMap.get(id) || {}
        const fullName = `${details.first_name || ''} ${details.last_name || ''}`.trim() || 'Unknown Student'

        return {
          id: `absent-${id}`,
          // student_name: fullName,
          student_id: details.student_id || 'N/A',
          confidence: 0,
          status: 'absent' as const,
          time: '—',
          photo: getStudentPhoto(details.first_name?.[0] || '', details.last_name?.[0] || '')
        }
      })

    setAttendanceData([...recordedStudents, ...absentStudents])
  } catch (error: any) {
    console.error("Load attendance error:", error)
    addNotification("Error Loading Data", error.message || "Unknown error", "destructive")
  } finally {
    setDataLoading(false)
  }
}, [getStudentPhoto, addNotification])

  const saveSessionToStorage = useCallback((sessionId: string, session: ActiveSession) => {
    localStorage.setItem('activeSessionId', sessionId)
    localStorage.setItem('activeSession', JSON.stringify(session))
  }, [])

  const loadSessionFromStorage = useCallback(async () => {
    const storedSessionId = localStorage.getItem('activeSessionId')
    const storedSession = localStorage.getItem('activeSession')
    if (storedSessionId && storedSession) {
      try {
        const parsedSession = JSON.parse(storedSession) as ActiveSession
        setActiveSessionId(storedSessionId)
        setActiveSession(parsedSession)
        setIsSessionActive(parsedSession.status === 'in_progress')
        await loadAttendanceData(storedSessionId)
        addNotification("Session Restored", "Active session loaded.", "default")
      } catch (err) {
        localStorage.removeItem('activeSessionId')
        localStorage.removeItem('activeSession')
      }
    }
  }, [loadAttendanceData, addNotification])

  const clearSessionFromStorage = useCallback(() => {
    localStorage.removeItem('activeSessionId')
    localStorage.removeItem('activeSession')
  }, [])

  const createSession = useCallback(async (allocationId: string) => {
    const allocation = allocations.find(a => a.id === allocationId)
    if (!allocation) return addNotification("Invalid Class", "Selected class not found.", "destructive")

    setDataLoading(true)
    try {
      const sessionId = await generateUniqueSessionId(allocation.unit_name)
      const accessCode = await generateUniqueAccessCode()
      const now = new Date().toISOString()

      const { data: newSession, error } = await supabase
        .from('attendance_sessions')
        .insert({
          session_id: sessionId,
          date_time: now,
          duration: '01:30:00',
          room: allocation.room,
          status: 'in_progress',
          unit_id: allocation.unit_id,
          unit_teacher_id: allocationId,
          access_code: accessCode
        })
        .select()
        .single()

      if (error || !newSession) throw error

      const parsedSession: ActiveSession = {
        id: newSession.id,
        session_id: sessionId,
        date_time: now,
        status: 'in_progress',
        room: allocation.room || '',
        access_code: accessCode
      }

      setActiveSessionId(newSession.id)
      setActiveSession(parsedSession)
      setIsSessionActive(true)
      saveSessionToStorage(newSession.id, parsedSession)
      addNotification("Session Started", `Code: ${accessCode}`, "default")
      await loadAttendanceData(newSession.id)
    } catch (err: any) {
      console.error("Create session error:", err)
      addNotification("Failed to Start", err.message || "Could not create session.", "destructive")
    } finally {
      setDataLoading(false)
    }
  }, [allocations, generateUniqueSessionId, generateUniqueAccessCode, loadAttendanceData, addNotification, saveSessionToStorage])

  const startSession = useCallback(() => {
    if (!selectedAllocationId) return addNotification("No Class Selected", "Please select a class first.", "destructive")
    createSession(selectedAllocationId)
  }, [selectedAllocationId, createSession, addNotification])

  const endSession = useCallback(async () => {
    if (!activeSessionId) return

    try {
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ status: 'completed' })
        .eq('id', activeSessionId)

      if (error) throw error

      addNotification("Session Ended", "Attendance finalized successfully.", "default")

      setIsSessionActive(false)
      setActiveSessionId(null)
      setActiveSession(null)
      clearSessionFromStorage()
      await loadAttendanceData(activeSessionId)
    } catch (err: any) {
      addNotification("Failed to End Session", err.message || "Unknown error", "destructive")
    }
  }, [activeSessionId, loadAttendanceData, addNotification, clearSessionFromStorage])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        addNotification("Not Logged In", "Please log in again.", "destructive")
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'teacher') {
        addNotification("Access Denied", "Teachers only.", "destructive")
        setLoading(false)
        return
      }

      setUserProfile(profile)
      await fetchTeacherAllocations(profile.id)
      await loadSessionFromStorage()

      const stored = localStorage.getItem('selectedAllocationId')
      if (stored && allocations.find(a => a.id === stored)) {
        setSelectedAllocationId(stored)
      }

      setLoading(false)
    }
    init()
  }, [addNotification, fetchTeacherAllocations, loadSessionFromStorage])

  useEffect(() => {
    const alloc = allocations.find(a => a.id === selectedAllocationId)
    setSelectedAllocation(alloc || null)
    if (selectedAllocationId) {
      localStorage.setItem('selectedAllocationId', selectedAllocationId)
    }
    if (alloc && !activeSessionId) {
      // Load enrolled students count for preview
      const loadEnrollmentsCount = async () => {
        if (!alloc.course_id) return
        const { data, error } = await supabase
          .from('enrollments')
          .select('id')
          .eq('course_id', alloc.course_id)
          .eq('status', 'active')
        if (!error) {
          setEnrolledStudents(data?.length || 0)
        }
      }
      loadEnrollmentsCount()
    }
  }, [selectedAllocationId, allocations, activeSessionId])

  useEffect(() => {
    if (!activeSessionId || !isSessionActive) return

    const channel = supabase.channel('attendance_records')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_records',
        filter: `session_id=eq.${activeSessionId}`
      }, () => loadAttendanceData(activeSessionId))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeSessionId, isSessionActive, loadAttendanceData])

  useEffect(() => {
    if (selectedAllocationId) {
      const stored = localStorage.getItem('selectedAllocationId')
      if (localStorage.getItem('activeSessionId') && stored !== selectedAllocationId) {
        clearSessionFromStorage()
        setActiveSessionId(null)
        setActiveSession(null)
        setIsSessionActive(false)
        setAttendanceData([])
      }
    }
  }, [selectedAllocationId, clearSessionFromStorage])

  const filtered = useMemo(() => attendanceData.filter(s => {
    const name = typeof s.student_name === 'string' ? s.student_name : ''
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === "all" || s.status === filterStatus
    return matchesSearch && matchesFilter
  }), [attendanceData, searchTerm, filterStatus])

  const presentCount = useMemo(() => attendanceData.filter(s => s.status !== 'absent').length, [attendanceData])
  const absentCount = useMemo(() => attendanceData.filter(s => s.status === 'absent').length, [attendanceData])
  const attendanceRate = enrolledStudents > 0 ? Math.round((presentCount / enrolledStudents) * 100) : 0

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full"></div></div>
  if (!userProfile) return <div className="flex min-h-screen items-center justify-center"><Alert><AlertDescription>Access denied – teachers only.</AlertDescription></Alert></div>

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-4 md:p-6 space-y-6 relative">

          <div className="fixed top-20 right-4 z-50 space-y-2">
            {notifications.map(n => (
              <Alert key={n.id} variant={n.variant === "destructive" ? "destructive" : "default"}>
                <AlertDescription>
                  <span className="font-medium">{n.title}</span>
                  {n.description && <><br /><span className="text-sm">{n.description}</span></>}
                </AlertDescription>
              </Alert>
            ))}
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Live Attendance</h1>
            <p className="text-muted-foreground">Track attendance in real-time</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Select Class</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedAllocationId || ''} onValueChange={(v) => {
                setSelectedAllocationId(v)
                if (activeSessionId) {
                  clearSessionFromStorage()
                  setActiveSessionId(null)
                  setActiveSession(null)
                  setIsSessionActive(false)
                  setAttendanceData([])
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select a class..." /></SelectTrigger>
                <SelectContent>
                  {allocations.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.course_name} - {a.unit_name}{a.room && ` - Room ${a.room}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedAllocation && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5" />Session Controls</CardTitle>
                  <CardDescription>
                    {isSessionActive ? "Session in progress" : "Ready to start"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Class</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedAllocation.course_name} - {selectedAllocation.unit_name}
                        {selectedAllocation.room && ` • Room ${selectedAllocation.room}`}
                      </p>
                      {activeSession && (
                        <div className="pt-3 border-t">
                          <p className="text-sm font-medium text-muted-foreground">Access Code</p>
                          <Badge variant="secondary" className="font-mono text-lg tracking-wider">
                            {activeSession.access_code}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 justify-end">
                      {isSessionActive ? (
                        <>
                          <Button variant="outline" onClick={() => loadAttendanceData(activeSessionId)} disabled={dataLoading}>
                            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive">
                                <StopCircle className="h-4 w-4 mr-2" /> End Session
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>End Session?</AlertDialogTitle>
                                <AlertDialogDescription>This will finalize attendance.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={endSession}>End Session</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <Button onClick={startSession} disabled={dataLoading} size="lg">
                          <Play className="h-5 w-5 mr-2" />
                          Start Attendance
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="p-6 text-center"><Users className="h-8 w-8 text-green-500 mx-auto mb-2" /><div className="text-3xl font-bold text-green-500">{presentCount}</div><p className="text-sm text-muted-foreground">Present</p></CardContent></Card>
                <Card><CardContent className="p-6 text-center"><UserX className="h-8 w-8 text-red-500 mx-auto mb-2" /><div className="text-3xl font-bold text-red-500">{absentCount}</div><p className="text-sm text-muted-foreground">Absent</p></CardContent></Card>
                <Card><CardContent className="p-6 text-center"><UserCheck className="h-8 w-8 text-primary mx-auto mb-2" /><div className="text-3xl font-bold">{attendanceRate}%</div><p className="text-sm text-muted-foreground">Rate</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Students ({filtered.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" /></div>
                  ) : (
                    <div className="space-y-3">
                      {filtered.length === 0 ? (
                        <p className="text-center text-muted-foreground py-12">
                          {isSessionActive ? "No students match filters" : "Start session to track attendance"}
                        </p>
                      ) : (
                        filtered.map(student => {
                          const badgeVariant = student.status === 'absent' ? "destructive" : student.status === 'in_progress' ? "secondary" : "default"
                          const statusText = student.status === 'in_progress' ? 'In Progress' : student.status.charAt(0).toUpperCase() + student.status.slice(1)
                          return (
                            <div key={student.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50">
                              <div className="flex items-center gap-4">
                                <span className="text-2xl">{student.photo}</span>
                                <div>
                                  <p className="font-medium">{student.student_name}</p>
                                  <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant={badgeVariant}>{statusText}</Badge>
                                <p className="text-sm text-muted-foreground mt-1">{student.time}</p>
                                {student.confidence > 0 && (
                                  <p className="text-xs text-muted-foreground">Confidence: {student.confidence}%</p>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  )
}