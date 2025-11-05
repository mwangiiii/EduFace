"use client"

import { useEffect } from "react"
import { Card } from "@/components/ui/card"
import { useApp } from "@/lib/context"

export default function ReportsView() {
  const { stats, loading, loadStats } = useApp()

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const statCards = stats
    ? [
        { label: "Total Sessions", value: stats.totalSessions, change: "+12%" },
        {
          label: "Average Attendance",
          value: `${Math.round(stats.totalAttendance / Math.max(stats.totalSessions, 1))}`,
          change: "+5%",
        },
        { label: "Total Students", value: stats.totalStudents, change: "+8%" },
        { label: "Enrolled Students", value: stats.enrolledStudents, change: "+0.2%" },
      ]
    : []

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-foreground mb-6">Reports & Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, idx) => (
          <Card key={idx} className="p-6 border border-border">
            <p className="text-muted-foreground text-sm mb-2">{stat.label}</p>
            <div className="flex justify-between items-end">
              <p className="text-3xl font-bold text-foreground">{loading ? "-" : stat.value}</p>
              <span className="text-accent text-sm font-semibold">{stat.change}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 border border-border">
        <h3 className="text-lg font-bold text-foreground mb-4">Attendance Trends</h3>
        <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground">Chart visualization would go here</p>
        </div>
      </Card>
    </div>
  )
}
