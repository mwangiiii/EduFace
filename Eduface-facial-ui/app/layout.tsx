import type React from "react"
import type { Metadata } from "next"
// import { Geist, Geist_Mono } from "next/font/google"
import { GeistSans } from 'geist/font/sans';
import { Analytics } from "@vercel/analytics/next"
import { AppProvider } from "@/lib/context"
import "./globals.css"

// const _geist = Geist({ subsets: ["latin"] })
// const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "EduFace - Attendance System",
  description: "AI-powered facial recognition attendance for educational institutions",
  keywords:["facial recognition", "attendance system", "AI", "education", "student attendance", "classroom management"],
  
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <AppProvider>{children}</AppProvider>
        <Analytics />
      </body>
    </html>
  )
}
