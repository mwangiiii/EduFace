"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Calendar } from "lucide-react"

export default function MyAttendancePage() {
  const attendanceData = [
    { date: "Mon", present: 1 },
    { date: "Tue", present: 1 },
    { date: "Wed", present: 0 },
    { date: "Thu", present: 1 },
    { date: "Fri", present: 1 },
  ]

  const recentAttendance = [
    { date: "2024-01-15", status: "Present", time: "08:35 AM", confidence: "98.5%" },
    { date: "2024-01-12", status: "Present", time: "08:42 AM", confidence: "96.8%" },
    { date: "2024-01-11", status: "Absent", time: "—", confidence: "—" },
    { date: "2024-01-10", status: "Present", time: "08:50 AM", confidence: "94.2%" },
  ]

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">My Attendance</h1>
            <p className="text-muted-foreground">Your attendance records and statistics</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-500">4</div>
                  <p className="text-sm text-muted-foreground">Present This Week</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-500">1</div>
                  <p className="text-sm text-muted-foreground">Absent This Week</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">80%</div>
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Weekly Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="present" stroke="#3b82f6" name="Present" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Records</CardTitle>
              <CardDescription>Your last 5 attendance entries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Date</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium">Time</th>
                      <th className="text-left py-3 px-4 font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendance.map((record) => (
                      <tr key={record.date} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {record.date}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={record.status === "Present" ? "default" : "secondary"}
                            className={record.status === "Present" ? "bg-green-500" : "bg-red-500"}
                          >
                            {record.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">{record.time}</td>
                        <td className="py-3 px-4">{record.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
