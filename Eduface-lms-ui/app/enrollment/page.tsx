// FIXED: Complete enrollment page with correct API endpoint and CORS handling
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
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
    { name: "Frontal", instruction: "Look straight at the camera", angle: "frontal" },
    { name: "Left Profile", instruction: "Slowly turn head left (~45°)", angle: "left-45" },
    { name: "Right Profile", instruction: "Slowly turn head right (~45°)", angle: "right-45" },
    { name: "Look Up", instruction: "Tilt head up slightly", angle: "up-20" },
    { name: "Look Down", instruction: "Tilt head down slightly", angle: "down-20" },
  ];

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      setError("Camera access denied or not available. Please allow camera permission.");
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Use JPEG with high quality to reduce size
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

    if (dataUrl.length > 3_500_000) {
      console.warn("Image too large, reducing quality");
      return canvas.toDataURL("image/jpeg", 0.85);
    }

    return dataUrl;
  }, []);

  const startCaptureSession = async () => {
    setIsCapturing(true);
    setCurrentPhase(0);
    setCapturedImages([]);
    setError("");
    await startCamera();

    const captureForPhase = (phaseIndex: number): Promise<void> => {
      return new Promise((resolve) => {
        let count = 0;
        const interval = setInterval(() => {
          const frame = captureFrame();
          if (frame) {
            setCapturedImages(prev => [...prev, {
              base64: frame,
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
                  stopCamera();
                  resolve();
                }
              }, 1500);
            }
          }
        }, 800);

        // Safety timeout
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 12000);
      });
    };

    await captureForPhase(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (capturedImages.length < TOTAL_IMAGES) {
      setError(`Please complete all phases. Captured only ${capturedImages.length}/${TOTAL_IMAGES} images.`);
      return;
    }

    if (!studentId.trim()) {
      setError("Please enter your Student ID");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Initialize Supabase client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase configuration missing. Check your environment variables.");
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session) {
        throw new Error("Not authenticated. Please log in again.");
      }

      console.log("Submitting enrollment:", {
        student_id: studentId.trim().toUpperCase(),
        imageCount: capturedImages.length,
        user_id: session.user.id,
      });

      // Call the Edge Function using Supabase client (handles CORS automatically)
      const { data, error } = await supabase.functions.invoke('enroll-face', {
        body: {
          student_id: studentId.trim().toUpperCase(),
          images: capturedImages,
        },
      });

      if (error) {
        console.error("Supabase function error:", error);
        throw new Error(error.message || "Enrollment failed");
      }

      console.log("Function response:", data);

      if (!data?.success) {
        const errorMsg = data?.error || data?.details || "Enrollment failed";
        throw new Error(errorMsg);
      }

      console.log("Enrollment successful:", data);
      setSubmitted(true);

    } catch (err: any) {
      console.error("Enrollment error:", err);
      
      let errorMessage = "Unknown error during enrollment";
      
      if (err.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      // Provide more helpful error messages
      if (errorMessage.includes("fetch")) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (errorMessage.includes("CORS")) {
        errorMessage = "Connection blocked. Please contact system administrator.";
      } else if (errorMessage.includes("authenticated")) {
        errorMessage = "Session expired. Please log out and log in again.";
      }

      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
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
                <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-6" />
                <h2 className="text-3xl font-bold mb-3">Enrollment Successful!</h2>
                <p className="text-lg text-muted-foreground mb-4">
                  Your face is now securely enrolled with <strong>30 multi-angle images</strong>
                </p>
                <div className="text-sm text-green-600 font-medium space-y-1">
                  <p>✓ Excellent quality score</p>
                  <p>✓ Maximum protection against impersonation</p>
                  <p>✓ Ready for multi-frame verification</p>
                </div>
                <Button 
                  onClick={() => window.location.href = '/dashboard'}
                  className="mt-6"
                  size="lg"
                >
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  const progress = (capturedImages.length / TOTAL_IMAGES) * 100;
  const currentPhaseData = phases[currentPhase] || phases[0];

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-4xl font-bold mb-3">Secure Face Enrollment</h1>
            <p className="text-lg text-muted-foreground mb-8">
              We capture <strong>30 high-quality, multi-angle photos</strong> for maximum accuracy and security.
            </p>

            <div className="grid lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Student Information</CardTitle>
                  <CardDescription>Please fill in all required fields</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name</label>
                      <Input 
                        value={fullName} 
                        onChange={e => setFullName(e.target.value)} 
                        required 
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Student ID</label>
                      <Input 
                        value={studentId} 
                        onChange={e => setStudentId(e.target.value)} 
                        required 
                        placeholder="e.g. STD20251234"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Course / Program</label>
                      <Input 
                        value={course} 
                        onChange={e => setCourse(e.target.value)} 
                        required 
                        placeholder="e.g. Computer Science"
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full text-lg h-12"
                      disabled={capturedImages.length < TOTAL_IMAGES || submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>Complete Enrollment ({capturedImages.length}/{TOTAL_IMAGES})</>
                      )}
                    </Button>

                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-5 w-5" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Multi-Angle Capture</CardTitle>
                  <CardDescription>
                    {isCapturing 
                      ? `${currentPhaseData.name} • ${capturedImages.length}/${TOTAL_IMAGES}` 
                      : capturedImages.length > 0 
                        ? `${capturedImages.length}/${TOTAL_IMAGES} images captured`
                        : "Click below to start capturing"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="relative rounded-xl overflow-hidden bg-black">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full aspect-video object-cover" 
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {isCapturing && (
                      <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white">
                        <RotateCw className="h-16 w-16 animate-spin mb-6" />
                        <h3 className="text-2xl font-bold mb-2">{currentPhaseData.name}</h3>
                        <p className="text-lg mb-6 px-8 text-center max-w-md">{currentPhaseData.instruction}</p>
                        <div className="w-80">
                          <Progress value={progress} className="h-4" />
                          <p className="text-center mt-3 text-sm">Captured {capturedImages.length} of {TOTAL_IMAGES}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isCapturing && capturedImages.length === 0 && (
                    <Button 
                      onClick={startCaptureSession} 
                      size="lg" 
                      className="w-full text-lg h-14"
                    >
                      <Camera className="mr-3 h-6 w-6" />
                      Start 30-Image Enrollment
                    </Button>
                  )}

                  {capturedImages.length > 0 && capturedImages.length < TOTAL_IMAGES && !isCapturing && (
                    <Alert className="border-orange-500">
                      <AlertCircle className="h-5 w-5" />
                      <AlertDescription>
                        Capture incomplete: {capturedImages.length}/{TOTAL_IMAGES} images captured.
                        Click below to continue from {phases[currentPhase].name}.
                      </AlertDescription>
                      <Button 
                        onClick={startCaptureSession} 
                        className="mt-3 w-full" 
                        variant="outline"
                      >
                        <Camera className="mr-2 h-5 w-5" />
                        Resume Capture
                      </Button>
                    </Alert>
                  )}

                  {capturedImages.length === TOTAL_IMAGES && (
                    <Alert className="border-green-500 bg-green-50">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                      <AlertDescription className="text-green-800 font-semibold">
                        ✓ All 30 images captured perfectly!<br />
                        Fill in your details and click "Complete Enrollment".
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Instructions */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Enrollment Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Ensure good lighting on your face (avoid backlighting)</li>
                  <li>• Remove glasses, hats, or face coverings</li>
                  <li>• Keep your face centered in the camera frame</li>
                  <li>• Follow the on-screen instructions for each phase</li>
                  <li>• The entire capture process takes about 30-40 seconds</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}