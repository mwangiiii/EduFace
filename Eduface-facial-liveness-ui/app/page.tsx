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

  // if (userRole === "teacher") {
  //   return <TeacherFlow onLogout={() => setUserRole(null)} />
  // }

  // if (userRole === "admin") {
  //   return <AdminDashboard onLogout={() => setUserRole(null)} />
  // }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 dark:from-background dark:to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {/* Logo */}
         
          <h1 className="text-4xl font-extrabold text-primary mb-2 tracking-tight">EduFace</h1>
          <p className="text-base text-muted-foreground mb-1">AI-Powered Attendance System</p>
    
        </div>

        <div className="bg-white dark:bg-background rounded-xl shadow-xl border border-border p-8 flex flex-col gap-6 items-center">
          <button
            onClick={() => setUserRole("student")}
            className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold text-lg shadow-md hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all duration-200"
            aria-label="Enter as Student"
          >
            <span className="flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 7v-7" /></svg>
              Student Portal
            </span>
          </button>
          <div className="text-xs text-muted-foreground text-center mt-2">
            Your data is secure & private. Need help? <a href="#" className="underline hover:text-primary">Contact support</a>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">© 2025 EduFace • Designed for modern learning</p>
        </div>
      </div>
    </main>
  )
}
