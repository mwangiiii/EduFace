"use client"

import { Button } from "@/components/ui/button"

type AdminTab = "enrollment" | "sessions" | "reports"

interface AdminNavProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
  onLogout: () => void
}

export default function AdminNav({ activeTab, onTabChange, onLogout }: AdminNavProps) {
  const tabs: Array<{ id: AdminTab; label: string }> = [
    { id: "enrollment", label: "Enrollment" },
    { id: "sessions", label: "Sessions" },
    { id: "reports", label: "Reports" },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 bg-card border-b border-border z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <Button onClick={onLogout} variant="outline" className="ml-4 bg-transparent">
            Logout
          </Button>
        </div>
      </div>
    </nav>
  )
}
