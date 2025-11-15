import Link from "next/link"
import { Button } from "@/components/ui/button"
import { School, QrCode, BarChart3, Users, LogIn } from "lucide-react"

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="w-full max-w-md space-y-8 text-center">

        {/* Logo + Title */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
              <School className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Welcome to EduFace LMS
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Your gateway to smart attendance and learning management.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Umeandikishwa kwa usahihi • Kenya
          </p>
        </div>

        {/* Navigation Buttons */}
        <nav className="grid grid-cols-1 gap-3">
          <Button asChild className="h-12 text-lg font-medium bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-md">
            <Link href="/login" className="flex items-center justify-center gap-2">
              <LogIn className="w-5 h-5" />
              Login
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-12 text-lg font-medium border-2">
            <Link href="/signup" className="flex items-center justify-center gap-2">
              <Users className="w-5 h-5" />
              Sign Up
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-12 text-lg font-medium border-2">
            <Link href="/dashboard" className="flex items-center justify-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Dashboard
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-12 text-lg font-medium border-2">
            <Link href="/live-attendance" className="flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5" />
              Live Attendance
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-12 text-lg font-medium border-2">
            <Link href="/reports" className="flex items-center justify-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Reports
            </Link>
          </Button>
        </nav>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-8">
          © 2025 EduFace • Secure & Private • Kenya
        </p>

      </div>
    </main>
  )
}