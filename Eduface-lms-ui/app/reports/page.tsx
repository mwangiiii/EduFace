"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Download, FileText } from "lucide-react"
import { useState } from "react"

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState("week")

  const attendanceChartData = [
    { date: "Mon", present: 45, absent: 5 },
    { date: "Tue", present: 48, absent: 2 },
    { date: "Wed", present: 42, absent: 8 },
    { date: "Thu", present: 50, absent: 0 },
    { date: "Fri", present: 46, absent: 4 },
  ]

  const courseData = [
    { name: "Mathematics", value: 94, color: "#3b82f6" },
    { name: "Physics", value: 89, color: "#06b6d4" },
    { name: "Chemistry", value: 91, color: "#8b5cf6" },
    { name: "English", value: 88, color: "#ec4899" },
  ]

  const studentReports = [
    { name: "Alice Johnson", totalDays: 50, present: 48, absent: 2, rate: "96%" },
    { name: "Bob Smith", totalDays: 50, present: 45, absent: 5, rate: "90%" },
    { name: "Carol Davis", totalDays: 50, present: 49, absent: 1, rate: "98%" },
  ]

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Reports</h1>
            <p className="text-muted-foreground">Attendance analytics and insights</p>
          </div>

          <div className="flex gap-4 mb-6">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>

          <div className="grid gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="present" fill="#3b82f6" name="Present" />
                    <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Course-wise Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={courseData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {courseData.map((entry) => (
                          <Cell key={`cell-${entry.name}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Key Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <span className="text-sm">Overall Attendance Rate</span>
                    <span className="font-bold text-lg">92%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <span className="text-sm">Total Students</span>
                    <span className="font-bold text-lg">250</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <span className="text-sm">Average Present/Day</span>
                    <span className="font-bold text-lg">230</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <span className="text-sm">System Uptime</span>
                    <span className="font-bold text-lg text-green-500">99.8%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Student Attendance Summary</CardTitle>
              <CardDescription>Individual student attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Student Name</th>
                      <th className="text-left py-3 px-4 font-medium">Total Days</th>
                      <th className="text-left py-3 px-4 font-medium">Present</th>
                      <th className="text-left py-3 px-4 font-medium">Absent</th>
                      <th className="text-left py-3 px-4 font-medium">Rate</th>
                      <th className="text-left py-3 px-4 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentReports.map((student) => (
                      <tr key={student.name} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">{student.name}</td>
                        <td className="py-3 px-4">{student.totalDays}</td>
                        <td className="py-3 px-4 text-green-600 font-medium">{student.present}</td>
                        <td className="py-3 px-4 text-red-600 font-medium">{student.absent}</td>
                        <td className="py-3 px-4 font-bold">{student.rate}</td>
                        <td className="py-3 px-4">
                          <Button variant="ghost" size="sm">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </td>
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
