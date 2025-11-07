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
import { useState, useEffect } from "react"
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface Settings {
  facial: {
    confidenceThreshold: number
    enableSpoofingDetection: boolean
  }
  notifications: {
    enableEmail: boolean
    spoofingAlerts: boolean
    systemAlerts: boolean
  }
  security: {
    twoFactor: boolean
    sessionTimeout: number
  }
  camera: {
    defaultCamera: string
    resolution: string
  }
}

const defaultSettings: Settings = {
  facial: {
    confidenceThreshold: 0.85,
    enableSpoofingDetection: true
  },
  notifications: {
    enableEmail: true,
    spoofingAlerts: true,
    systemAlerts: true
  },
  security: {
    twoFactor: true,
    sessionTimeout: 30
  },
  camera: {
    defaultCamera: 'camera1',
    resolution: '1080p'
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [lastBackup, setLastBackup] = useState<string>('Never')
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    async function init() {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      setSession(authSession)
      if (authSession?.user.id) {
        await fetchLastBackup(authSession.user.id)
      }
      await fetchSettings()
    }
    init()
  }, [])

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('settings')
        .eq('id', 'global')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Table row not found, insert default
          const now = new Date().toISOString()
          const { error: insertError } = await supabase
            .from('system_settings')
            .insert({
              id: 'global',
              settings: defaultSettings,
              created_at: now,
              updated_at: now
            })
          if (insertError) throw insertError
          setSettings(defaultSettings)
        } else {
          throw error
        }
      } else {
        setSettings(data.settings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      setSettings(defaultSettings)
    }
  }

  async function updateSettings(newSettings: Settings) {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        id: 'global',
        settings: newSettings,
        updated_at: now
      })
    if (error) {
      console.error('Error updating settings:', error)
    }
  }

  async function fetchLastBackup(userId: string) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('timestamp')
      .eq('action_type', 'create_backup')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching last backup:', error)
      setLastBackup('Never')
      return
    }

    if (data) {
      setLastBackup(new Date(data.timestamp).toLocaleString())
    } else {
      setLastBackup('Never')
    }
  }

  async function createBackup() {
    if (!session?.user.id) {
      console.error('No user session')
      return
    }

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: session.user.id,
        action_type: 'create_backup',
        description: 'Manual database backup initiated from admin panel'
      })

    if (error) {
      console.error('Error creating backup log:', error)
    } else {
      setLastBackup(new Date().toLocaleString())
    }
  }

  const handleConfidenceChange = (value: number[]) => {
    const newSettings = {
      ...settings,
      facial: {
        ...settings.facial,
        confidenceThreshold: value[0] / 100
      }
    }
    setSettings(newSettings)
    updateSettings(newSettings)
  }

  const handleSpoofingToggle = (checked: boolean) => {
    const newSettings = {
      ...settings,
      facial: {
        ...settings.facial,
        enableSpoofingDetection: checked
      }
    }
    setSettings(newSettings)
    updateSettings(newSettings)
  }

  const handleEmailToggle = (checked: boolean) => {
    const newSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        enableEmail: checked
      }
    }
    setSettings(newSettings)
    updateSettings(newSettings)
  }

  const handleSpoofingAlertToggle = (checked: boolean) => {
    const newSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        spoofingAlerts: checked
      }
    }
    setSettings(newSettings)
    updateSettings(newSettings)
  }

  const handleSystemAlertToggle = (checked: boolean) => {
    const newSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        systemAlerts: checked
      }
    }
    setSettings(newSettings)
    updateSettings(newSettings)
  }

  const handleTwoFactorToggle = (checked: boolean) => {
    const newSettings = {
      ...settings,
      security: {
        ...settings.security,
        twoFactor: checked
      }
    }
    setSettings(newSettings)
    updateSettings(newSettings)
  }

  const handleSessionTimeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value)
    if (isNaN(val) || val < 1) return
    const newSettings = {
      ...settings,
      security: {
        ...settings.security,
        sessionTimeout: val
      }
    }
    setSettings(newSettings)
    updateSettings(newSettings)
  }

  const handleDefaultCameraChange = (value: string) => {
    const newSettings = {
      ...settings,
      camera: {
        ...settings.camera,
        defaultCamera: value
      }
    }
    setSettings(newSettings)
    updateSettings(newSettings)
  }

  const handleResolutionChange = (value: string) => {
    const newSettings = {
      ...settings,
      camera: {
        ...settings.camera,
        resolution: value
      }
    }
    setSettings(newSettings)
    updateSettings(newSettings)
  }

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
                      Confidence Threshold: {Math.round(settings.facial.confidenceThreshold * 100)}%
                    </label>
                    <Slider
                      value={[Math.round(settings.facial.confidenceThreshold * 100)]}
                      onValueChange={handleConfidenceChange}
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
                    <Switch checked={settings.facial.enableSpoofingDetection} onCheckedChange={handleSpoofingToggle} />
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
                    <Select value={settings.camera.defaultCamera} onValueChange={handleDefaultCameraChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="camera1">Camera 1 - Main Entrance</SelectItem>
                        <SelectItem value="camera2">Camera 2 - Secondary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Resolution</label>
                    <Select value={settings.camera.resolution} onValueChange={handleResolutionChange}>
                      <SelectTrigger>
                        <SelectValue />
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
                    <Switch checked={settings.security.twoFactor} onCheckedChange={handleTwoFactorToggle} />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Session Timeout</p>
                      <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
                    </div>
                    <Input 
                      type="number" 
                      value={settings.security.sessionTimeout} 
                      onChange={handleSessionTimeoutChange}
                      className="w-20" 
                      placeholder="Minutes" 
                    />
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
                    <Switch checked={settings.notifications.enableEmail} onCheckedChange={handleEmailToggle} />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Spoofing Alerts</p>
                      <p className="text-sm text-muted-foreground">Alert on spoofing attempts</p>
                    </div>
                    <Switch checked={settings.notifications.spoofingAlerts} onCheckedChange={handleSpoofingAlertToggle} />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">System Alerts</p>
                      <p className="text-sm text-muted-foreground">System status notifications</p>
                    </div>
                    <Switch checked={settings.notifications.systemAlerts} onCheckedChange={handleSystemAlertToggle} />
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
                    <p className="text-sm text-muted-foreground">{lastBackup}</p>
                  </div>
                  <Button onClick={createBackup}>Create Backup Now</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}