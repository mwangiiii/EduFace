"use client"

import { useState } from "react"
import SessionActivation from "@/components/teacher/session-activation"
import SessionMonitoring from "@/components/teacher/session-monitoring"

type TeacherStep = "activation" | "monitoring"

interface TeacherFlowProps {
  onLogout: () => void
}

export default function TeacherFlow({ onLogout }: TeacherFlowProps) {
  const [step, setStep] = useState<TeacherStep>("activation")
  const [activeSession, setActiveSession] = useState<any>(null)

  const handleSessionStart = (session: any) => {
    setActiveSession(session)
    setStep("monitoring")
  }

  const handleSessionEnd = () => {
    setStep("activation")
    setActiveSession(null)
  }

  return (
    <div className="min-h-screen bg-background">
      {step === "activation" && <SessionActivation onSessionStart={handleSessionStart} onLogout={onLogout} />}
      {step === "monitoring" && <SessionMonitoring session={activeSession} onSessionEnd={handleSessionEnd} />}
    </div>
  )
}
