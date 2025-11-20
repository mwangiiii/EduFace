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
  status: "present" | "late" | "absent"
  time: string
  photo?: string
}

interface AllocationOption {
  id: string
  course_name: string
  unit_name: string
  room?: string
  unit_id: string
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
  const [filterStatus, setFilterStatus] = useState<"all" | "present" | "absent">("all")
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((title: string, description?: string, variant: "default" | "destructive" = "default") => {
    const id = Math.random().toString(36).substr(2, 9)
    setNotifications(prev => [...prev, { id, title, description, variant }])
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000)
  }, [])

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$'
  const generateCode = useCallback((length = 6): string => {
    let result = ''
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
    return result
  }, [])

  const getStudentPhoto = useCallback((firstInitial: string, lastInitial: string): string => {
    const initials = `${firstInitial || ''}${lastInitial || ''}`.toUpperCase()
    const emojiMap: { [key: string]: string } = {
      'AJ': '👩‍🦰', 'BS': '👨‍🦱', 'CD': '👩‍🦱', 'DM': '👨‍🦲', 'EW': '👩‍🦳', 'FT': '👨‍🦳'
    }
    return emojiMap[initials] || '👤'
  }, [])

  // ═══════════════════════════════════════════════════════════
  //  FIXED & SAFE: Only loads units allocated to THIS teacher
  // ═══════════════════════════════════════════════════════════
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
    while (!unique) {
      code = generateCode(6)
      const { data } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('access_code', code)
        .maybeSingle()
      if (!data) unique = true
    }
    return code!
  }, [generateCode])

  const loadAttendanceData = useCallback(async (sessionId?: string, fallbackUnitId?: string) => {
    setDataLoading(true)
    try {
      let effectiveUnitId: string | null = null
      let currentStatus: string | null = null

      if (sessionId) {
        const { data: session } = await supabase
          .from('attendance_sessions')
          .select('unit_id, status')
          .eq('id', sessionId)
          .single()

        if (session) {
          effectiveUnitId = session.unit_id
          currentStatus = session.status
        }
      } else {
        effectiveUnitId = fallbackUnitId || null
      }

      if (!effectiveUnitId) {
        setEnrolledStudents(0)
        setAttendanceData([])
        return
      }

      const { data: unit } = await supabase
        .from('units')
        .select('course_id')
        .eq('id', effectiveUnitId)
        .single()

      if (!unit) {
        setEnrolledStudents(0)
        setAttendanceData([])
        return
      }

      const { count } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', unit.course_id)
        .eq('status', 'active')

      setEnrolledStudents(count || 0)

      if (!['in_progress', 'completed'].includes(currentStatus || '')) {
        setAttendanceData([])
        return
      }

      const { data: records } = await supabase
        .from('attendance_records')
        .select(`
          id,
          confidence_score,
          status,
          timestamp,
          students (
            id,
            users ( first_name, last_name )
          )
        `)
        .eq('session_id', sessionId!)
        .order('timestamp', { ascending: true })

      const recordedStudents: AttendanceRecord[] = (records || []).map(r => ({
        id: r.id,
        student_name: `${r.students?.users?.first_name || ''} ${r.students?.users?.last_name || ''}`.trim() || 'Unknown Student',
        student_id: r.students?.id || '',
        confidence: Math.round((r.confidence_score || 0) * 100),
        status: r.status as AttendanceRecord['status'] || 'present',
        time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        photo: getStudentPhoto(r.students?.users?.first_name?.[0] || '', r.students?.users?.last_name?.[0] || '')
      }))

      const recordedStudentIds = new Set(recordedStudents.map(p => p.student_id))

      const { data: allEnrollments } = await supabase
        .from('enrollments')
        .select(`id, students ( id, users ( first_name, last_name ) )`)
        .eq('course_id', unit.course_id)
        .eq('status', 'active')

      const absentStudents = (allEnrollments || [])
        .filter(e => !recordedStudentIds.has(e.students?.id || ''))
        .map(e => ({
          id: `absent-${e.id}`,
          student_name: `${e.students?.users?.first_name || ''} ${e.students?.users?.last_name || ''}`.trim() || 'Unknown Student',
          student_id: e.students?.id || '',
          confidence: 0,
          status: 'absent' as const,
          time: '—',
          photo: getStudentPhoto(e.students?.users?.first_name?.[0] || '', e.students?.users?.last_name?.[0] || '')
        }))

      setAttendanceData([...recordedStudents, ...absentStudents])
    } catch (error) {
      addNotification("Error Loading Attendance", "Failed to fetch data.", "destructive")
    } finally {
      setDataLoading(false)
    }
  }, [getStudentPhoto, addNotification])

  const createSession = useCallback(async (allocationId: string) => {
    const allocation = allocations.find(a => a.id === allocationId)
    if (!allocation) return addNotification("Invalid Class", "Selected class not found.")

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

      setActiveSessionId(newSession.id)
      setActiveSession({
        id: newSession.id,
        session_id: sessionId,
        date_time: now,
        status: 'in_progress',
        room: allocation.room || '',
        access_code: accessCode
      })
      setIsSessionActive(true)
      addNotification("Session Started", `Access code: ${accessCode}`)
      await loadAttendanceData(newSession.id)
    } catch (err: any) {
      addNotification("Failed to Start", err.message || "Could not create session.", "destructive")
    } finally {
      setDataLoading(false)
    }
  }, [allocations, generateUniqueSessionId, generateUniqueAccessCode, loadAttendanceData, addNotification])

  const startSession = useCallback(() => {
    if (!selectedAllocationId) return addNotification("No Class Selected", "Please select a class first.")
    createSession(selectedAllocationId)
  }, [selectedAllocationId, createSession, addNotification])

  const endSession = useCallback(async () => {
    if (!activeSessionId) return

    const { error } = await supabase
      .from('attendance_sessions')
      .update({ status: 'completed' })
      .eq('id', activeSessionId)

    if (error) {
      addNotification("Failed to End Session", error.message, "destructive")
      return
    }

    setActiveSession(prev => prev ? { ...prev, status: 'completed' } : prev)
    setIsSessionActive(false)
    addNotification("Session Ended", "Attendance saved.")
    await loadAttendanceData(activeSessionId)
  }, [activeSessionId, loadAttendanceData, addNotification])

  // Initial load
    // Initial load – fetch user + allocations
  useEffect(() => {
    const init = async () => {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        addNotification("Not Logged In", "Please log in again.", "destructive")
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        addNotification("Profile Error", "Could not load your profile.", "destructive")
        setLoading(false)
        return
      }

      if (profile.role !== 'teacher') {
        addNotification("Access Denied", "This page is for teachers only.", "destructive")
        setLoading(false)
        return
      }

      setUserProfile(profile)
      await fetchTeacherAllocations(profile.id)
      setLoading(false)
    }

    init()
  }, [addNotification, fetchTeacherAllocations])

  useEffect(() => {
    const alloc = allocations.find(a => a.id === selectedAllocationId)
    setSelectedAllocation(alloc || null)
    if (alloc) loadAttendanceData(activeSessionId, alloc.unit_id)
  }, [selectedAllocationId, allocations, activeSessionId, loadAttendanceData])

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

  const filtered = useMemo(() => attendanceData.filter(s => {
    const matchesSearch = s.student_name.toLowerCase().includes(searchTerm.toLowerCase())
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

          {/* Notifications */}
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
            <p className="text-muted-foreground">Track attendance in real-time for your classes</p>
          </div>

          {/* Your full original UI starts here — 100% restored */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Select Class</CardTitle>
              <CardDescription>Choose a class and unit to manage attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedAllocationId || ''} onValueChange={(v) => {
                setSelectedAllocationId(v)
                setActiveSessionId(null)
                setActiveSession(null)
                setIsSessionActive(false)
                setAttendanceData([])
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a class..." />
                </SelectTrigger>
                <SelectContent>
                  {allocations.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.course_name} - {a.unit_name}{a.room && ` - Room ${a.room}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allocations.length === 0 && !dataLoading && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No classes allocated. Contact administrator.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {selectedAllocation && (
            <>
              {/* Session Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5" />Session Controls</CardTitle>
                  <CardDescription>
                    {activeSession
                      ? `${activeSession.status === 'in_progress' ? 'Active' : 'Completed'} session: ${selectedAllocation.course_name} - ${selectedAllocation.unit_name}`
                      : `Ready to start session for ${selectedAllocation.course_name} - ${selectedAllocation.unit_name}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Session Details</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Room: {selectedAllocation.room || activeSession?.room || 'Not specified'}</p>
                        {activeSession && <p>Started: {new Date(activeSession.date_time).toLocaleString()}</p>}
                        {selectedAllocation.schedule && (
                          <p>Schedule: {selectedAllocation.schedule.days?.join(', ') || ''} | {selectedAllocation.schedule.start_time} - {selectedAllocation.schedule.end_time}</p>
                        )}
                      </div>
                      {activeSession && (
                        <div className="pt-2 border-t">
                          <p className="text-sm font-medium text-muted-foreground">Unique Access Code</p>
                          <Badge variant="secondary" className="font-mono mt-1 text-lg">{activeSession.access_code}</Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 justify-end">
                      {activeSession?.status === 'in_progress' ? (
                        <>
                          <Button variant="outline" onClick={() => loadAttendanceData(activeSessionId)} disabled={dataLoading} size="sm">
                            <RefreshCw className="h-4 w-4 mr-2" />Refresh
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={dataLoading}>
                                <StopCircle className="h-4 w-4 mr-2" />End Session
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>End Attendance Session?</AlertDialogTitle>
                                <AlertDialogDescription>This will save all attendance data.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={endSession}>End Session</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <Button onClick={startSession} disabled={dataLoading} size="sm">
                          <Play className="h-4 w-4 mr-2" />
                          {activeSession?.status === 'completed' ? 'Start New Session' : 'Start Attendance'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats + Student List — everything you had before */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card><CardContent className="p-6 text-center"><Users className="h-6 w-6 text-green-500 mx-auto mb-2" /><div className="text-2xl font-bold text-green-500">{presentCount}</div><p className="text-sm text-muted-foreground">Present</p></CardContent></Card>
                <Card><CardContent className="p-6 text-center"><UserX className="h-6 w-6 text-red-500 mx-auto mb-2" /><div className="text-2xl font-bold text-red-500">{absentCount}</div><p className="text-sm text-muted-foreground">Absent</p></CardContent></Card>
                <Card><CardContent className="p-6 text-center"><UserCheck className="h-6 w-6 text-primary mx-auto mb-2" /><div className="text-2xl font-bold">{attendanceRate}%</div><p className="text-sm text-muted-foreground">Attendance Rate</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Student List</CardTitle>
                    <CardDescription>Real-time attendance records ({filtered.length} shown)</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search by name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-full sm:w-48" />
                    </div>
                    <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
                      <SelectTrigger className="w-32"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-b-2 border-primary rounded-full" /></div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Student</th>
                          <th className="text-left py-3 px-4 font-medium min-w-[100px]">Confidence</th>
                          <th className="text-left py-3 px-4 font-medium min-w-[80px]">Status</th>
                          <th className="text-left py-3 px-4 font-medium min-w-[80px]">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(student => (
                          <tr key={student.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4"><div className="flex items-center gap-3"><span className="text-xl">{student.photo}</span><span className="font-medium">{student.student_name}</span></div></td>
                            <td className="py-3 px-4">{['present', 'late'].includes(student.status) ? `${student.confidence}%` : "—"}</td>
                            <td className="py-3 px-4"><Badge variant={student.status === 'absent' ? "destructive" : "default"}>{student.status.charAt(0).toUpperCase() + student.status.slice(1)}</Badge></td>
                            <td className="py-3 px-4">{student.time}</td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">
                            {isSessionActive || activeSession?.status === 'completed' ? 'No students match your filters.' : 'Start the session to begin tracking.'}
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              {!isSessionActive && !activeSession && (
                <Alert className="max-w-md">
                  <Play className="h-4 w-4" />
                  <AlertDescription>Ready to begin? Click "Start Attendance" to generate a unique access code.</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}