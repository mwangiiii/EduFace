"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle2, Calendar, Clock, School, User, ShieldCheck } from "lucide-react"
import { format } from "date-fns"
import { useEffect, useState } from "react" // For optional micro-animation

interface VerificationResult {
  success: boolean
  studentId: string
  sessionId: string
  unitName: string
  timestamp: Date | string
  confidence: number
  avgConfidence?: number
  livenessScore?: number
  matchCount?: number
  totalComparisons?: number
}

interface AttendanceConfirmationProps {
  data: VerificationResult
  onReset: () => void
  onLogout: () => void
}

export default function AttendanceConfirmation({
  data,
  onReset,
  onLogout,
}: AttendanceConfirmationProps) {
  const [showConfetti, setShowConfetti] = useState(false)

  // Parse timestamp to Date (assuming UTC input)
  const parsedTimestamp = typeof data.timestamp === "string" ? new Date(data.timestamp) : data.timestamp

  // Format directly with timeZone option
  const timeStr = format(parsedTimestamp, "h:mm a", { timeZone: "Africa/Nairobi" })
  const dateStr = format(parsedTimestamp, "EEEE, d MMMM yyyy", { timeZone: "Africa/Nairobi" })

  const pct = (val?: number) => val != null ? `${(val * 100).toFixed(0)}` : "—"

  // Low confidence check
  const isLowConfidence = data.confidence < 0.8

  useEffect(() => {
    if (data.success) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [data.success])

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-emerald-50 to-green-50 dark:from-gray-900 dark:to-gray-800" 
      role="main" 
      aria-label="Attendance confirmation" 
      lang="en"
    >
      <div className="w-full max-w-sm space-y-4 text-center">

        {/* Success Icon with Optional Confetti */}
        <div className="flex justify-center relative" role="status" aria-live="polite">
          <div 
            className={`w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
              showConfetti ? 'scale-110' : 'scale-100'
            }`} 
            tabIndex={0}
            aria-label={`${data.success ? 'Success' : 'Pending'} attendance mark`}
          >
            <CheckCircle2 className="w-10 h-10 text-white" aria-hidden="true" />
          </div>
          {showConfetti && (
            <div className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-50" aria-hidden="true" />
          )}
        </div>

        {/* Motivational Header */}
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Great job—marked present! 🎉
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300" lang="sw">
            Mahudhurio yako imesajiliwa vizuri.
          </p>
          {isLowConfidence && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md">
              Match was close—want to snap again for peace of mind?
            </p>
          )}
        </div>

        {/* Compact Confirmation Card */}
        <Card className="p-4 border border-green-200 dark:border-green-800 shadow-sm bg-white/90 dark:bg-gray-800/90">
          <div className="space-y-3">

            {/* Profile Chunk: Student + Unit/Session */}
            <section aria-labelledby="profile-heading">
              <h3 id="profile-heading" className="sr-only">Your Details</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">You</p>
                  <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {data.studentId}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 pl-13 mt-1 truncate">
                <School className="w-3 h-3 text-purple-600 dark:text-purple-300 inline mr-1 mb-0.5" aria-hidden="true" /> 
                {data.unitName} • <span className="font-mono">{data.sessionId}</span>
              </p>
            </section>

            {/* Timestamp Chunk: Most Prominent */}
            <section aria-labelledby="time-heading">
              <h3 id="time-heading" className="sr-only">Timestamp</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-green-600 dark:text-green-300" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Stamped</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {timeStr}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{dateStr}</p>
                </div>
              </div>
            </section>

            {/* Metrics Chunk: Visual Progress */}
            <section aria-labelledby="metrics-heading">
              <h3 id="metrics-heading" className="sr-only">Verification Metrics</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-300" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Match Strength</p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isLowConfidence ? 'bg-amber-400' : 'bg-green-500'
                      }`} 
                      style={{ width: `${data.confidence * 100}%` }}
                      role="progressbar" 
                      aria-label={`Confidence: ${pct(data.confidence)}%`}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${isLowConfidence ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-gray-400'}`}>
                    {pct(data.confidence)}% {data.avgConfidence != null && `• Avg: ${pct(data.avgConfidence)} (${data.matchCount}/${data.totalComparisons})`}
                    {data.livenessScore != null && ` • Liveness: ${pct(data.livenessScore)}%`}
                  </p>
                </div>
              </div>
            </section>

          </div>
        </Card>

        {/* Action Buttons: Student-Focused CTAs */}
        <div className="space-y-2 w-full">
          <Button
            onClick={onReset}
            className="w-full h-12 text-base bg-green-600 hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 text-white transition-colors"
            aria-label="Mark attendance for another session or friend"
          >
            Done? Next up
          </Button>
          <Button
            onClick={onLogout}
            variant="outline"
            className="w-full h-12 text-base focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 transition-colors"
            aria-label="Go back to dashboard"
          >
            Dashboard
          </Button>
        </div>

        {/* Subtle Footer */}
        <footer className="text-xs text-gray-500 dark:text-gray-400" aria-label="App info">
          EduFace • Secure scans for Kenyan students
        </footer>

      </div>
    </div>
  )
}