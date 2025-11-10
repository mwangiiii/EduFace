"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useApp } from "@/lib/context"
import { supabase } from "@/lib/supabaseClient"
import { AlertCircle, Copy, CheckCircle } from "lucide-react"

interface CodeEntryProps {
  onSubmit: (sessionId: string, accessCode: string) => void
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

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Allow any length, lowercase, uppercase, and symbols
  const handleCodeChange = (value: string) => {
    setCode(value)
    setError("")
    setSuccess(false)
  }

  // Copy to clipboard
  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  // Validate code against DB
  const validateCode = async (accessCode: string) => {
    setValidating(true)
    setError("")
    setSuccess(false)

    try {
      const { data, error } = await supabase
        .from("attendance_sessions")
        .select("id, session_id, status, room, unit_id, units(name), unit_teachers!inner(room, schedule)")
        .eq("access_code", accessCode)
        .eq("status", "in_progress")
        .single()

      if (error || !data) {
        setError("Invalid or expired session code. Please check with your instructor.")
        return
      }

      // Success! Pass session data up
      setSuccess(true)
      setTimeout(() => {
        onSubmit(data.id, accessCode)
      }, 600)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!code) {
      setError("Please enter a session code")
      return
    }

    if (code.length !== 6) {
      setError("Session code must be exactly 6 characters")
      return
    }

    validateCode(code)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/30">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Badge variant="outline" className="text-lg px-4 py-1 font-mono">
              Student Portal
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Mark Attendance</h1>
          <p className="text-muted-foreground">Enter the 6-character code from your instructor</p>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg border-border">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl text-center">Session Code</CardTitle>
            <CardDescription className="text-center">
              Ask your instructor for the code displayed on their screen
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Input Field */}
              <div className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="ABC123"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  // maxLength removed to allow any length
                  disabled={loading}
                  className={`
                    text-center text-2xl md:text-3xl tracking-widest font-mono h-16
                    transition-all duration-200
                    ${error ? "border-destructive focus-visible:ring-destructive" : ""}
                    ${success ? "border-green-500 focus-visible:ring-green-500" : ""}
                  `}
                  aria-label="6-character session code"
                  autoComplete="off"
                  autoCorrect="off"
                  
                  spellCheck={false}
                />

                {/* Copy Button */}
                {code && !loading && (
                  <button
                    type="button"
                    onClick={copyCode}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Copy code"
                  >
                    {copied ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                  </button>
                )}

                {/* Live Char Count */}
                <div className="absolute -bottom-6 left-0 right-0 flex justify-center">
                  <span className="text-xs text-muted-foreground">
                    {code.length} character{code.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {/* Success Message */}
              {success && (
                <Alert className="py-2 border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-sm text-green-700 dark:text-green-300">
                    Code accepted! Joining session...
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full h-12 text-lg font-medium transition-all"
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Validating...
                  </>
                ) : success ? (
                  "Joining..."
                ) : (
                  "Continue"
                )}
              </Button>
            </form>

            {/* Help Text */}
            <div className="mt-8 pt-6 border-t border-border text-center">
              {/* <p className="text-xs text-muted-foreground mb-3">
                Example code: <code className="font-mono bg-muted px-1 rounded">K9M2P7</code>
              </p> */}
              <p className="text-xs text-muted-foreground mb-4">
                Don’t have a code? Ask your instructor.
              </p>

              <button
                onClick={onLogout}
                disabled={loading}
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
              >
                ← Back to Home
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            © 2025 Attendance System • Secure & Private
          </p>
        </div>
      </div>
    </div>
  )
}