"use client"

import { useState } from "react"
import CodeEntry from "@/components/student/code-entry"
import FacialScan from "@/components/student/facial-scan"
import AttendanceConfirmation from "@/components/student/attendance-confirmation"

type StudentStep = "code-entry" | "facial-scan" | "confirmation"

interface SessionInfo {
  session_id: string
  unit: { name: string }
  // ... any other fields from session lookup
}

interface VerificationResult {
  success: boolean
  studentId: string
  sessionId: string
  unitName: string
  timestamp: Date | string
  confidence: number
  avgConfidence?: number
  livenessScore?: number
  matchCount?: number
  totalComparisons?: number
}

interface StudentFlowProps {
  onLogout: () => void
}

export default function StudentFlow({ onLogout }: StudentFlowProps) {
  const [step, setStep] = useState<StudentStep>("code-entry")
  
  // Step 1: Only store session lookup result
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  
  // Step 2: Only store final verification result
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)

  // === 1. Code Entry → Facial Scan ===
  const handleCodeSubmit = (sessionData: SessionInfo, session_id: string) => {
    console.log("Session validated:", { session_id, unit: sessionData.unit?.name })
    setSessionInfo(sessionData)
    setStep("facial-scan")
  }

  // === 2. Facial Scan → Confirmation ===
  const handleScanComplete = (result: VerificationResult) => {
    console.log("Verification complete:", result)
    setVerificationResult(result)
    setStep("confirmation")
  }

  // === 3. Reset Flow ===
  const handleReset = () => {
    setStep("code-entry")
    setSessionInfo(null)
    setVerificationResult(null)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* STEP 1: Enter Session Code */}
      {step === "code-entry" && (
        <CodeEntry 
          onSubmit={handleCodeSubmit} 
          onLogout={onLogout} 
        />
      )}

      {/* STEP 2: Facial Recognition */}
      {step === "facial-scan" && sessionInfo && (
        <FacialScan 
          sessionData={sessionInfo}
          sessionId={sessionInfo.session_id}  // Pass the actual session_id
          onComplete={handleScanComplete}
          onBack={() => setStep("code-entry")}
        />
      )}

      {/* STEP 3: Confirmation */}
      {step === "confirmation" && verificationResult && (
        <AttendanceConfirmation 
          data={verificationResult}   // Clean, correct data
          onReset={handleReset}
          onLogout={onLogout}
        />
      )}
    </div>
  )
}