"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface SessionMonitoringProps {
  session: any
  onSessionEnd: () => void
}

export default function SessionMonitoring({ session, onSessionEnd }: SessionMonitoringProps) {
  const [attendees, setAttendees] = useState<any[]>([])
  const [timeRemaining, setTimeRemaining] = useState(session.duration * 60)

  useEffect(() => {
    // Simulate attendees joining
    const attendeeTimer = setInterval(() => {
      setAttendees((prev) => {
        if (prev.length < 25) {
          return [
            ...prev,
            {
              id: Math.random(),
              name: `Student ${prev.length + 1}`,
              timestamp: new Date(),
              confidence: 0.95 + Math.random() * 0.05,
            },
          ]
        }
        return prev
      })
    }, 3000)

    return () => clearInterval(attendeeTimer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 0) {
          clearInterval(timer)
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Session Monitoring</h1>
            <p className="text-muted-foreground">{session.courseCode}</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-primary mb-2">{formatTime(timeRemaining)}</div>
            <p className="text-sm text-muted-foreground">Time Remaining</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 border border-border">
            <p className="text-muted-foreground text-sm mb-2">Session Code</p>
            <p className="text-2xl font-bold text-foreground font-mono">{session.sessionCode}</p>
          </Card>
          <Card className="p-6 border border-border">
            <p className="text-muted-foreground text-sm mb-2">Attendees</p>
            <p className="text-2xl font-bold text-accent">{attendees.length}</p>
          </Card>
          <Card className="p-6 border border-border">
            <p className="text-muted-foreground text-sm mb-2">QR Code</p>
            <img src={session.qrCode || "/placeholder.svg"} alt="QR Code" className="w-24 h-24" />
          </Card>
        </div>

        <Card className="p-6 border border-border mb-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Recent Attendees</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {attendees.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Waiting for attendees...</p>
            ) : (
              attendees.map((attendee, idx) => (
                <div key={attendee.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="font-medium text-foreground">{attendee.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{attendee.timestamp.toLocaleTimeString()}</span>
                    <span className="text-sm font-semibold text-accent">{Math.round(attendee.confidence * 100)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Button onClick={onSessionEnd} className="w-full bg-destructive text-destructive-foreground hover:opacity-90">
          End Session
        </Button>
      </div>
    </div>
  )
}
