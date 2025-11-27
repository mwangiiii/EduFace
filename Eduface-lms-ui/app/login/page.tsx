"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabaseClient"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!email || !password) {
      setError("Please fill in all fields")
      setLoading(false)
      return
    }

    const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (supabaseError) {
      setError(supabaseError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Login failed: No user data returned')
      setLoading(false)
      return
    }

    // Fetch user profile from the custom 'users' table using email
    const { data: userProfile, error: fetchError } = await supabase
      .from('users')
      .select('role, first_name, last_name')
      .eq('email', email)
      .single()

    if (fetchError || !userProfile) {
      // Optionally sign out if profile not found
      await supabase.auth.signOut()
      setError('User profile not found. Please contact support.')
      setLoading(false)
      return
    }

    // Store role and other info in localStorage
    localStorage.setItem('userRole', userProfile.role)
    localStorage.setItem('userEmail', email)
    // Optionally store more: localStorage.setItem('userName', `${userProfile.first_name} ${userProfile.last_name}`)

    setLoading(false)
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="text-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
              FaceAttend
            </div>
          </div>
          <CardTitle className="text-center">Sign In</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access the attendance system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="student@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Link href="/reset-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            {/* <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Demo Accounts</span>
              </div>
            </div> */}

            {/* <div className="space-y-2 text-xs">
              <div className="p-2 rounded bg-muted">
                <div className="font-semibold">Student: student@school.edu / password</div>
              </div>
              <div className="p-2 rounded bg-muted">
                <div className="font-semibold">Teacher: teacher@school.edu / password</div>
              </div>
              <div className="p-2 rounded bg-muted">
                <div className="font-semibold">Admin: admin@school.edu / password</div>
              </div>
            </div> */}
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}