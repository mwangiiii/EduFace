"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"

interface AttendanceConfirmationProps {
  data: {
    studentId: string
    studentUuid: string
    sessionId: string
    sessionUuid: string
    unitId: string
    unitName: string
    confidence: number
    avgConfidence: number
    matchCount: number
    totalComparisons: number
    livenessScore: number
    timestamp: Date
    verificationTimestamp?: string
  }
  onReset: () => void
  onLogout: () => void
}

export default function AttendanceConfirmation({ data, onReset, onLogout }: AttendanceConfirmationProps) {
  // Format timestamp
  const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }) : "N/A"

  const date = data.timestamp ? new Date(data.timestamp).toLocaleDateString("en-KE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }) : "N/A"

  const confidencePercent = Math.round((data.confidence || 0) * 100)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-green-50 to-background dark:from-green-950/20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Present!</h1>
          <p className="text-muted-foreground">Your attendance has been recorded</p>
        </div>

        <Card className="p-6 border border-border mb-6 shadow-sm">
          <div className="space-y-4">
            {/* Student ID */}
            <div className="flex justify-between items-center pb-3 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Student ID</span>
              <span className="font-mono font-semibold text-foreground">{data.studentId}</span>
            </div>

            {/* Unit Name */}
            <div className="flex justify-between items-center pb-3 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Unit</span>
              <span className="font-medium text-foreground">{data.unitName}</span>
            </div>

            {/* Session Code */}
            <div className="flex justify-between items-center pb-3 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Session</span>
              <span className="font-mono text-sm text-foreground">{data.sessionId}</span>
            </div>

            {/* Date & Time */}
            <div className="flex justify-between items-center pb-3 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Time</span>
              <div className="text-right">
                <div className="font-medium text-foreground">{time}</div>
                <div className="text-xs text-muted-foreground">{date}</div>
              </div>
            </div>

            {/* Confidence */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Face Match</span>
              <span className={`font-bold text-lg ${confidencePercent >= 80 ? "text-green-600" : "text-yellow-600"}`}>
                {confidencePercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${confidencePercent >= 80 ? "bg-green-500" : "bg-yellow-500"}`}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Swahili Success Message */}
        <div className="text-center mb-6">
          <p className="text-lg font-semibold text-green-700 dark:text-green-400">
            Umeandikishwa mahudhurio!
          </p>
        </div>

        <div className="space-y-3">
          <Button 
            onClick={onReset} 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Mark Another Attendance
          </Button>
          <Button 
            onClick={onLogout} 
            variant="outline" 
            className="w-full"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}