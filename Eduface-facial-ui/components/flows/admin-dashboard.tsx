"use client"

import { useState } from "react"
import AdminNav from "@/components/admin/admin-nav"
import EnrollmentManager from "@/components/admin/enrollment-manager"
import SessionManager from "@/components/admin/session-manager"
import ReportsView from "@/components/admin/reports-view"

type AdminTab = "enrollment" | "sessions" | "reports"

interface AdminDashboardProps {
  onLogout: () => void
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("enrollment")

  return (
    <div className="min-h-screen bg-background">
      <AdminNav activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout} />
      <main className="pt-20">
        {activeTab === "enrollment" && <EnrollmentManager />}
        {activeTab === "sessions" && <SessionManager />}
        {activeTab === "reports" && <ReportsView />}
      </main>
    </div>
  )
}
