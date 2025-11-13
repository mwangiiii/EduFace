"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useApp } from "@/lib/context"
import { AlertCircle, Copy, CheckCircle } from "lucide-react"

interface CodeEntryProps {
  onSubmit: (sessionData: any, accessCode: string) => void
  onLogout: () => void
}

export default function CodeEntry({ onSubmit, onLogout }: CodeEntryProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [copied, setCopied] = useState(false)
  const [validating, setValidating] = useState(false)
  const { loading: contextLoading } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)

  const loading = contextLoading || validating

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleCodeChange = (value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    setCode(upper)
    setError("")
    setSuccess(false)
  }

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  // === VALIDATION: access_code → session → unit ONLY ===
  const validateCode = async (accessCode: string) => {
    setValidating(true)
    setError("")
    setSuccess(false)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
      setError("System configuration error. Please refresh.")
      setValidating(false)
      return
    }

    try {
      // Step 1: Find session by access_code
      console.log("Looking up session with access_code:", accessCode)
      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/attendance_sessions?access_code=eq.${accessCode}&select=*`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        }
      )

      if (!sessionRes.ok) throw new Error(`Session lookup failed: ${sessionRes.status}`)
      const sessions = await sessionRes.json()
      if (!sessions?.[0]) throw new Error("Invalid access code")

      const session = sessions[0]
      if (!['in_progress', 'scheduled'].includes(session.status)) {
        throw new Error(`Session is ${session.status}`)
      }
      if (!session.unit_id) throw new Error("No unit assigned to session")

      console.log("Session found:", session.session_id, "Unit ID:", session.unit_id)

      // Step 2: Get unit by id
      const unitRes = await fetch(
        `${supabaseUrl}/rest/v1/units?id=eq.${session.unit_id}&select=*`,
        {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        }
      )

      if (!unitRes.ok) throw new Error(`Unit lookup failed: ${unitRes.status}`)
      const units = await unitRes.json()
      if (!units?.[0]) throw new Error("Unit not found")

      const unit = units[0]

      console.log("Unit found:", unit.name)

      // === BUILD FINAL DATA (NO COURSE) ===
      const sessionData = {
        id: session.id,
        session_id: session.session_id,
        date_time: session.date_time,
        duration: session.duration,
        room: session.room,
        status: session.status,
        unit_id: session.unit_id,
        access_code: session.access_code,
        unit: {
          id: unit.id,
          unit_id: unit.unit_id,
          name: unit.name,
          description: unit.description,
        },
      }

      console.log("Validation SUCCESS")
      console.log("sessionData:", sessionData)

      setSuccess(true)
      setTimeout(() => {
        onSubmit(sessionData, accessCode)
      }, 600)

    } catch (err: any) {
      console.error("Validation failed:", err)
      setError(
        err.message.includes("not found")
          ? "Invalid session. Please check code and try again."
          : "Network error. Please try again."
      )
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) return setError("Please enter a code")
    if (code.length !== 6) return setError("Code must be 6 characters")
    validateCode(code)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Badge variant="outline" className="text-lg px-4 py-1 font-mono">
            Student Portal
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Mark Attendance</h1>
          <p className="text-muted-foreground">Enter the 6-character code from your instructor</p>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl text-center">Session Code</CardTitle>
            <CardDescription className="text-center">
              Ask your instructor for the code displayed on their screen
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="ABC123"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  maxLength={6}
                  disabled={loading}
                  className={`
                    text-center text-3xl tracking-widest font-mono h-16 uppercase
                    ${error ? "border-destructive" : ""}
                    ${success ? "border-green-500" : ""}
                  `}
                  autoComplete="off"
                />

                {code && !loading && (
                  <button
                    type="button"
                    onClick={copyCode}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {copied ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                  </button>
                )}

                <div className="absolute -bottom-6 left-0 right-0 text-center">
                  <span className="text-xs text-muted-foreground">{code.length}/6</span>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="py-2 border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-sm text-green-700 dark:text-green-300">
                    Code verified! Loading facial scan...
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full h-12 text-lg"
                size="lg"
              >
                {loading ? "Validating..." : success ? "Loading..." : "Continue"}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t text-center">
              <p className="text-xs text-muted-foreground mb-4">
                No code? Ask your instructor.
              </p>
              <button
                onClick={onLogout}
                disabled={loading}
                className="text-sm underline underline-offset-4 hover:text-foreground"
              >
                Back to Home
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          © 2025 Attendance System • Secure & Private
        </div>
      </div>
    </div>
  )
}