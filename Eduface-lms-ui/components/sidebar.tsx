"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  UserCheck,
  BookOpen,
  Activity,
  ShieldAlert,
  Database,
  FileText,
} from "lucide-react"
import { useState, useEffect } from "react"

export function Sidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string>("student")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Simulate getting role from session
    const storedRole = localStorage.getItem("userRole") || "student"
    setRole(storedRole)
  }, [])

  if (!mounted || pathname === "/login" || pathname === "/signup" || pathname === "/reset-password") {
    return null
  }

  const studentNav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/my-attendance", label: "My Attendance", icon: UserCheck },
    { href: "/profile", label: "Profile", icon: Users },
  ]

  const teacherNav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/live-attendance", label: "Live Attendance", icon: Activity },
    { href: "/reports", label: "Reports", icon: BarChart3 },
  ]

  const adminNav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/live-attendance", label: "Live Attendance", icon: Activity },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/admin/users", label: "User Management", icon: Users },
    { href: "/admin/courses", label: "Courses", icon: BookOpen },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/logs", label: "Spoofing Logs", icon: ShieldAlert },
    { href: "/admin/audit", label: "Audit Logs", icon: FileText },
    { href: "/admin/backup", label: "Backup", icon: Database },
  ]

  const navItems = role === "admin" ? adminNav : role === "teacher" ? teacherNav : studentNav

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center h-14 border-b border-sidebar-border px-6">
          <div className="font-bold text-lg bg-gradient-to-r from-sidebar-primary to-sidebar-accent bg-clip-text text-transparent">
            FaceAttend
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/10",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="text-xs text-sidebar-foreground/60 mb-2">Current Role</div>
          <div className="text-sm font-medium text-sidebar-foreground capitalize">{role}</div>
        </div>
      </div>
    </aside>
  )
}
