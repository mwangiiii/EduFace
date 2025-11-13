"use client"

import type React from "react"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Camera } from "lucide-react"
import { useState } from "react"

export default function EnrollmentPage() {
  const [fullName, setFullName] = useState("")
  const [studentId, setStudentId] = useState("")
  const [course, setCourse] = useState("")
  const [faceCaptured, setFaceCaptured] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)

  const handleCaptureFace = () => {
    setCameraActive(true)
    setTimeout(() => {
      setFaceCaptured(true)
      setCameraActive(false)
    }, 2000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (fullName && studentId && course && faceCaptured) {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 pl-64">
          <Navbar />
          <main className="pt-16 p-6">
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-12 pb-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">Enrollment Successful</h2>
                <p className="text-sm text-muted-foreground">
                  Your facial data has been captured and enrollment is complete. You're ready for attendance tracking.
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold mb-2">Student Enrollment</h1>
            <p className="text-muted-foreground mb-6">Complete your facial enrollment for attendance tracking</p>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Enter your details</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name</label>
                      <Input
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Student ID</label>
                      <Input
                        placeholder="STU-2024-001"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Course</label>
                      <Input
                        placeholder="Computer Science"
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!faceCaptured || !fullName || !studentId || !course}
                      className="w-full"
                    >
                      Complete Enrollment
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Facial Capture</CardTitle>
                  <CardDescription>Capture your face for registration</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-border">
                      {cameraActive ? (
                        <div className="w-full h-full flex items-center justify-center bg-black/20">
                          <div className="text-center">
                            <div className="animate-pulse text-2xl mb-2">📷</div>
                            <p className="text-sm text-foreground">Capturing...</p>
                          </div>
                        </div>
                      ) : faceCaptured ? (
                        <div className="text-center">
                          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                          <p className="text-sm font-medium">Face Captured</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Camera Preview</p>
                        </div>
                      )}
                    </div>

                    {faceCaptured && (
                      <Alert className="bg-green-500/10 border-green-500/30">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <AlertDescription className="text-green-700">
                          Your face has been successfully captured
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      onClick={handleCaptureFace}
                      disabled={cameraActive || faceCaptured}
                      className="w-full"
                      variant={faceCaptured ? "outline" : "default"}
                    >
                      {faceCaptured ? "Face Captured" : "Capture Face"}
                    </Button>

                    {!faceCaptured && (
                      <p className="text-xs text-muted-foreground">
                        Position your face in the center of the frame and click the button to capture
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}