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

  const handleCodeSubmit = (sessionData: any, accessCode: string) => {
    // sessionData comes from CodeEntry, which includes all session info and unit
    setSessionData(sessionData)
    setStep("facial-scan")
    // Store accessCode separately if needed
    setAccessCode(accessCode)
  }

  const handleScanComplete = (result: any) => {
    // Merge facial scan result with session data
    setSessionData((prev: any) => ({ 
      ...prev, 
      ...result,
      verificationTimestamp: new Date()
    }))
    setStep("confirmation")
  }

  const handleReset = () => {
    setStep("code-entry")
    setSessionData(null)
  }

  const [accessCode, setAccessCode] = useState<string>("");

  return (
    <div className="min-h-screen bg-background">
      {step === "code-entry" && (
        <CodeEntry 
          onSubmit={handleCodeSubmit} 
          onLogout={onLogout} 
        />
      )}
      
      {step === "facial-scan" && (
        <FacialScan 
          sessionData={sessionData}
          accessCode={accessCode}
          onComplete={handleScanComplete} 
          onBack={() => setStep("code-entry")} 
        />
      )}
      
      
      {step === "confirmation" && (
        <AttendanceConfirmation 
          data={sessionData} 
          onReset={handleReset} 
          onLogout={onLogout} 
        />
      )}
    </div>
  )
}