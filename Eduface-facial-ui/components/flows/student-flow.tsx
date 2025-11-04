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

  const handleCodeSubmit = (code: string) => {
    setSessionData({ code, timestamp: new Date() })
    setStep("facial-scan")
  }

  const handleScanComplete = (result: any) => {
    setSessionData((prev) => ({ ...prev, ...result }))
    setStep("confirmation")
  }

  const handleReset = () => {
    setStep("code-entry")
    setSessionData(null)
  }

  return (
    <div className="min-h-screen bg-background">
      {step === "code-entry" && <CodeEntry onSubmit={handleCodeSubmit} onLogout={onLogout} />}
      {step === "facial-scan" && <FacialScan onComplete={handleScanComplete} onBack={() => setStep("code-entry")} />}
      {step === "confirmation" && (
        <AttendanceConfirmation data={sessionData} onReset={handleReset} onLogout={onLogout} />
      )}
    </div>
  )
}
