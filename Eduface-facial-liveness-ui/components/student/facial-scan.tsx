"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Camera, CheckCircle2 } from "lucide-react"

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
  const [captureCount, setCaptureCount] = useState(0)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const capturedFramesRef = useRef<string[]>([])

  // === CONFIGURATION ===
  const TOTAL_FRAMES = 30 // Capture 30 frames for redundancy
  const CAPTURE_INTERVAL_MS = 200 // 200ms between captures = ~5 FPS (6 seconds total)

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

  // === CAPTURE SINGLE FRAME ===
  const captureFrame = (): string | null => {
    const video = videoRef.current
    if (!video) return null

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    
    if (!ctx) return null

    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1]
    
    return base64
  }

  // === START SCAN - AUTOMATED MULTI-FRAME CAPTURE ===
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

    console.log("Starting automated capture sequence...")
    setScanning(true)
    setProgress(5)
    setCaptureCount(0)
    capturedFramesRef.current = []
    setVerificationStatus("Get ready... Look at the camera")

    // Give user 2 seconds to prepare
    await new Promise(resolve => setTimeout(resolve, 2000))

    // === CAPTURE FRAMES AUTOMATICALLY ===
    setVerificationStatus("Capturing frames...")
    
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const frame = captureFrame()
      
      if (frame) {
        capturedFramesRef.current.push(frame)
        setCaptureCount(i + 1)
        setProgress(10 + (i + 1) * (50 / TOTAL_FRAMES))
        
        console.log(`Frame ${i + 1}/${TOTAL_FRAMES} captured (${frame.length} chars)`)
      }
      
      // Wait before next capture (except last frame)
      if (i < TOTAL_FRAMES - 1) {
        await new Promise(resolve => setTimeout(resolve, CAPTURE_INTERVAL_MS))
      }
    }

    console.log(`Captured ${capturedFramesRef.current.length} frames total`)

    if (capturedFramesRef.current.length < 15) {
      alert(`Only captured ${capturedFramesRef.current.length}/30 frames. Please ensure stable camera and try again.`)
      resetScan()
      return
    }

    console.log(`✅ Captured ${capturedFramesRef.current.length} frames - sending to rapid-handler for liveness filtering`)

    // === SEND TO RAPID-HANDLER (it will select best 10) ===
    await sendToVerification()
  }

  // === SEND ALL FRAMES TO RAPID-HANDLER ===
  const sendToVerification = async () => {
    try {
      setProgress(60)
      setVerificationStatus("Checking liveness...")

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !anonKey) {
        throw new Error("Supabase configuration missing")
      }

      const body = {
        student_uuid: studentUuid,
        images: capturedFramesRef.current, // ← Send array of frames
        session_id: sessionId
      }

      console.log("Sending to rapid-handler:", {
        student_uuid: studentUuid,
        session_id: sessionId,
        frame_count: capturedFramesRef.current.length,
        total_size: capturedFramesRef.current.reduce((sum, img) => sum + img.length, 0),
        note: "rapid-handler will filter by liveness and select best 10"
      })

      setProgress(70)
      setVerificationStatus("Verifying identity...")

      const res = await fetch(`${supabaseUrl}/functions/v1/rapid-handler`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      console.log("rapid-handler response:", data)

      setProgress(85)

      // === HANDLE ERRORS ===
      if (!res.ok || data.error) {
        const errorMsg = data.error || data.details || "Verification failed"
        
        // Provide helpful feedback
        if (errorMsg.includes("Liveness failed")) {
          throw new Error(
            `Liveness check failed (${data.valid_frames || 0}/${data.required || 5} frames passed).\n\n` +
            `Tips:\n• Ensure good lighting\n• Look directly at camera\n• Hold steady\n• Remove glasses if possible`
          )
        } else if (errorMsg.includes("not enrolled")) {
          throw new Error("Your face is not enrolled. Please complete enrollment first.")
        } else if (errorMsg.includes("session")) {
          throw new Error("Invalid or expired session. Please check your code.")
        } else {
          throw new Error(errorMsg)
        }
      }

      setProgress(95)

      // === CHECK VERIFICATION RESULT ===
      const verified = data.verified || false
      const siamese = data.siamese || {}
      const confidence = siamese.confidence || 0
      const liveness = data.liveness || {}

      console.log("Verification result:", {
        verified,
        confidence,
        frames_processed: siamese.frames_processed,
        negatives_used: siamese.negatives_used,
        liveness_passed: liveness.passed,
        liveness_total: liveness.total
      })

      setProgress(100)

      if (verified) {
        setVerificationStatus("✓ Verification successful!")
        
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
            confidence: confidence,
            framesProcessed: siamese.frames_processed,
            negativesUsed: siamese.negatives_used,
            livenessScore: `${liveness.passed}/${liveness.total}`,
            attendanceId: siamese.attendance_id,
            timestamp: new Date(),
          })
        }, 1000)
      } else {
        const failureMessage = 
          `Face verification failed.\n\n` +
          `Confidence: ${typeof confidence === 'number' ? (confidence * 100).toFixed(1) + '%' : confidence}\n` +
          `Frames processed: ${siamese.frames_processed || 0}\n` +
          `Liveness: ${liveness.passed}/${liveness.total}\n\n` +
          `Please ensure:\n` +
          `• Good lighting on your face\n` +
          `• Face clearly visible (no masks/hats)\n` +
          `• You are the enrolled student\n` +
          `• Camera is stable`

        alert(failureMessage)
        resetScan()
      }
    } catch (err: any) {
      console.error("Verification error:", err)
      alert(err.message || "Verification failed. Please try again.")
      resetScan()
    }
  }

  // === RESET SCAN STATE ===
  const resetScan = () => {
    setScanning(false)
    setProgress(0)
    setCaptureCount(0)
    setVerificationStatus(null)
    capturedFramesRef.current = []
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
    resetScan()
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
                
                {/* Capture indicator */}
                {scanning && captureCount > 0 && (
                  <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg">
                    <Camera className="h-4 w-4" />
                    {captureCount}/{TOTAL_FRAMES}
                  </div>
                )}

                {/* Scanning animation */}
                {scanning && (
                  <div className="absolute inset-0 border-4 border-green-500 animate-pulse pointer-events-none" />
                )}

                {/* Progress overlay */}
                {scanning && verificationStatus && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {progress < 100 ? (
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      <p className="text-white text-sm flex-1">{verificationStatus}</p>
                    </div>
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
                    <div className="flex items-center justify-center gap-2 text-xs text-green-600 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Camera ready - Will capture {TOTAL_FRAMES} frames (system selects best 10)
                    </div>
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
                      <Camera className="mr-2 h-4 w-4" />
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