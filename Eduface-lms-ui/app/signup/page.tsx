"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabaseClient"

export default function SignupPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [role, setRole] = useState("student")
  const [roleId, setRoleId] = useState("") // New state for student/teacher ID
  const [department, setDepartment] = useState("") // New state for teacher department
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Helper function to generate unique IDs
  const generateRoleId = (role: string, firstName: string, lastName: string): string => {
    const timestamp = Date.now().toString().slice(-6)
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    const prefix = role === 'student' ? 'STU' : role === 'teacher' ? 'TCH' : 'ADM'
    return `${prefix}${timestamp}${initials}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    
    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    const trimmedConfirmPassword = confirmPassword.trim()
    const trimmedRoleId = roleId.trim()
    const trimmedDepartment = department.trim()
    
    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !trimmedPassword || !trimmedConfirmPassword) {
      setError("Please fill in all required fields")
      setLoading(false)
      return
    }

    // Validate role-specific fields
    if (role === 'student' && !trimmedRoleId) {
      setError("Please provide your Student ID")
      setLoading(false)
      return
    }

    if (role === 'teacher' && !trimmedRoleId) {
      setError("Please provide your Teacher ID")
      setLoading(false)
      return
    }

    if (role === 'teacher' && !trimmedDepartment) {
      setError("Please provide your Department")
      setLoading(false)
      return
    }
    
    if (trimmedPassword !== trimmedConfirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }
    
    if (trimmedPassword.length < 8) {
      setError("Password must be at least 8 characters long")
      setLoading(false)
      return
    }

    try {
      // Step 1: Create auth user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: {
          data: { 
            first_name: trimmedFirstName, 
            last_name: trimmedLastName, 
            role 
          },
        },
      })

      if (authError) {
        console.error('Supabase Auth Error:', authError)
        setError(authError.message)
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError("Signup failed: No user data returned")
        setLoading(false)
        return
      }

      // Step 2: Insert into users table (base profile)
      const { error: userInsertError } = await supabase
        .from("users")
        .insert({
          id: authData.user.id,
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          email: trimmedEmail,
          role,
        })

      if (userInsertError) {
        console.error('User Insert Error:', userInsertError)
        setError(`Profile creation failed: ${userInsertError.message}`)
        // Clean up auth user
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      // Step 3: Insert into role-specific table
      if (role === 'student') {
        const { error: studentInsertError } = await supabase
          .from("students")
          .insert({
            user_id: authData.user.id,
            student_id: trimmedRoleId,
            enrollment_date: new Date().toISOString().split('T')[0],
          })

        if (studentInsertError) {
          console.error('Student Insert Error:', studentInsertError)
          setError(`Student profile creation failed: ${studentInsertError.message}`)
          // Clean up - delete user record
          await supabase.from("users").delete().eq('id', authData.user.id)
          await supabase.auth.signOut()
          setLoading(false)
          return
        }
      } else if (role === 'teacher') {
        const { error: teacherInsertError } = await supabase
          .from("teachers")
          .insert({
            user_id: authData.user.id,
            teacher_id: trimmedRoleId,
            department: trimmedDepartment,
            qualifications: null,
          })

        if (teacherInsertError) {
          console.error('Teacher Insert Error:', teacherInsertError)
          setError(`Teacher profile creation failed: ${teacherInsertError.message}`)
          // Clean up
          await supabase.from("users").delete().eq('id', authData.user.id)
          await supabase.auth.signOut()
          setLoading(false)
          return
        }
      } else if (role === 'administrator') {
        console.log('Administrator created - only in users table')
      }

      // Step 4: Store in localStorage for quick access
      localStorage.setItem("userRole", role)
      localStorage.setItem("userEmail", trimmedEmail)
      
      setLoading(false)
      router.push("/dashboard")
      
    } catch (err) {
      console.error('Unexpected error during signup:', err)
      setError("An unexpected error occurred. Please try again.")
      setLoading(false)
    }
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
          <CardTitle className="text-center">Create Account</CardTitle>
          <CardDescription className="text-center">
            Join the attendance system
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
              <label htmlFor="firstName" className="text-sm font-medium">
                First Name
              </label>
              <Input
                id="firstName"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last Name
              </label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="dennis@strathmore.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium">
                Role
              </label>
              <Select value={role} onValueChange={(value) => {
                setRole(value)
                setRoleId("") // Clear role ID when role changes
                setDepartment("") // Clear department when role changes
              }} disabled={loading}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="administrator">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Conditional fields based on role */}
            {role === 'student' && (
              <div className="space-y-2">
                <label htmlFor="roleId" className="text-sm font-medium">
                  Student ID <span className="text-red-500">*</span>
                </label>
                <Input
                  id="roleId"
                  placeholder="e.g., STU123456"
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}
            
            {role === 'teacher' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="roleId" className="text-sm font-medium">
                    Teacher ID <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="roleId"
                    placeholder="e.g., TCH123456"
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="department" className="text-sm font-medium">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="department"
                    placeholder="e.g., Computer Science"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}