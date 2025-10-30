// Mock API service for EduFace
interface AttendanceRecord {
  id: string
  studentId: string
  sessionCode: string
  timestamp: Date
  confidence: number
  facialMatch: boolean
}

interface Session {
  id: string
  sessionCode: string
  courseCode: string
  teacherId: string
  startTime: Date
  duration: number
  qrCode: string
  attendees: AttendanceRecord[]
  status: "active" | "completed"
}

interface Student {
  id: string
  name: string
  email: string
  enrolled: boolean
  enrollmentDate: Date
}

// Simulated database
const sessions: Session[] = []
const attendanceRecords: AttendanceRecord[] = []
const students: Student[] = [
  {
    id: "s1",
    name: "Alice Johnson",
    email: "alice@university.edu",
    enrolled: true,
    enrollmentDate: new Date("2024-01-15"),
  },
  {
    id: "s2",
    name: "Bob Smith",
    email: "bob@university.edu",
    enrolled: true,
    enrollmentDate: new Date("2024-01-15"),
  },
  {
    id: "s3",
    name: "Carol White",
    email: "carol@university.edu",
    enrolled: true,
    enrollmentDate: new Date("2024-02-01"),
  },
]

export const mockAPI = {
  // Session APIs
  createSession: async (courseCode: string, duration: number) => {
    const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${sessionCode}`

    const session: Session = {
      id: Math.random().toString(),
      sessionCode,
      courseCode,
      teacherId: "teacher1",
      startTime: new Date(),
      duration,
      qrCode,
      attendees: [],
      status: "active",
    }

    sessions.push(session)
    return session
  },

  getSession: async (sessionCode: string) => {
    return sessions.find((s) => s.sessionCode === sessionCode)
  },

  endSession: async (sessionCode: string) => {
    const session = sessions.find((s) => s.sessionCode === sessionCode)
    if (session) {
      session.status = "completed"
    }
    return session
  },

  getActiveSessions: async () => {
    return sessions.filter((s) => s.status === "active")
  },

  getAllSessions: async () => {
    return sessions
  },

  // Attendance APIs
  recordAttendance: async (sessionCode: string, studentId: string, confidence: number) => {
    const session = sessions.find((s) => s.sessionCode === sessionCode)
    if (!session) {
      throw new Error("Session not found")
    }

    const record: AttendanceRecord = {
      id: Math.random().toString(),
      studentId,
      sessionCode,
      timestamp: new Date(),
      confidence,
      facialMatch: confidence > 0.85,
    }

    attendanceRecords.push(record)
    session.attendees.push(record)

    return record
  },

  getSessionAttendance: async (sessionCode: string) => {
    const session = sessions.find((s) => s.sessionCode === sessionCode)
    return session?.attendees || []
  },

  getStudentAttendance: async (studentId: string) => {
    return attendanceRecords.filter((r) => r.studentId === studentId)
  },

  // Student APIs
  getStudents: async () => {
    return students
  },

  addStudent: async (name: string, email: string) => {
    const student: Student = {
      id: Math.random().toString(),
      name,
      email,
      enrolled: true,
      enrollmentDate: new Date(),
    }
    students.push(student)
    return student
  },

  updateStudent: async (id: string, updates: Partial<Student>) => {
    const student = students.find((s) => s.id === id)
    if (student) {
      Object.assign(student, updates)
    }
    return student
  },

  // Analytics APIs
  getAttendanceStats: async () => {
    const totalSessions = sessions.length
    const totalAttendance = attendanceRecords.length
    const averageConfidence =
      attendanceRecords.length > 0
        ? attendanceRecords.reduce((sum, r) => sum + r.confidence, 0) / attendanceRecords.length
        : 0

    return {
      totalSessions,
      totalAttendance,
      averageConfidence,
      totalStudents: students.length,
      enrolledStudents: students.filter((s) => s.enrolled).length,
    }
  },

  getSessionStats: async (sessionCode: string) => {
    const session = sessions.find((s) => s.sessionCode === sessionCode)
    if (!session) return null

    return {
      sessionCode,
      courseCode: session.courseCode,
      attendeeCount: session.attendees.length,
      averageConfidence:
        session.attendees.length > 0
          ? session.attendees.reduce((sum, a) => sum + a.confidence, 0) / session.attendees.length
          : 0,
      duration: session.duration,
      startTime: session.startTime,
    }
  },
}
