"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface FacialScanProps {
  onComplete: (result: any) => void
  onBack: () => void
}

export default function FacialScan({ onComplete, onBack }: FacialScanProps) {
  const [scanning, setScanning] = useState(false)
  const [challenge, setChallenge] = useState<"blink" | "smile" | "turn" | null>(null)
  const [progress, setProgress] = useState(0)
  const [image, setImage] = useState<string | null>(null)
  const [livenessResult, setLivenessResult] = useState<any>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      })
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
      }
      setStream(mediaStream)
    } catch (error) {
      console.error("Error accessing camera:", error)
      alert("Camera access denied or unavailable. Please allow camera permissions and try again.")
      setScanning(false)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }

  const startScan = async () => {
    await startCamera()
    setScanning(true)
    // Delay capture slightly to ensure video is playing
    setTimeout(captureAndSendFrame, 500)
  }

  const captureAndSendFrame = async () => {
  try {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      throw new Error("Video not ready")
    }

    // Capture the current frame from the camera
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (ctx) ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1] // 80% quality for smaller size
    setImage(base64)

    console.log("Sending image to Supabase..."); // Debug log

    // Send the captured frame to the backend
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      throw new Error("Supabase env vars not set");
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/rapid-handler  `, {  // <-- Fixed URL here
      method: "POST",
      mode: "cors", // Explicitly set
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ image: base64 })
    });

    console.log("Response status:", res.status); // Debug log

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json()
    setLivenessResult(data)
    console.log("Liveness result:", data)

    if (data.liveness_score >= 0.5) {
      stopCamera();
      onComplete({
        success: true,
        confidence: data.liveness_score,
        timestamp: new Date(),
      })
    } else {
      alert("Spoof detected. Please try again.")
      setScanning(false)
      stopCamera();
    }
  } catch (error) {
    console.error("Error during liveness detection:", error)
    alert(`Liveness detection failed: ${error.message}`)
    setScanning(false)
    stopCamera();
  }
}

  useEffect(() => {
    if (!scanning) return

    // Simulate anti-spoofing challenges
    const challenges: Array<"blink" | "smile" | "turn"> = ["blink", "smile", "turn"]
    let currentChallenge = 0

    const timer = setInterval(() => {
      if (currentChallenge < challenges.length) {
        setChallenge(challenges[currentChallenge])
        currentChallenge++
      } else {
        clearInterval(timer)
        // Optionally call captureAndSendFrame here if you want post-challenge verification
        setScanning(false)
        stopCamera();
        onComplete({
          facialMatch: true,
          confidence: 0.98,
          timestamp: new Date(),
          challenges: challenges,
        })
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [scanning, onComplete])

  useEffect(() => {
    if (challenge) {
      const progressTimer = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(progressTimer)
            return 100
          }
          return p + 10
        })
      }, 200)
      return () => clearInterval(progressTimer)
    }
  }, [challenge])

  useEffect(() => {
    return () => {
      stopCamera() 
    }
  }, [])

  const getChallengeText = () => {
    switch (challenge) {
      case "blink":
        return "Blink your eyes"
      case "smile":
        return "Smile for the camera"
      case "turn":
        return "Turn your head slightly"
      default:
        return "Initializing facial scan..."
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-primary/5 to-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Facial Recognition</h1>
          <p className="text-muted-foreground">Position your face in the frame</p>
        </div>

        <Card className="p-8 border border-border">
          <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden mb-6">
            {/* Camera feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ display: scanning ? 'block' : 'none' }}
            />
            {/* Fallback simulation if not scanning */}
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-40 border-2 border-primary rounded-2xl animate-pulse-subtle" />
              </div>
            )}

            {/* Scan line animation */}
            {challenge && (
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/20 to-transparent animate-scan-line" />
            )}
          </div>

          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground mb-2">{getChallengeText()}</p>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="bg-accent h-full transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack} className="flex-1 bg-transparent">
                Back
              </Button>
              {!scanning ? (
                <Button onClick={startScan} className="flex-1">
                  Start Scan
                </Button>
              ) : (
                <Button disabled className="flex-1 bg-accent text-accent-foreground">
                  Scanning...
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}