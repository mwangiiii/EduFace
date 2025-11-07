"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface SpoofingLog {
  id: string
  timestamp: string
  type: string
  severity: 'high' | 'medium' | 'low'
  location: string
  details: string
}

export default function SpoofingLogsPage() {
  const [filterLevel, setFilterLevel] = useState("all")
  const [logs, setLogs] = useState<SpoofingLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLogs() {
      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from('spoofing_attempts')
          .select(`
            *,
            attendance_sessions!spoofing_attempts_session_id_fkey(room),
            students!spoofing_attempts_student_id_fkey(
              *,
              user:users!students_user_id_fkey(first_name, last_name)
            )
          `)
          .gte('created_at', twentyFourHoursAgo)
          .order('timestamp', { ascending: false })

        if (error) throw error

        const processedLogs: SpoofingLog[] = (data || []).map((d: any) => {
          const confidence = d.confidence_score || 0
          const severity = confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low'
          const studentName = d.students?.user ? `${d.students.user.first_name} ${d.students.user.last_name}`.trim() : 'Unknown'
          const details = `Detection: ${d.detection_type}, Confidence: ${(confidence * 100).toFixed(0)}%, Student: ${studentName}`

          return {
            id: d.id,
            timestamp: new Date(d.timestamp).toLocaleString('en-US', { 
              year: 'numeric', 
              month: '2-digit', 
              day: '2-digit', 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            type: d.detection_type,
            severity,
            location: d.attendance_sessions?.room || 'Unknown',
            details,
          }
        })

        setLogs(processedLogs)
      } catch (error) {
        console.error('Error fetching spoofing logs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  const filteredLogs = logs.filter(log => filterLevel === 'all' || log.severity === filterLevel)

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 pl-64">
          <Navbar />
          <main className="pt-16 p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">Spoofing Attempt Logs</h1>
              <p className="text-muted-foreground">Security alerts and suspicious activity</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Last 24 hours of suspicious activity</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Loading...</p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Spoofing Attempt Logs</h1>
            <p className="text-muted-foreground">Security alerts and suspicious activity</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Recent Alerts</CardTitle>
                  <CardDescription>Last 24 hours of suspicious activity</CardDescription>
                </div>
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredLogs.length === 0 ? (
                <p className="text-muted-foreground">No spoofing attempts found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Time</th>
                        <th className="text-left py-3 px-4 font-medium">Type</th>
                        <th className="text-left py-3 px-4 font-medium">Location</th>
                        <th className="text-left py-3 px-4 font-medium">Details</th>
                        <th className="text-left py-3 px-4 font-medium">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 text-muted-foreground">{log.timestamp}</td>
                          <td className="py-3 px-4">{log.type}</td>
                          <td className="py-3 px-4">{log.location}</td>
                          <td className="py-3 px-4">{log.details}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                log.severity === "high"
                                  ? "destructive"
                                  : log.severity === "medium"
                                    ? "secondary"
                                    : "default"
                              }
                            >
                              {log.severity.charAt(0).toUpperCase() + log.severity.slice(1)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}