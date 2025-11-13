"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface FacialScanProps {
  onComplete: (result: any) => void
  onBack: () => void
  sessionData: any
  accessCode: string
}

export default function FacialScan({ onComplete, onBack, sessionData, accessCode }: FacialScanProps) {
  const [studentId, setStudentId] = useState("")
  const [studentUuid, setStudentUuid] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const [scanning, setScanning] = useState(false)
  const [challenge, setChallenge] = useState<"blink" | "smile" | "turn" | null>(null)
  const [progress, setProgress] = useState(0)
  const [image, setImage] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // === LOG PROPS ON MOUNT ===
  useEffect(() => {
    console.log("FacialScan received:", { sessionData })
  }, [sessionData])

  // === STUDENT LOOKUP ===
  const lookupStudent = async () => {
    if (!studentId.trim()) {
      setLookupError("Please enter your Student ID")
      return
    }
    try {
      setLookupError(null)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !anonKey) throw new Error("Supabase config missing")

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
      if (!res.ok) throw new Error(`Student lookup failed: ${res.status}`)
      const data = await res.json()

      if (!data || data.length === 0) {
        setLookupError("Student ID not found.")
        return
      }

      const uuid = data[0].id
      setStudentUuid(uuid)
      await startCamera()
    } catch (error: any) {
      setLookupError("Failed to verify Student ID.")
      console.error(error)
    }
  }

  // === CAMERA ===
  const startCamera = async () => {
    try {
      setCameraReady(false)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!
          const onReady = () => {
            if (video.readyState >= 2 && video.videoWidth > 0) {
              setCameraReady(true)
              resolve()
            }
          }
          video.onloadedmetadata = onReady
          video.oncanplay = onReady
          video.play().catch(reject)
          setTimeout(() => reject(new Error("Camera timeout")), 10000)
        })
      }
      setStream(mediaStream)
    } catch (err) {
      alert("Camera access denied. Please allow camera and try again.")
      stopCamera()
    }
  }

  const stopCamera = () => {
    setCameraReady(false)
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
    if (videoRef.current) videoRef.current.srcObject = null
  }

  // === START SCAN ===
  const startScan = async () => {
    if (!studentUuid) return alert("Verify Student ID first")
    if (!cameraReady) return alert("Camera not ready")
    if (!accessCode) {
      alert("Session access code missing. Please contact your instructor or try again from the session dashboard.");
      return;
    }
    setScanning(true)
    setTimeout(captureAndSendFrame, 1000)
  }

  // === CAPTURE & SEND ===
  // ...imports and component definition stay the same...

// === CAPTURE & SEND ===
const captureAndSendFrame = async () => {
  try {
    const video = videoRef.current;
    if (!video || !studentUuid) throw new Error("Missing video or student");

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context failed");
    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
    setImage(base64);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) throw new Error("Supabase config missing");

    const body = {
      student_uuid: studentUuid,
      image: base64,
      access_code: accessCode,
    };

    console.log("Sending to rapid-handler:", {
      student_uuid: studentUuid,
      access_code: accessCode,
      image_size: base64.length,
    });

    const res = await fetch(`${supabaseUrl}/functions/v1/rapid-handler`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Server error: ${err}`);
    }

    const data = await res.json();
    console.log("rapid-handler response:", data);

    if (data.siamese?.similarity > 0.8) {
      stopCamera();
      onComplete({
        success: true,
        studentId,
        studentUuid,
        sessionId: sessionData?.session_id,
        sessionUuid: sessionData?.id,
        unitId: sessionData?.unit_id,
        unitName: sessionData?.unit?.name,
        confidence: data.siamese.similarity,
        livenessScore: data.liveness?.liveness_score || 0,
        timestamp: new Date(),
      });
    } else {
      alert(`Face mismatch: ${(data.siamese?.similarity * 100).toFixed(1)}%`);
      setScanning(false);
    }
  } catch (err: any) {
    console.error("Liveness scan failed:", err);
    alert(`Liveness failed: ${err.message}`);
    setScanning(false);
    stopCamera();
  }
};

  // === CHALLENGE CYCLE ===
  useEffect(() => {
    if (!scanning) return
    const challenges: Array<"blink" | "smile" | "turn"> = ["blink", "smile", "turn"]
    let i = 0
    const timer = setInterval(() => {
      if (i < challenges.length) {
        setChallenge(challenges[i++])
      } else {
        clearInterval(timer)
        setScanning(false)
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [scanning])

  useEffect(() => {
    if (!challenge) return
    const t = setInterval(() => setProgress((p) => (p >= 100 ? 100 : p + 10)), 200)
    return () => clearInterval(t)
  }, [challenge])

  useEffect(() => () => stopCamera(), [])

  const getChallengeText = () => {
    switch (challenge) {
      case "blink": return "Blink your eyes"
      case "smile": return "Smile for the camera"
      case "turn": return "Turn your head slightly"
      default: return "Hold still..."
    }
  }

  const handleResetStudent = () => {
    setStudentUuid(null)
    setStudentId("")
    setLookupError(null)
    stopCamera()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-primary/5 to-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-
        8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Facial Recognition</h1>
          <p className="text-muted-foreground">
            {!studentUuid ? "Enter your Student ID" : "Position your face in the frame"}
          </p>
        </div>

        <Card className="p-8 border border-border">
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
                  onChange={(e) => setStudentId(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && lookupStudent()}
                  className="mt-2"
                />
                {lookupError && <p className="text-sm text-destructive mt-2">{lookupError}</p>}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={onBack} className="flex-1">
                  Change Session
                </Button>
                <Button onClick={lookupStudent} className="flex-1">
                  Verify ID
                </Button>
              </div>
            </div>
          )}

          {/* === FACIAL SCAN === */}
          {studentUuid && (
            <>
              <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden mb-6">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <p className="text-white text-sm">Loading camera...</p>
                  </div>
                )}
                {scanning && challenge && (
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/20 to-transparent animate-scan-line" />
                )}
              </div>

              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    ID: <span className="font-semibold text-foreground">{studentId}</span>
                  </p>
                  {sessionData?.unit?.name && (
                    <p className="text-xs text-muted-foreground">Unit: {sessionData.unit.name}</p>
                  )}
                  {cameraReady && <p className="text-xs text-green-600">Camera ready</p>}
                  <p className="text-lg font-semibold mt-2">{getChallengeText()}</p>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="bg-accent h-full transition-all duration-200" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleResetStudent} className="flex-1">
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