"use client"

import { useState } from "react"
import StudentFlow from "@/components/flows/student-flow"
import TeacherFlow from "@/components/flows/teacher-flow"
import AdminDashboard from "@/components/flows/admin-dashboard"

type UserRole = "student" | "teacher" | "admin" | null

export default function Home() {
  const [userRole, setUserRole] = useState<UserRole>(null)

  if (userRole === "student") {
    return <StudentFlow onLogout={() => setUserRole(null)} />
  }

  if (userRole === "teacher") {
    return <TeacherFlow onLogout={() => setUserRole(null)} />
  }

  if (userRole === "admin") {
    return <AdminDashboard onLogout={() => setUserRole(null)} />
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-2">EduFace</h1>
          <p className="text-muted-foreground">AI-Powered Attendance System</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setUserRole("student")}
            className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Student
          </button>
          <button
            onClick={() => setUserRole("teacher")}
            className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Teacher
          </button>
          <button
            onClick={() => setUserRole("admin")}
            className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Admin
          </button>
        </div>
      </div>
    </main>
  )
}
