"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback } from "react"
import { mockAPI } from "./mock-api"

interface AppContextType {
  currentSession: any | null
  students: any[]
  sessions: any[]
  stats: any | null
  loading: boolean
  error: string | null

  // Session actions
  createSession: (courseCode: string, duration: number) => Promise<void>
  getSession: (code: string) => Promise<void>
  endSession: (code: string) => Promise<void>

  // Attendance actions
  recordAttendance: (sessionCode: string, studentId: string, confidence: number) => Promise<void>

  // Student actions
  loadStudents: () => Promise<void>
  addStudent: (name: string, email: string) => Promise<void>

  // Analytics actions
  loadStats: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<any | null>(null)
  const [students, setStudents] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [stats, setStats] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSession = useCallback(async (courseCode: string, duration: number) => {
    setLoading(true)
    setError(null)
    try {
      const session = await mockAPI.createSession(courseCode, duration)
      setCurrentSession(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session")
    } finally {
      setLoading(false)
    }
  }, [])

  const getSession = useCallback(async (code: string) => {
    setLoading(true)
    setError(null)
    try {
      const session = await mockAPI.getSession(code)
      if (!session) {
        throw new Error("Session not found")
      }
      setCurrentSession(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get session")
    } finally {
      setLoading(false)
    }
  }, [])

  const endSession = useCallback(async (code: string) => {
    setLoading(true)
    setError(null)
    try {
      await mockAPI.endSession(code)
      setCurrentSession(null)
      const allSessions = await mockAPI.getAllSessions()
      setSessions(allSessions)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end session")
    } finally {
      setLoading(false)
    }
  }, [])

  const recordAttendance = useCallback(async (sessionCode: string, studentId: string, confidence: number) => {
    setLoading(true)
    setError(null)
    try {
      await mockAPI.recordAttendance(sessionCode, studentId, confidence)
      const session = await mockAPI.getSession(sessionCode)
      setCurrentSession(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record attendance")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await mockAPI.getStudents()
      setStudents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students")
    } finally {
      setLoading(false)
    }
  }, [])

  const addStudent = useCallback(async (name: string, email: string) => {
    setLoading(true)
    setError(null)
    try {
      await mockAPI.addStudent(name, email)
      const data = await mockAPI.getStudents()
      setStudents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add student")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await mockAPI.getAttendanceStats()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats")
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <AppContext.Provider
      value={{
        currentSession,
        students,
        sessions,
        stats,
        loading,
        error,
        createSession,
        getSession,
        endSession,
        recordAttendance,
        loadStudents,
        addStudent,
        loadStats,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useApp must be used within AppProvider")
  }
  return context
}
