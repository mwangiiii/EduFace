// Fixed ProfilePage component with corrected UUID references and responsive capture
"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, X, Check } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"

// Type definitions
interface User {
  id: string
  first_name: string
  last_name: string
  date_of_birth?: string | null
  phone?: string | null
  address?: string | null
  email: string
  role: 'student' | 'teacher' | 'administrator'
}

interface Student {
  id: string // This is the UUID primary key
  user_id: string
  student_id: string // This is the varchar student ID like "STU123456"
  enrollment_date: string
}

interface ProfileData {
  user: User
  student?: Student
  faceEnrolled?: boolean
  faceQuality?: number | null
  lastEnrolled?: string | null
  reEnrollRecommended?: boolean
  enrolledCourses: Array<{ id: string; name: string; status: string }>
}

interface EnrollmentStep {
  id: number
  title: string
  instruction: string
  targetImages: number
  angle: string
}

const ENROLLMENT_STEPS: EnrollmentStep[] = [
  { id: 1, title: "Frontal View", instruction: "Face the camera straight on, good lighting, no obstructions.", targetImages: 5, angle: 'frontal' },
  { id: 2, title: "Left Profile", instruction: "Turn your head to the left (show profile), keep still.", targetImages: 5, angle: 'left' },
  { id: 3, title: "Right Profile", instruction: "Turn your head to the right (show profile), keep still.", targetImages: 5, angle: 'right' },
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>({
    user: { id: '', first_name: '', last_name: '', email: '', role: 'student' },
    enrolledCourses: [],
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Enrollment modal states
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [capturedImages, setCapturedImages] = useState<{ base64: string; angle: string }[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null)
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isEnrolling, setIsEnrolling] = useState(false)

  // Fetch profile data on mount - CORRECTED WITH UUID
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true)
        
        // Get current user from Supabase Auth
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !authUser) {
          toast.error('Not authenticated. Please log in.')
          console.error('Auth error:', authError)
          return
        }

        console.log('Auth user ID:', authUser.id)

        // Fetch user profile from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (userError || !userData) {
          toast.error('Failed to fetch user profile')
          console.error('User fetch error:', userError)
          return
        }

        console.log('User data:', userData)

        let profileData: ProfileData = {
          user: userData as User,
          enrolledCourses: [],
        }

        // If student, fetch additional data
        if (userData.role === 'student') {
          console.log('Fetching student data for user:', authUser.id)
          
          // Fetch student info directly from Supabase
          const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select('*')
            .eq('user_id', authUser.id)
            .single()

          if (studentError) {
            console.error('Student fetch error:', studentError)
            toast.error('Failed to fetch student data. Please contact admin.')
          } else if (studentData) {
            console.log('Student data fetched:', studentData)
            console.log('Student UUID (id):', studentData.id)
            console.log('Student ID (student_id):', studentData.student_id)
            profileData.student = studentData as Student

            // CORRECTED: Use student UUID (id) not student_id for face_embeddings query
            const { data: faceData, error: faceError } = await supabase
              .from('face_embeddings')
              .select('id, quality_score, creation_timestamp')
              .eq('student_id', studentData.id) // Use UUID, not student_id string
              .maybeSingle()

            if (faceError) {
              console.error('Face embeddings fetch error:', faceError)
            }

            if (faceData) {
              console.log('Face data found:', faceData)
              profileData.faceEnrolled = true
              profileData.faceQuality = faceData.quality_score
              profileData.lastEnrolled = faceData.creation_timestamp
              
              // Compute reEnrollRecommended
              if (faceData.creation_timestamp) {
                const lastDate = new Date(faceData.creation_timestamp)
                const now = new Date()
                const daysDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
                profileData.reEnrollRecommended = daysDiff > 30
                console.log('Days since last enrollment:', daysDiff)
              }
            } else {
              console.log('No face enrollment found')
              profileData.faceEnrolled = false
            }

            // CORRECTED: Use student UUID (id) for enrollments query
            const { data: coursesData, error: coursesError } = await supabase
              .from('enrollments')
              .select(`
                id,
                status,
                courses:course_id (
                  id,
                  name
                )
              `)
              .eq('student_id', studentData.id) // Use UUID, not student_id string

            if (coursesError) {
              console.error('Enrollments fetch error:', coursesError)
            }

            if (coursesData && Array.isArray(coursesData)) {
              profileData.enrolledCourses = coursesData
                .filter((enrollment: any) => enrollment.courses)
                .map((enrollment: any) => ({
                  id: enrollment.courses.id,
                  name: enrollment.courses.name,
                  status: enrollment.status
                }))
              console.log('Enrolled courses:', profileData.enrolledCourses)
            }
          } else {
            console.warn('No student record found for user')
            toast.warning('Student record not found. Please contact admin.')
          }
        }

        console.log('Final profile data:', profileData)
        setProfile(profileData)
      } catch (error) {
        toast.error('Failed to load profile data')
        console.error('Profile fetch error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [])

  // Webcam setup/teardown
  useEffect(() => {
    if (!showEnrollmentModal || !videoRef) return

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
        })
        if (videoRef) {
          videoRef.srcObject = mediaStream
          videoRef.play()
          setStream(mediaStream)
        }
      } catch (err) {
        toast.error('Camera access denied or unavailable')
        console.error('Camera error:', err)
        setShowEnrollmentModal(false)
      }
    }

    startCamera()

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
        setStream(null)
      }
    }
  }, [showEnrollmentModal, videoRef])

  const handleEditToggle = () => {
    setIsEditing(!isEditing)
  }

  const handleInputChange = (field: keyof User, value: string) => {
    setProfile(prev => ({
      ...prev,
      user: { ...prev.user, [field]: value }
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      
      const { error } = await supabase
        .from('users')
        .update({
          first_name: profile.user.first_name,
          last_name: profile.user.last_name,
          email: profile.user.email,
          date_of_birth: profile.user.date_of_birth,
          phone: profile.user.phone,
          address: profile.user.address,
        })
        .eq('id', profile.user.id)
      
      if (error) {
        console.error('Update error:', error)
        throw new Error(error.message)
      }
      
      toast.success('Profile updated successfully')
      setIsEditing(false)
    } catch (error) {
      console.error('Save Error:', error)
      toast.error('Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  // Core enrollment handler
  const handleStartEnrollment = () => {
    console.log('Button clicked!')
    console.log('Profile:', profile)
    console.log('Student data:', profile.student)
    console.log('Student ID (display):', profile.student?.student_id)
    console.log('Student UUID (database):', profile.student?.id)
    console.log('User role:', profile.user.role)
    
    if (!profile.student) {
      console.error('No student data found')
      toast.error('Student data not found. Please refresh the page or contact admin.')
      return
    }
    
    if (!profile.student.student_id) {
      console.error('No student ID found in student data')
      toast.error('Student ID not found. Please contact admin.')
      return
    }
    
    if (profile.reEnrollRecommended) {
      toast.info('Re-enroll recommended (over 30 days). Proceed to update.')
    }
    
    console.log('Opening enrollment modal...')
    setCapturedImages([])
    setCurrentStep(0)
    setShowEnrollmentModal(true)
    console.log('Modal should be visible now')
  }

  // FIXED: Responsive capture with lock, async offload, and UI feedback
  const captureImage = async () => {
    if (!videoRef || !canvasRef || isCapturing) return;

    setIsCapturing(true);

    try {
      const ctx = canvasRef.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      canvasRef.width = videoRef.videoWidth;
      canvasRef.height = videoRef.videoHeight;
      ctx.drawImage(videoRef, 0, 0);

      // Lightweight brightness check (sample every 12th pixel)
      const centralX = canvasRef.width * 0.15;
      const centralY = canvasRef.height * 0.15;
      const centralW = canvasRef.width * 0.7;
      const centralH = canvasRef.height * 0.7;
      const faceRegion = ctx.getImageData(centralX, centralY, centralW, centralH);

      let brightness = 0;
      let sampleCount = 0;
      for (let i = 0; i < faceRegion.data.length; i += 12) {
        const r = faceRegion.data[i];
        const g = faceRegion.data[i + 1];
        const b = faceRegion.data[i + 2];
        brightness += (r + g + b) / 3;
        sampleCount++;
      }
      brightness /= sampleCount;

      const isGoodQuality = brightness > 50 && brightness < 200;

      if (!isGoodQuality) {
        toast.warning('Poor lighting or face not centered. Adjust and try again.');
        return;
      }

      // Offload base64 conversion to avoid UI freeze
      const base64Promise = new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(img, 0, 0);
            resolve(tempCanvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
          }
        };
        img.src = canvasRef.toDataURL('image/jpeg', 0.8);
      });

      const base64 = await base64Promise;

      const step = ENROLLMENT_STEPS[currentStep];
      const currentAngleCount = capturedImages.filter(img => img.angle === step.angle).length;

      if (currentAngleCount >= step.targetImages) {
        toast.info(`Already captured ${step.targetImages} for ${step.title}.`);
        return;
      }

      // Update state
      setCapturedImages(prev => [...prev, { base64, angle: step.angle }]);

      toast.success(`Captured ${step.angle} view #${currentAngleCount + 1}/${step.targetImages}`);
    } catch (err) {
      console.error('Capture error:', err);
      toast.error('Failed to capture image');
    } finally {
      setIsCapturing(false);
    }
  }

  const nextStep = () => {
    const step = ENROLLMENT_STEPS[currentStep]
    const capturedForStep = capturedImages.filter(img => img.angle === step.angle).length
    
    if (capturedForStep >= step.targetImages) {
      if (currentStep < ENROLLMENT_STEPS.length - 1) {
        setCurrentStep(currentStep + 1)
        toast.info(`Moving to ${ENROLLMENT_STEPS[currentStep + 1].title}`)
      } else {
        handleSubmitEnrollment()
      }
    } else {
      toast.warning(`Need ${step.targetImages} images for ${step.title}. Captured: ${capturedForStep}`)
    }
  }

  // Update only the handleSubmitEnrollment function in your profile page
  const handleSubmitEnrollment = async () => {
    if (!profile.student?.student_id || capturedImages.length < 15) {
      toast.error('Incomplete enrollment. Need 15+ images.')
      return
    }

    setIsEnrolling(true)
    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session || !session.access_token) {
        toast.error('Not authenticated. Please log in again.')
        setIsEnrolling(false)
        return
      }

      console.log('Calling Supabase function with:', {
        student_id: profile.student.student_id,
        student_uuid: profile.student.id,
        imageCount: capturedImages.length
      })

      // Call Supabase Edge Function with explicit Authorization header to ensure auth session is passed
      const { data, error } = await supabase.functions.invoke('enroll-face', {
        body: {
          student_id: profile.student.student_id,
          student_uuid: profile.student.id,
          images: capturedImages.map(img => ({ 
            base64: img.base64, 
            angle: img.angle 
          })),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (error) {
        console.error('Supabase function error:', error)
        throw new Error(error.message || 'Enrollment failed')
      }

      if (!data.success) {
        throw new Error(data.error || 'Enrollment failed')
      }

      console.log('Enrollment response:', data)

      // Update profile state
      setProfile(prev => ({
        ...prev,
        faceEnrolled: true,
        faceQuality: data.quality_score,
        lastEnrolled: data.timestamp,
        reEnrollRecommended: false,
      }))

      toast.success(`Enrollment successful! Quality: ${(data.quality_score * 100).toFixed(0)}%`)
      setShowEnrollmentModal(false)
    } catch (error) {
      console.error('Enrollment error:', error)
      toast.error('Enrollment failed: ' + (error as Error).message)
    } finally {
      setIsEnrolling(false)
    }
  }

  const handleCloseModal = () => {
    setShowEnrollmentModal(false)
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    setCapturedImages([])
    setCurrentStep(0)
  }

  if (isLoading) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 pl-64">
          <Navbar />
          <main className="pt-16 p-6">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold mb-6">My Profile</h1>
              <Card>
                <CardContent className="p-6">
                  <p>Loading profile...</p>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const fullName = `${profile.user.first_name} ${profile.user.last_name}`.trim()
  const isStudent = profile.user.role === 'student'
  const step = ENROLLMENT_STEPS[currentStep]
  const stepCaptured = capturedImages.filter(img => img.angle === step.angle).length

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold mb-6">My Profile</h1>

            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 mb-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-3xl">
                    User
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{fullName}</h3>
                    <p className="text-muted-foreground">{profile.user.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="firstName" className="text-sm font-medium block mb-2">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      value={profile.user.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-sm font-medium block mb-2">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      value={profile.user.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium block mb-2">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.user.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  {isStudent && (
                    <div>
                      <Label htmlFor="studentId" className="text-sm font-medium block mb-2">
                        Student ID
                      </Label>
                      <Input 
                        id="studentId" 
                        value={profile.student?.student_id || 'Not found - Contact admin'} 
                        disabled 
                        className={!profile.student?.student_id ? 'text-red-500' : ''}
                      />  
                    </div>
                  )}
                  <div>
                    <Label htmlFor="dateOfBirth" className="text-sm font-medium block mb-2">
                      Date of Birth
                    </Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={profile.user.date_of_birth || ''}
                      onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium block mb-2">
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      value={profile.user.phone || ''}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address" className="text-sm font-medium block mb-2">
                      Address
                    </Label>
                    <Input
                      id="address"
                      value={profile.user.address || ''}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  {isStudent && profile.enrolledCourses.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium block mb-2">Enrolled Courses</Label>
                      <div className="space-y-2">
                        {profile.enrolledCourses.map((course) => (
                          <div key={course.id} className="p-2 bg-muted rounded text-sm">
                            {course.name} - Status: {course.status}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="flex gap-2 pt-4">
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={handleEditToggle} className="mt-4">
                      Edit Profile
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {isStudent && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Facial Recognition</CardTitle>
                  <CardDescription>Manage your facial enrollment data. Re-enroll monthly for best accuracy.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Face Enrolled</p>
                      <p className="text-sm text-muted-foreground">
                        Status: {profile.faceEnrolled ? 'Active' : 'Not Enrolled'}
                        {profile.faceQuality !== null && profile.faceEnrolled && (
                          <span className="ml-2">Quality: {(profile.faceQuality * 100).toFixed(0)}%</span>
                        )}
                        {profile.lastEnrolled && (
                          <span className="ml-2">Last: {new Date(profile.lastEnrolled).toLocaleDateString()}</span>
                        )}
                        {profile.reEnrollRecommended && (
                          <span className="ml-2 text-yellow-600 font-medium">(Re-enroll recommended)</span>
                        )}
                      </p>
                    </div>
                    <span className={`font-medium ${profile.faceEnrolled ? 'text-green-500' : 'text-gray-500'}`}>
                      {profile.faceEnrolled ? <Check className="h-5 w-5" /> : '–'}
                    </span>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleStartEnrollment}
                    disabled={isEnrolling || !profile.student?.student_id}
                    type="button"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {!profile.student?.student_id 
                      ? 'Student ID Required' 
                      : profile.faceEnrolled 
                        ? 'Update/Re-enroll Face Data' 
                        : 'Enroll Face Data'
                    }
                  </Button>
                  {!profile.student?.student_id && (
                    <p className="text-sm text-red-500 text-center">
                      Student ID not found. Please contact administrator.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Enrollment Modal */}
      {showEnrollmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Face Enrollment - Step {currentStep + 1}/3</h2>
                <Button variant="ghost" size="sm" onClick={handleCloseModal}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <video
                    ref={(ref) => setVideoRef(ref)}
                    className="w-full rounded-lg shadow-lg"
                    autoPlay
                    muted
                    playsInline
                  />
                  <canvas ref={(ref) => setCanvasRef(ref)} className="hidden" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-dashed border-primary rounded-lg w-64 h-48 flex items-center justify-center">
                      <p className="text-primary text-sm">Center your face here</p>
                    </div>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground">{step.instruction}</p>
                  <p className="text-sm">Captured: {stepCaptured}/{step.targetImages}</p>
                  {stepCaptured < step.targetImages && (
                    <Button onClick={captureImage} className="mt-2" disabled={!videoRef}>
                      Capture Image
                    </Button>
                  )}
                </div>

                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all" 
                    style={{ width: `${((capturedImages.length / 15) * 100)}%` }}
                  />
                </div>

                <Button 
                  onClick={nextStep} 
                  className="w-full" 
                  disabled={stepCaptured < step.targetImages || isEnrolling}
                >
                  {currentStep < ENROLLMENT_STEPS.length - 1 
                    ? `Next: ${stepCaptured >= step.targetImages ? 'Proceed' : 'Capture More'}` 
                    : isEnrolling ? 'Enrolling...' : 'Complete Enrollment'
                  }
                </Button>

                {isEnrolling && <p className="text-center text-sm text-muted-foreground">Sending to server...</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}