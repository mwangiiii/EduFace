"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useApp } from "@/lib/context"

interface CodeEntryProps {
  onSubmit: (code: string) => void
  onLogout: () => void
}

export default function CodeEntry({ onSubmit, onLogout }: CodeEntryProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const { loading } = useApp()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setError("Please enter a session code")
      return
    }
    if (code.length !== 6) {
      setError("Session code must be 6 characters")
      return
    }
    onSubmit(code.toUpperCase())
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Mark Attendance</h1>
          <p className="text-muted-foreground">Enter your session code to begin</p>
        </div>

        <Card className="p-8 border border-border">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Session Code</label>
              <Input
                type="text"
                placeholder="e.g., ABC123"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase())
                  setError("")
                }}
                maxLength={6}
                disabled={loading}
                className="text-center text-lg tracking-widest font-mono"
              />
              {error && <p className="text-destructive text-sm mt-2">{error}</p>}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:opacity-90"
            >
              {loading ? "Validating..." : "Continue"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center mb-3">Don't have a code? Ask your instructor</p>
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
