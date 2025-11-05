"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Users, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react"
import { useState, useEffect } from "react"

export default function DashboardPage() {
  const [role, setRole] = useState<string>("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const storedRole = localStorage.getItem("userRole") || "student"
    setRole(storedRole)
  }, [])

  if (!mounted) return null

  const stats = [
    {
      title: "Present Today",
      value: role === "admin" ? "487" : role === "teacher" ? "45" : "1",
      icon: CheckCircle2,
      color: "text-green-500",
    },
    {
      title: "Absent",
      value: role === "admin" ? "23" : role === "teacher" ? "3" : "0",
      icon: AlertCircle,
      color: "text-red-500",
    },
    {
      title: "Classes/Courses",
      value: role === "admin" ? "24" : role === "teacher" ? "6" : "5",
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Attendance Rate",
      value: "92%",
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
            <p className="text-muted-foreground capitalize">Welcome back, {role}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <Card key={stat.title}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      {stat.title}
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
