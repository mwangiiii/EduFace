"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface FacialScanProps {
  onComplete: (result: any) => void
  onBack: () => void
  sessionData: any
  sessionId: string
}

export default function FacialScan({ onComplete, onBack, sessionData, sessionId }: FacialScanProps) {
  const [studentId, setStudentId] = useState("")
  const [studentUuid, setStudentUuid] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // === LOG PROPS ON MOUNT ===
  useEffect(() => {
    console.log("FacialScan received:", { sessionData, sessionId })
  }, [sessionData, sessionId])

  // === STUDENT LOOKUP ===
  const lookupStudent = async () => {
    if (!studentId.trim()) {
      setLookupError("Please enter your Student ID")
      return
    }
    
    setIsVerifying(true)
    
    try {
      setLookupError(null)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !anonKey) {
        throw new Error("Supabase configuration missing")
      }

      console.log("Looking up student ID:", studentId.trim())

      const res = await fetch(
        `${supabaseUrl}/rest/v1/students?student_id=eq.${studentId.trim()}&select=id`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
        }
      )

      if (!res.ok) {
        throw new Error(`Student lookup failed: ${res.status}`)
      }

      const data = await res.json()
      console.log("Student lookup response:", data)

      if (!data || data.length === 0) {
        setLookupError("Student ID not found. Please check your ID and try again.")
        setIsVerifying(false)
        return
      }

      const uuid = data[0].id
      console.log("Student UUID found:", uuid)
      
      setStudentUuid(uuid)
      setIsVerifying(false)
      
      // Start camera after successful lookup
      await startCamera()
    } catch (error: any) {
      console.error("Student lookup error:", error)
      setLookupError("Failed to verify Student ID. Please try again.")
      setIsVerifying(false)
    }
  }

  // === CAMERA ===
  const startCamera = async () => {
    try {
      setCameraReady(false)
      console.log("Requesting camera access...")
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          facingMode: "user" 
        },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!
          
          const onReady = () => {
            if (video.readyState >= 2 && video.videoWidth > 0) {
              console.log("Camera ready:", {
                width: video.videoWidth,
                height: video.videoHeight
              })
              setCameraReady(true)
              resolve()
            }
          }
          
          video.onloadedmetadata = onReady
          video.oncanplay = onReady
          video.play().catch(reject)
          
          // 10 second timeout
          setTimeout(() => reject(new Error("Camera timeout")), 10000)
        })
      }
      
      setStream(mediaStream)
    } catch (err: any) {
      console.error("Camera error:", err)
      alert("Camera access denied. Please allow camera access and try again.")
      stopCamera()
    }
  }

  const stopCamera = () => {
    console.log("Stopping camera...")
    setCameraReady(false)
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
    if (videoRef.current) videoRef.current.srcObject = null
  }

  // === START SCAN ===
  const startScan = async () => {
    if (!studentUuid) {
      alert("Please verify your Student ID first")
      return
    }
    
    if (!cameraReady) {
      alert("Camera not ready. Please wait...")
      return
    }
    
    if (!sessionId) {
      alert("Session ID missing. Please restart from the code entry.")
      return
    }

    console.log("Starting facial scan...")
    setScanning(true)
    setProgress(0)
    setVerificationStatus("Capturing image...")
    
    // Small delay to ensure UI updates
    setTimeout(captureAndSendFrame, 1000)
  }

  // === CAPTURE & SEND ===
  const captureAndSendFrame = async () => {
    try {
      const video = videoRef.current
      if (!video || !studentUuid) {
        throw new Error("Missing video or student UUID")
      }

      setVerificationStatus("Capturing image...")
      setProgress(20)

      // Capture frame from video
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      
      if (!ctx) {
        throw new Error("Canvas context failed")
      }

      ctx.drawImage(video, 0, 0)
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1]

      console.log("Image captured:", {
        width: canvas.width,
        height: canvas.height,
        size: base64.length
      })

      setProgress(40)
      setVerificationStatus("Checking liveness...")

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !anonKey) {
        throw new Error("Supabase configuration missing")
      }

      // === FIXED: Send session_id, not access_code ===
      const body = {
        student_uuid: studentUuid,
        image: base64,
        session_id: sessionId  // ← CORRECT FIELD
      }

      console.log("Sending to rapid-handler:", {
        student_uuid: studentUuid,
        session_id: sessionId,
        image_size: base64.length,
      })

      setProgress(60)
      setVerificationStatus("Verifying face...")

      const res = await fetch(`${supabaseUrl}/functions/v1/rapid-handler`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error("Server error:", errorText)
        throw new Error(`Server error: ${errorText}`)
      }

      const data = await res.json()
      console.log("rapid-handler response:", data)

      setProgress(80)

      // === CHECK VERIFICATION RESULT ===
      if (data.error) {
        throw new Error(data.details || data.error)
      }

      const verified = data.siamese?.verified || false
      const metrics = data.siamese?.metrics || {}
      const maxSimilarity = metrics.max_similarity || 0
      const avgSimilarity = metrics.avg_similarity || 0
      const matchCount = metrics.match_count || 0
      const totalComparisons = metrics.total_comparisons || 0

      console.log("Verification result:", {
        verified,
        maxSimilarity,
        avgSimilarity,
        matchCount,
        totalComparisons
      })

      setProgress(100)

      if (verified && maxSimilarity >= 0.8) {
        setVerificationStatus("Verification successful!")
        
        setTimeout(() => {
          stopCamera()
          onComplete({
            success: true,
            studentId,
            studentUuid,
            sessionId: sessionData?.session_id,
            sessionUuid: sessionData?.id,
            unitId: sessionData?.unit_id,
            unitName: sessionData?.unit?.name,
            confidence: maxSimilarity,
            avgConfidence: avgSimilarity,
            matchCount: matchCount,
            totalComparisons: totalComparisons,
            livenessScore: data.liveness?.liveness_score || 0,
            timestamp: new Date(),
          })
        }, 500)
      } else {
        const failureMessage = 
          `Face verification failed:\n\n` +
          `Max Similarity: ${(maxSimilarity * 100).toFixed(1)}%\n` +
          `Average Similarity: ${(avgSimilarity * 100).toFixed(1)}%\n` +
          `Matches: ${matchCount}/${totalComparisons}\n\n` +
          `Please ensure:\n` +
          `• Good lighting\n` +
          `• Face clearly visible\n` +
          `• No obstructions\n` +
          `• You are the enrolled student`

        alert(failureMessage)
        setScanning(false)
        setProgress(0)
        setVerificationStatus(null)
      }
    } catch (err: any) {
      console.error("Verification failed:", err)
      
      let errorMessage = "Verification failed: "
      
      if (err.message.includes("Liveness")) {
        errorMessage += "Liveness check failed. Please ensure good lighting and try again."
      } else if (err.message.includes("not enrolled")) {
        errorMessage += "Face not enrolled. Please complete enrollment first."
      } else if (err.message.includes("session")) {
        errorMessage += "Invalid session. Please check your code and try again."
      } else {
        errorMessage += err.message || "Unknown error occurred"
      }
      
      alert(errorMessage)
      setScanning(false)
      setProgress(0)
      setVerificationStatus(null)
    }
  }

  // === CLEANUP ON UNMOUNT ===
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const handleResetStudent = () => {
    setStudentUuid(null)
    setStudentId("")
    setLookupError(null)
    setProgress(0)
    setVerificationStatus(null)
    stopCamera()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-primary/5 to-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Facial Recognition</h1>
          <p className="text-muted-foreground">
            {!studentUuid ? "Enter your Student ID to begin" : "Position your face in the frame"}
          </p>
        </div>

        <Card className="p-8 border border-border shadow-lg">
          {/* === STUDENT ID ENTRY === */}
          {!studentUuid && (
            <div className="space-y-4">
              {sessionData?.unit?.name && (
                <div className="mb-4 p-3 bg-primary/5 rounded-md text-sm">
                  <p className="text-xs text-muted-foreground">Session:</p>
                  <p className="font-semibold">{sessionData.unit.name}</p>
                </div>
              )}

              <div>
                <Label htmlFor="studentId">Student ID</Label>
                <Input
                  id="studentId"
                  placeholder="e.g., STU12345"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === "Enter" && !isVerifying && lookupStudent()}
                  disabled={isVerifying}
                  className="mt-2"
                />
                {lookupError && (
                  <p className="text-sm text-destructive mt-2">{lookupError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={onBack} 
                  className="flex-1"
                  disabled={isVerifying}
                >
                  Change Session
                </Button>
                <Button 
                  onClick={lookupStudent} 
                  className="flex-1"
                  disabled={isVerifying || !studentId.trim()}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify ID"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* === FACIAL SCAN === */}
          {studentUuid && (
            <>
              <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden mb-6">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                />
                
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-2" />
                      <p className="text-white text-sm">Loading camera...</p>
                    </div>
                  </div>
                )}
                
                {scanning && (
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/20 to-transparent animate-pulse" />
                )}

                {/* Progress overlay */}
                {scanning && verificationStatus && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4">
                    <p className="text-white text-sm mb-2 text-center">{verificationStatus}</p>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-green-500 h-full transition-all duration-300" 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="p-3 bg-primary/5 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Student ID
                    </p>
                    <p className="font-semibold text-foreground">{studentId}</p>
                  </div>
                  
                  {sessionData?.unit?.name && (
                    <p className="text-xs text-muted-foreground">
                      Unit: {sessionData.unit.name}
                    </p>
                  )}
                  
                  {cameraReady && !scanning && (
                    <p className="text-xs text-green-600 font-medium">
                      Camera ready
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleResetStudent} 
                    className="flex-1"
                    disabled={scanning}
                  >
                    Change ID
                  </Button>
                  {!scanning ? (
                    <Button
                      onClick={startScan}
                      disabled={!cameraReady}
                      className="flex-1"
                    >
                      Start Scan
                    </Button>
                  ) : (
                    <Button disabled className="flex-1">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}