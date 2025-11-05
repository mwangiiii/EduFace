"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Camera } from "lucide-react"
import { useState } from "react"

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold mb-6">My Profile</h1>

            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 mb-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-3xl">
                    👤
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">John Doe</h3>
                    <p className="text-muted-foreground">student@school.edu</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Full Name</label>
                    <Input value="John Doe" disabled={!isEditing} />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Email</label>
                    <Input value="student@school.edu" disabled={!isEditing} type="email" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Student ID</label>
                    <Input value="STU-2024-001" disabled />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Course</label>
                    <Input value="Computer Science" disabled={!isEditing} />
                  </div>

                  {isEditing ? (
                    <div className="flex gap-2 pt-4">
                      <Button onClick={() => setIsEditing(false)}>Save Changes</Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={() => setIsEditing(true)} className="mt-4">
                      Edit Profile
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Facial Recognition</CardTitle>
                <CardDescription>Manage your facial enrollment data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Face Enrolled</p>
                    <p className="text-sm text-muted-foreground">Status: Active</p>
                  </div>
                  <span className="text-green-500 font-medium">✓</span>
                </div>
                <Button variant="outline" className="w-full bg-transparent">
                  <Camera className="h-4 w-4 mr-2" />
                  Update Face Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
