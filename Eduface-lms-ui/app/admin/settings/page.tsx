"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"

export default function SettingsPage() {
  const [confidenceThreshold, setConfidenceThreshold] = useState([85])
  const [enableSpoofingDetection, setEnableSpoofingDetection] = useState(true)
  const [enableEmailNotifications, setEnableEmailNotifications] = useState(true)

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">System Settings</h1>
            <p className="text-muted-foreground">Configure system parameters and preferences</p>
          </div>

          <Tabs defaultValue="general" className="space-y-6">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="backup">Backup</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Facial Recognition Settings</CardTitle>
                  <CardDescription>Adjust recognition accuracy parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="text-sm font-medium block mb-4">
                      Confidence Threshold: {confidenceThreshold[0]}%
                    </label>
                    <Slider
                      value={confidenceThreshold}
                      onValueChange={setConfidenceThreshold}
                      min={50}
                      max={99}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-2">Minimum confidence required for recognition</p>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Enable Spoofing Detection</p>
                      <p className="text-sm text-muted-foreground">Detect fake faces and spoofing attempts</p>
                    </div>
                    <Switch checked={enableSpoofingDetection} onCheckedChange={setEnableSpoofingDetection} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Camera Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Default Camera</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue defaultValue="camera1" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="camera1">Camera 1 - Main Entrance</SelectItem>
                        <SelectItem value="camera2">Camera 2 - Secondary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Resolution</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue defaultValue="1080p" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="1080p">1080p</SelectItem>
                        <SelectItem value="2k">2K</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>Manage system security options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">Require 2FA for admin accounts</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Session Timeout</p>
                      <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
                    </div>
                    <Input type="number" defaultValue="30" className="w-20" placeholder="Minutes" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive email alerts</p>
                    </div>
                    <Switch checked={enableEmailNotifications} onCheckedChange={setEnableEmailNotifications} />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Spoofing Alerts</p>
                      <p className="text-sm text-muted-foreground">Alert on spoofing attempts</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">System Alerts</p>
                      <p className="text-sm text-muted-foreground">System status notifications</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="backup" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Database Backup</CardTitle>
                  <CardDescription>Manage system backups</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted">
                    <p className="font-medium mb-2">Last Backup</p>
                    <p className="text-sm text-muted-foreground">2024-01-15 at 03:00 AM</p>
                  </div>
                  <Button>Create Backup Now</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
