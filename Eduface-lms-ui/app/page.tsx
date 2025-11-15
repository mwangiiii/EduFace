"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  LogIn, 
  UserPlus, 
  LayoutDashboard, 
  Camera, 
  BarChart3,
  Shield,
  Zap,
  Users
} from "lucide-react"

export default function HomePage() {
  const features = [
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Secure Facial Recognition",
      description: "AI-powered attendance with 99.9% accuracy"
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Instant Check-In",
      description: "Mark attendance in under 2 seconds"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "For Students & Lecturers",
      description: "Works across all roles and devices"
    }
  ]

  const navItems = [
    { href: "/login", label: "Login", icon: <LogIn className="h-4 w-4" />, variant: "default" as const },
    // { href: "/signup", label: "Sign Up", icon: <UserPlus className="h-4 w-4" />, variant: "secondary" as const },
    // { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, variant: "outline" as const },
    // { href: "/live-attendance", label: "Live Attendance", icon: <Camera className="h-4 w-4" />, variant: "outline" as const },
    // { href: "/reports", label: "Reports", icon: <BarChart3 className="h-4 w-4" />, variant: "outline" as const },
  ]

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Hero Section */}
        <section className="flex-1 flex items-center justify-center px-6 py-16 md:py-24">
          <div className="max-w-4xl w-full text-center space-y-8">
            <Badge variant="secondary" className="mx-auto">
              EduFace LMS • Kenya
            </Badge>

            <h1 className="text-4xl md:text-6xl font-bold text-foreground animate-in fade-in slide-in-from-bottom-4 duration-700">
              Smart Attendance.<br />
              <span className="text-primary">Smarter Learning.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
              Join thousands of Kenyan students and lecturers using AI-powered facial recognition for seamless, secure, and instant attendance tracking.
            </p>

            <nav className="flex flex-wrap justify-center gap-3 mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  asChild
                  variant={item.variant}
                  size="lg"
                  className="min-w-[140px]"
                >
                  <Link href={item.href} className="flex items-center gap-2">
                    {item.icon}
                    {item.label}
                  </Link>
                </Button>
              ))}
            </nav>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-muted/50 py-16 md:py-24 border-t">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Why EduFace?
              </h2>
              <p className="text-muted-foreground mt-3">
                Built for Kenyan institutions — fast, reliable, and mobile-first.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {features.map((feature, i) => (
                <Card 
                  key={i} 
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                      {feature.icon}
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t bg-background py-8">
          <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
            <p>
              © {new Date().getFullYear()} EduFace LMS • 
              <span className="text-primary font-medium"> Kenya</span>
            </p>
            <p className="mt-1">
              Secure • Local • Student-First
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}