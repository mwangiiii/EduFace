"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Moon, Sun, LogOut } from "lucide-react"
import { useTheme } from "next-themes"

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  if (pathname === "/login" || pathname === "/signup" || pathname === "/reset-password") {
    return null
  }

  return (
    <nav className="fixed top-0 right-0 left-64 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="text-sm text-muted-foreground">Welcome back, User</div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}
