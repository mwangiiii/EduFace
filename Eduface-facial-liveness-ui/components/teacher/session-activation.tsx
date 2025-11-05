"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useApp } from "@/lib/context"

interface SessionActivationProps {
  onSessionStart: (session: any) => void
  onLogout: () => void
}

export default function SessionActivation({ onSessionStart, onLogout }: SessionActivationProps) {
  const [courseCode, setCourseCode] = useState("")
  const [duration, setDuration] = useState("60")
  const [error, setError] = useState("")
  const { createSession, loading } = useApp()

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseCode.trim()) {
      setError("Please enter a course code")
      return
    }

    try {
      await createSession(courseCode, Number.parseInt(duration))
      // Session will be set in context, trigger callback
      setTimeout(() => {
        // Get the session from context would be better, but for now we'll create it locally
        const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase()
        const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${sessionCode}`

        onSessionStart({
          sessionCode,
          courseCode,
          duration: Number.parseInt(duration),
          qrCode,
          startTime: new Date(),
          attendees: [],
        })
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session")
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Start Session</h1>
          <p className="text-muted-foreground">Create a new attendance session</p>
        </div>

        <Card className="p-8 border border-border">
          <form onSubmit={handleStartSession} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Course Code</label>
              <Input
                type="text"
                placeholder="e.g., CS101"
                value={courseCode}
                onChange={(e) => {
                  setCourseCode(e.target.value)
                  setError("")
                }}
                disabled={loading}
              />
              {error && <p className="text-destructive text-sm mt-2">{error}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Session Duration (minutes)</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
              >
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">120 minutes</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:opacity-90"
            >
              {loading ? "Starting..." : "Start Session"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <button
              onClick={onLogout}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to Home
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
