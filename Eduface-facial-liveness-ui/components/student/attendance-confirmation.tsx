"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle2, Calendar, Clock, School, User, ShieldCheck } from "lucide-react"
import { format } from "date-fns"
import { utcToZonedTime } from "date-fns-tz"

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
  // Convert timestamp to EAT (Kenya time)
  const eatTime = utcToZonedTime(
    typeof data.timestamp === "string" ? new Date(data.timestamp) : data.timestamp,
    "Africa/Nairobi"
  )

  const timeStr = format(eatTime, "h:mm a")           // e.g. 9:13 PM
  const dateStr = format(eatTime, "EEEE, d MMMM yyyy") // e.g. Saturday, 15 November 2025

  const pct = (val?: number) =>
    val != null ? `${(val * 100).toFixed(1)}%` : "—"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="w-full max-w-md space-y-8">

        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-green-400 rounded-full blur-xl opacity-30 animate-ping" />
            <div className="relative w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Present!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Umeandikishwa mahudhurio
          </p>
        </div>

        {/* Confirmation Card */}
        <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur border border-green-200 dark:border-green-800 shadow-xl">
          <div className="space-y-5">

            {/* Student ID */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Student ID</p>
                <p className="font-mono font-bold text-lg text-gray-900 dark:text-white">
                  {data.studentId}
                </p>
              </div>
            </div>

            {/* Unit Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                <School className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Unit</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {data.unitName}
                </p>
              </div>
            </div>

            {/* Session Code */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-300" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Session Code</p>
                <p className="font-mono text-gray-900 dark:text-white">
                  {data.sessionId}
                </p>
              </div>
            </div>

            {/* Marked At */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Marked At</p>
                <p className="font-medium text-gray-900 dark:text-white">{timeStr}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{dateStr}</p>
              </div>
            </div>

            {/* Confidence Score */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">Face Match Confidence</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {pct(data.confidence)} <span className="text-xs text-gray-500">(max)</span>
                </p>
                {data.avgConfidence != null && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Avg: {pct(data.avgConfidence)} • {data.matchCount}/{data.totalComparisons} matches
                  </p>
                )}
              </div>
            </div>

            {/* Liveness Score (if available) */}
            {data.livenessScore != null && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-300" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Liveness Score</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pct(data.livenessScore)}
                  </p>
                </div>
              </div>
            )}

          </div>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={onReset}
            className="w-full h-12 text-lg font-medium bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md"
          >
            Mark Another Attendance
          </Button>
          <Button
            onClick={onLogout}
            variant="outline"
            className="w-full h-12 text-lg font-medium border-2"
          >
            Back to Home
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-8">
          © 2025 EduFace • Secure & Private • Kenya
        </p>

      </div>
    </div>
  )
}