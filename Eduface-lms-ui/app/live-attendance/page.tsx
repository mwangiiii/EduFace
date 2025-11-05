"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter } from "lucide-react"
import { useState } from "react"

export default function LiveAttendancePage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  const attendanceData = [
    { id: 1, name: "Alice Johnson", photo: "👩‍🦰", confidence: 98.5, status: "present", time: "08:30 AM" },
    { id: 2, name: "Bob Smith", photo: "👨‍🦱", confidence: 96.2, status: "present", time: "08:35 AM" },
    { id: 3, name: "Carol Davis", photo: "👩‍🦱", confidence: 95.8, status: "present", time: "08:40 AM" },
    { id: 4, name: "David Miller", photo: "👨‍🦲", confidence: 0, status: "absent", time: "—" },
    { id: 5, name: "Eva Wilson", photo: "👩‍🦳", confidence: 97.1, status: "present", time: "09:05 AM" },
    { id: 6, name: "Frank Thomas", photo: "👨‍🦳", confidence: 0, status: "absent", time: "—" },
  ]

  const filtered = attendanceData.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === "all" || student.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const presentCount = attendanceData.filter((s) => s.status === "present").length
  const absentCount = attendanceData.filter((s) => s.status === "absent").length

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Live Attendance</h1>
            <p className="text-muted-foreground">Real-time attendance tracking</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-500">{presentCount}</div>
                  <p className="text-sm text-muted-foreground">Present</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-500">{absentCount}</div>
                  <p className="text-sm text-muted-foreground">Absent</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">{Math.round((presentCount / attendanceData.length) * 100)}%</div>
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Student List</CardTitle>
              <CardDescription>Real-time recognition data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Student</th>
                      <th className="text-left py-3 px-4 font-medium">Confidence</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((student) => (
                      <tr key={student.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{student.photo}</span>
                            <span className="font-medium">{student.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">{student.status === "present" ? `${student.confidence}%` : "—"}</td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={student.status === "present" ? "default" : "secondary"}
                            className={student.status === "present" ? "bg-green-500" : "bg-red-500"}
                          >
                            {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">{student.time}</td>
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
