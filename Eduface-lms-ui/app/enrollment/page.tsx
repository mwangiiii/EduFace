"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Camera, Loader2, AlertCircle } from "lucide-react";

export default function EnrollmentPage() {
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [course, setCourse] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const REQUIRED_IMAGES = 20; // 20+ for maximum security

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      setError("Camera access denied or not available");
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Capture single frame
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  // Auto-capture loop
  const startCaptureSession = async () => {
    setIsCapturing(true);
    setCapturedCount(0);
    setCapturedImages([]);
    setError("");

    let count = 0;
    const interval = setInterval(() => {
      const frame = captureFrame();
      if (frame) {
        setCapturedImages(prev => [...prev, frame]);
        count++;
        setCapturedCount(count);

        if (count >= REQUIRED_IMAGES) {
          clearInterval(interval);
          setIsCapturing(false);
        }
      }
    }, 600); // Every 0.6s → ~12 seconds total

    // Safety timeout
    setTimeout(() => {
      clearInterval(interval);
      setIsCapturing(false);
      if (count < 10) {
        setError("Too few images captured. Please hold still and try again.");
      }
    }, 15000);
  };

  // Submit to enroll-face
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (capturedImages.length < 15) {
      setError("Not enough images captured. Need at least 15.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/functions/v1/enroll-face", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(window as any).supabase?.auth?.session?.access_token}`
        },
        body: JSON.stringify({
          student_id: studentId,
          images: capturedImages // ← pure array of base64 strings
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Enrollment failed");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Enrollment failed – please try again");
    } finally {
      setSubmitting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  if (submitted) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 pl-64">
          <Navbar />
          <main className="pt-16 p-6">
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-12 pb-12 text-center">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Enrollment Successful!</h2>
                <p className="text-muted-foreground">
                  Your face has been securely enrolled with {capturedImages.length} high-quality images.
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Face Enrollment</h1>
            <p className="text-muted-foreground mb-8">
              Hold still — we will capture 20+ photos automatically for maximum security
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Student Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name</label>
                      <Input value={fullName} onChange={e => setFullName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Student ID</label>
                      <Input value={studentId} onChange={e => setStudentId(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Course</label>
                      <Input value={course} onChange={e => setCourse(e.target.value)} required />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      disabled={capturedImages.length < 15 || submitting}
                    >
                      {submitting ? (
                        <>Submitting... <Loader2 className="ml-2 h-4 w-4 animate-spin" /></>
                      ) : (
                        `Complete Enrollment (${capturedImages.length}/20+)`
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Camera */}
              <Card>
                <CardHeader>
                  <CardTitle>Face Capture</CardTitle>
                  <CardDescription>Look straight at camera • Good lighting • No glasses/hat</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full aspect-video object-cover"
                      onLoadedMetadata={() => videoRef.current?.play()}
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {isCapturing && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center text-white">
                          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                          <p className="text-xl font-semibold">Capturing {capturedCount}/{REQUIRED_IMAGES}+</p>
                          <Progress value={(capturedCount / REQUIRED_IMAGES) * 100} className="w-64 mx-auto mt-4" />
                          <p className="text-sm mt-2">Hold still...</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isCapturing && capturedImages.length === 0 && (
                    <Button onClick={() => { startCamera(); startCaptureSession(); }} className="w-full" size="lg">
                      <Camera className="mr-2 h-5 w-5" /> Start Face Capture
                    </Button>
                  )}

                  {capturedImages.length > 0 && (
                    <Alert className={capturedImages.length >= 15 ? "border-green-500" : "border-orange-500"}>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        {capturedImages.length >= 15
                          ? `✅ Ready! Captured ${capturedImages.length} images`
                          : `Capturing... ${capturedImages.length}/${REQUIRED_IMAGES} images`}
                      </AlertDescription>
                    </Alert>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
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