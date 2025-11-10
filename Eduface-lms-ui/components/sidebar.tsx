"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useRouter } from 'next/navigation'
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
  LogOut,
} from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"

interface UserProfile {
  first_name: string
  last_name: string
  role: string
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      setMounted(true)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('Auth error:', authError)
        // Redirect to login if no user
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('first_name, last_name, role')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        console.error('Profile fetch error:', profileError)
        // Fallback or redirect
        router.push('/login')
        return
      }

      setUserProfile(profile)
      setLoading(false)
    }

    init()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!mounted || loading || pathname === "/login" || pathname === "/signup" || pathname === "/reset-password") {
    return null
  }

  if (!userProfile) {
    return null // Or a loading/error state
  }

  const role = userProfile.role
  const fullName = `${userProfile.first_name} ${userProfile.last_name}`.trim()

  // Role-specific background classes for customization
  const roleBgClass = role === 'student' ? 'bg-student-sidebar' :
                     role === 'teacher' ? 'bg-teacher-sidebar' :
                     'bg-admin-sidebar'

  const studentNav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/my-attendance", label: "My Attendance", icon: UserCheck },
    { href: "/profile", label: "Profile", icon: Users },
  ]

  const teacherNav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/live-attendance", label: "Live Attendance", icon: Activity },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/profile", label: "Profile", icon: Users },
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
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-colors duration-300",
      roleBgClass // Custom role-based background
    )}>
      <div className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center h-20 border-b border-sidebar-border px-6">
          <div className="font-bold text-lg bg-gradient-to-r from-sidebar-primary to-sidebar-accent bg-clip-text text-transparent">
            EduFace
          </div>
          <div className="text-xs text-sidebar-foreground/70 mt-1 truncate w-full text-center">
            {fullName}
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
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/20 hover:text-sidebar-primary",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4 space-y-2">
          <div className="text-xs text-sidebar-foreground/60">Role</div>
          <div className="text-sm font-medium text-sidebar-foreground capitalize">{role}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-red-500"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  )
}