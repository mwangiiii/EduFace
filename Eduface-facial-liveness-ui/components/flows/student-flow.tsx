"use client"

import { useState } from "react"
import CodeEntry from "@/components/student/code-entry"
import FacialScan from "@/components/student/facial-scan"
import AttendanceConfirmation from "@/components/student/attendance-confirmation"

type StudentStep = "code-entry" | "facial-scan" | "confirmation"

interface StudentFlowProps {
  onLogout: () => void
}

export default function StudentFlow({ onLogout }: StudentFlowProps) {
  const [step, setStep] = useState<StudentStep>("code-entry")
  const [sessionData, setSessionData] = useState<any>(null)
  const [sessionId, setSessionId] = useState<string>("")

  // === 1. Code Entry → Facial Scan ===
  const handleCodeSubmit = (sessionData: any, session_id: string) => {
    console.log("Session validated:", { session_id, unit: sessionData.unit?.name })
    setSessionData(sessionData)
    setSessionId(session_id)  // ← This is the session_id (e.g., "sess_math101_2025")
    setStep("facial-scan")
  }

  // === 2. Facial Scan → Confirmation ===
  const handleScanComplete = (result: any) => {
    console.log("Verification complete:", result)
    setSessionData((prev: any) => ({
      ...prev,
      ...result,
      verificationTimestamp: new Date().toISOString()
    }))
    setStep("confirmation")
  }

  // === 3. Reset Flow ===
  const handleReset = () => {
    setStep("code-entry")
    setSessionData(null)
    setSessionId("")
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
      {step === "facial-scan" && sessionData && (
        <FacialScan 
          sessionData={sessionData}
          sessionId={sessionId}  // ← PASSED TO rapid-handler
          onComplete={handleScanComplete}
          onBack={() => setStep("code-entry")}
        />
      )}

      {/* STEP 3: Confirmation */}
      {step === "confirmation" && sessionData && (
        <AttendanceConfirmation 
          data={sessionData}
          onReset={handleReset}
          onLogout={onLogout}
        />
      )}
    </div>
  )
}