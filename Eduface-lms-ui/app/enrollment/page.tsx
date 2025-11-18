"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Camera, Loader2, AlertCircle, RotateCw } from "lucide-react";

interface CapturedImage {
  base64: string;
  angle: string;
}

export default function EnrollmentPage() {
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [course, setCourse] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const TOTAL_IMAGES = 30;
  const IMAGES_PER_PHASE = 6;

  const phases = [
    { name: "Frontal", instruction: "Look straight at camera", angle: "frontal" },
    { name: "Left Profile", instruction: "Slowly turn head left (~45°)", angle: "left-45" },
    { name: "Right Profile", instruction: "Slowly turn head right (~45°)", angle: "right-45" },
    { name: "Look Up", instruction: "Tilt head up slightly", angle: "up-20" },
    { name: "Look Down", instruction: "Tilt head down slightly", angle: "down-20" },
  ];

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" } // Higher res = better quality
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      setError("Camera access denied. Please allow camera permission.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.95); // Max quality
  }, []);

  const startCaptureSession = async () => {
    setIsCapturing(true);
    setCurrentPhase(0);
    setCapturedImages([]);
    setError("");
    await startCamera();

    const captureForPhase = (phaseIndex: number) => {
      return new Promise<void>((resolve) => {
        let count = 0;
        const interval = setInterval(() => {
          const frame = captureFrame();
          if (frame) {
            const cleanBase64 = frame.split(",")[1]; // Remove data: prefix
            setCapturedImages(prev => [...prev, {
              base64: cleanBase64,
              angle: phases[phaseIndex].angle
            }]);
            count++;
            if (count >= IMAGES_PER_PHASE) {
              clearInterval(interval);
              setTimeout(() => {
                if (phaseIndex < phases.length - 1) {
                  setCurrentPhase(phaseIndex + 1);
                  captureForPhase(phaseIndex + 1).then(resolve);
                } else {
                  setIsCapturing(false);
                  resolve();
                }
              }, 1500); // Pause between phases
            }
          }
        }, 800); // 800ms = natural movement, high quality

        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 10000);
      });
    };

    await captureForPhase(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (capturedImages.length < 25) {
      setError("Please complete all capture phases (30 images required)");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/functions/v1/enroll-face", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await (window as any).supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          student_id: studentId.trim().toUpperCase(),
          images: capturedImages // Now includes angle hints!
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || "Enrollment failed");
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error("Enrollment error:", err);
      setError(err.message.includes("valid images") 
        ? "Some images were low quality. Try better lighting and hold still."
        : err.message
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => () => stopCamera(), []);

  if (submitted) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 pl-64">
          <Navbar />
          <main className="pt-16 p-6">
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-12 pb-12 text-center">
                <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-6" />
                <h2 className="text-3xl font-bold mb-3">Enrollment Complete!</h2>
                <p className="text-lg text-muted-foreground mb-2">
                  Successfully enrolled with <strong>30 high-quality images</strong>
                </p>
                <p className="text-sm text-green-600 font-medium">
                  ✓ Excellent multi-angle coverage<br/>
                  ✓ Maximum protection against deepfakes & impersonation
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  const currentPhaseData = phases[currentPhase];
  const progress = (capturedImages.length / TOTAL_IMAGES) * 100;

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-4xl font-bold mb-3">Secure Face Enrollment</h1>
            <p className="text-lg text-muted-foreground mb-8">
              We collect <strong>30 multi-angle photos</strong> for maximum security and accuracy
            </p>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Student Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name</label>
                      <Input value={fullName} onChange={e => setFullName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Student ID</label>
                      <Input value={studentId} onChange={e => setStudentId(e.target.value)} required placeholder="e.g. STD20251234" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Course / Program</label>
                      <Input value={course} onChange={e => setCourse(e.target.value)} required />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full text-lg h-12"
                      disabled={capturedImages.length < TOTAL_IMAGES || submitting}
                    >
                      {submitting ? (
                        <>Submitting... <Loader2 className="ml-2 h-5 w-5 animate-spin" /></>
                      ) : (
                        <>Complete Enrollment ({capturedImages.length}/{TOTAL_IMAGES})</>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Camera & Capture */}
              <Card>
                <CardHeader>
                  <CardTitle>Multi-Angle Face Capture</CardTitle>
                  <CardDescription>
                    {isCapturing 
                      ? `${currentPhaseData.name} • ${capturedImages.length}/${TOTAL_IMAGES}`
                      : "Follow instructions for best results"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="ed="relative rounded-xl overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full aspect-video object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {isCapturing && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
                        <RotateCw className="h-16 w-16 animate-spin mb-6" />
                        <h3 className="text-2xl font-bold mb-2">{currentPhaseData.name}</h3>
                        <p className="text-lg mb-6 px-8 text-center">{currentPhaseData.instruction}</p>
                        <div className="w-80">
                          <Progress value={progress} className="h-4" />
                          <p className="text-center mt-3 text-sm">
                            Capturing {capturedImages.length} of {TOTAL_IMAGES} images...
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isCapturing && capturedImages.length === 0 && (
                    <Button onClick={startCaptureSession} size="lg" className="w-full text-lg h-14">
                      <Camera className="mr-3 h-6 w-6" />
                      Begin 30-Image Secure Enrollment
                    </Button>
                  )}

                  {capturedImages.length > 0 && !isCapturing && capturedImages.length < TOTAL_IMAGES && (
                    <Alert className="border-orange-500">
                      <AlertCircle className="h-5 w-5" />
                      <AlertDescription>
                        Capture paused. Click below to resume from {phases[currentPhase].name}
                      </AlertDescription>
                      <Button onClick={startCaptureSession} className="mt-3 w-full">
                        Resume Capture
                      </Button>
                    </Alert>
                  )}

                  {capturedImages.length === TOTAL_IMAGES && (
                    <Alert className="border-green-500 bg-green-50">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                      <AlertDescription className="text-green-800 font-semibold">
                        ✓ Perfect! All 30 multi-angle images captured<br/>
                        You now have maximum protection
                      </AlertDescription>
                    </Alert>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-5 w-5" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}