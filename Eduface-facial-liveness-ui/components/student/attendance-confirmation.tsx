"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface AttendanceConfirmationProps {
  data: any
  onReset: () => void
  onLogout: () => void
}

export default function AttendanceConfirmation({ data, onReset, onLogout }: AttendanceConfirmationProps) {
  const studentId = `S${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(5, "0")}`

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-accent/5 to-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent-foreground" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Attendance Marked</h1>
          <p className="text-muted-foreground">Your attendance has been recorded successfully</p>
        </div>

        <Card className="p-8 border border-border mb-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-border">
              <span className="text-muted-foreground">Student ID</span>
              <span className="font-mono font-semibold text-foreground">{studentId}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-border">
              <span className="text-muted-foreground">Time</span>
              <span className="font-semibold text-foreground">{data?.timestamp?.toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-border">
              <span className="text-muted-foreground">Session Code</span>
              <span className="font-mono font-semibold text-foreground">{data?.code}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-semibold text-accent">{Math.round((data?.confidence || 0) * 100)}%</span>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Button onClick={onReset} className="w-full bg-primary text-primary-foreground hover:opacity-90">
            Mark Another Attendance
          </Button>
          <Button onClick={onLogout} variant="outline" className="w-full bg-transparent">
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}
