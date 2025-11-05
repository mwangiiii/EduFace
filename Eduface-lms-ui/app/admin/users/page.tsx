"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Edit2, Trash2, Plus, Search } from "lucide-react"
import { useState } from "react"

export default function UserManagementPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const users = [
    { id: 1, name: "John Doe", email: "john@school.edu", role: "student", status: "active" },
    { id: 2, name: "Jane Smith", email: "jane@school.edu", role: "teacher", status: "active" },
    { id: 3, name: "Bob Wilson", email: "bob@school.edu", role: "admin", status: "active" },
    { id: 4, name: "Alice Brown", email: "alice@school.edu", role: "student", status: "inactive" },
  ]

  const filtered = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Navbar />
        <main className="pt-16 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">User Management</h1>
            <p className="text-muted-foreground">Manage system users and permissions</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Users</CardTitle>
                  <CardDescription>All registered users in the system</CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Name</th>
                      <th className="text-left py-3 px-4 font-medium">Email</th>
                      <th className="text-left py-3 px-4 font-medium">Role</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{user.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="capitalize">
                            {user.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={user.status === "active" ? "default" : "secondary"}
                            className={user.status === "active" ? "bg-green-500" : "bg-gray-500"}
                          >
                            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 flex gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
