"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"

export default function SpoofingLogsPage() {
  const [filterLevel, setFilterLevel] = useState("all")

  const logs = [
    {
      id: 1,
      timestamp: "2024-01-15 10:30",
      type: "Video Spoofing",
      severity: "high",
      location: "Room 101",
      details: "Detected video replay",
    },
    {
      id: 2,
      timestamp: "2024-01-15 09:15",
      type: "Face Mask",
      severity: "medium",
      location: "Main Hall",
      details: "Face mask detected",
    },
    {
      id: 3,
      timestamp: "2024-01-15 08:45",
      type: "Multiple Faces",
      severity: "high",
      location: "Room 202",
      details: "Multiple faces in frame",
    },
    {
      id: 4,
      timestamp: "2024-01-15 07:30",
      type: "Unknown Face",
      severity: "low",
      location: "Entrance",
      details: "Unknown face detected",
    },
  ]

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
                    {logs.map((log) => (
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
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
