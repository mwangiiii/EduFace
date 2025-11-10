"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Edit2, Trash2, Plus, Search } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase, createUserWithoutSessionSwitch } from '@/lib/supabaseClient'

interface User {
  id: string
  first_name: string
  last_name: string
  name: string
  email: string
  role: 'student' | 'teacher' | 'administrator'
  status: 'active' | 'inactive'
  student?: {
    student_id: string
    enrollment_date: string
  }
  teacher?: {
    teacher_id: string
    department: string
    qualifications: string | null
  }
  administrator?: {
    admin_id: string
  }
}

export default function UserManagementPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [successPassword, setSuccessPassword] = useState("")
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState("")
  // Form states
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("student")
  const [roleIdInput, setRoleIdInput] = useState("")
  const [department, setDepartment] = useState("")
  const [enrollmentDateInput, setEnrollmentDateInput] = useState("")
  const [qualifications, setQualifications] = useState("")
  const router = useRouter()

  const resetForm = () => {
    setFirstName("")
    setLastName("")
    setEmail("")
    setRole("student")
    setRoleIdInput("")
    setDepartment("")
    setEnrollmentDateInput("")
    setQualifications("")
    setFormError("")
  }

  const getRoleId = (user: User): string => {
    if (user.role === 'student') return user.student?.student_id || ''
    if (user.role === 'teacher') return user.teacher?.teacher_id || ''
    if (user.role === 'administrator') return user.administrator?.admin_id || ''
    return ''
  }

  const getPrefix = (r: string): string => {
    return r === 'student' ? 'STU' : r === 'teacher' ? 'TCH' : 'ADM'
  }

  // Helper function to generate secure random password
  const generatePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  async function fetchUsers() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          students!students_user_id_fkey(*),
          teachers!teachers_user_id_fkey(*),
          administrators!administrators_user_id_fkey(*)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const processedUsers: User[] = (data || []).map((u: any) => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim()
        let status = u.status || 'active'
        return {
          id: u.id,
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          name: fullName || 'Unnamed User',
          email: u.email || '',
          role: u.role || 'student',
          status,
          student: u.students?.[0],
          teacher: u.teachers?.[0],
          administrator: u.administrators?.[0],
        }
      })

      setUsers(processedUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = users.filter((user) => {
    if (roleFilter !== "all" && user.role !== roleFilter) return false
    if (statusFilter !== "all" && user.status !== statusFilter) return false
    const searchLower = searchTerm.toLowerCase()
    if (searchTerm) {
      return (
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.role.toLowerCase().includes(searchLower) ||
        getRoleId(user).toLowerCase().includes(searchLower) ||
        (user.teacher?.department || '').toLowerCase().includes(searchLower) ||
        (user.student?.enrollment_date || '').toLowerCase().includes(searchLower) ||
        (user.teacher?.qualifications || '').toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this user? This action is irreversible.')) {
      return
    }

    const user = users.find((u) => u.id === id)
    if (!user) return

    try {
      // Delete role-specific record
      if (user.role === 'student' && user.student) {
        await supabase.from('students').delete().eq('user_id', id)
      } else if (user.role === 'teacher' && user.teacher) {
        await supabase.from('teachers').delete().eq('user_id', id)
      } else if (user.role === 'administrator' && user.administrator) {
        await supabase.from('administrators').delete().eq('user_id', id)
      }

      // Delete user
      const { error } = await supabase.from('users').delete().eq('id', id)
      if (error) throw error

      setUsers(users.filter((u) => u.id !== id))
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    }
  }

  const handleAddUser = () => {
    resetForm()
    setShowAddModal(true)
  }

  const handleEdit = (id: string) => {
    const user = users.find((u) => u.id === id)
    if (user) {
      setEditingUser(user)
      setFirstName(user.first_name)
      setLastName(user.last_name)
      setEmail(user.email)
      setRole(user.role)
      setRoleIdInput(getRoleId(user))
      setDepartment(user.teacher?.department || '')
      setEnrollmentDateInput(user.student?.enrollment_date || '')
      setQualifications(user.teacher?.qualifications || '')
      setShowEditModal(true)
      setFormError('')
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setFormLoading(true)
    
    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedEmail = email.trim()
    const trimmedRoleId = roleIdInput.trim()
    const trimmedDepartment = department.trim()
    
    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !trimmedRoleId) {
      setFormError("Please fill in all required fields")
      setFormLoading(false)
      return
    }

    if (role === 'teacher' && !trimmedDepartment) {
      setFormError("Please provide the department for the teacher")
      setFormLoading(false)
      return
    }

    try {
      const generatedPassword = generatePassword()

      // Use the helper function to create user without session switch
      const result = await createUserWithoutSessionSwitch({
        email: trimmedEmail,
        password: generatedPassword,
        metadata: {
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          role
        }
      })

      if (!result.success || !result.user) {
        setFormError(result.error || "User creation failed")
        setFormLoading(false)
        return
      }

      // Step 2: Profile already created by createUserWithoutSessionSwitch helper
// Check if helper function reported any errors
if (result.error && !result.success) {
  setFormError(result.error)
  setFormLoading(false)
  return
}

console.log('User and profile created successfully:', result.user.id)

      // Step 3: Insert into role-specific table
      let roleInsertError = null
      if (role === 'student') {
        const { error: studentInsertError } = await supabase
          .from("students")
          .insert({
            user_id: result.user.id,
            student_id: trimmedRoleId,
            enrollment_date: new Date().toISOString().split('T')[0],
          })

        roleInsertError = studentInsertError
      } else if (role === 'teacher') {
        const { error: teacherInsertError } = await supabase
          .from("teachers")
          .insert({
            user_id: result.user.id,
            teacher_id: trimmedRoleId,
            department: trimmedDepartment,
            qualifications: null,
          })

        roleInsertError = teacherInsertError
      } else if (role === 'administrator') {
        const { error: adminInsertError } = await supabase
          .from("administrators")
          .insert({
            user_id: result.user.id,
            admin_id: trimmedRoleId,
          })

        roleInsertError = adminInsertError
      }

      if (roleInsertError) {
        console.error(`${role.charAt(0).toUpperCase() + role.slice(1)} Insert Error:`, roleInsertError)
        setFormError(`${role.charAt(0).toUpperCase() + role.slice(1)} profile creation failed: ${roleInsertError.message}`)
        // Clean up users record only
        await supabase.from("users").delete().eq('id', result.user.id)
        setFormLoading(false)
        return
      }

      // Success - Admin session is automatically maintained by helper function
      setFormLoading(false)
      setShowAddModal(false)
      setSuccessPassword(generatedPassword)
      setShowSuccessModal(true)
      fetchUsers()
      
    } catch (err) {
      console.error('Unexpected error during user creation:', err)
      setFormError("An unexpected error occurred. Please try again.")
      setFormLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setFormLoading(true)
    
    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedEmail = email.trim()
    const trimmedRoleId = roleIdInput.trim()
    const trimmedDepartment = department.trim()
    const trimmedQualifications = qualifications.trim()
    
    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !trimmedRoleId) {
      setFormError("Please fill in all required fields")
      setFormLoading(false)
      return
    }

    if (role === 'teacher' && !trimmedDepartment) {
      setFormError("Please provide the department for the teacher")
      setFormLoading(false)
      return
    }

    if (!editingUser) return

    try {
      // Update users table
      const { error: userUpdateError } = await supabase
        .from("users")
        .update({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          email: trimmedEmail,
        })
        .eq("id", editingUser.id)

      if (userUpdateError) {
        console.error('User Update Error:', userUpdateError)
        setFormError(`Profile update failed: ${userUpdateError.message}`)
        setFormLoading(false)
        return
      }

      // Update role-specific table
      let roleUpdateError = null
      if (role === 'student') {
        const updateData: any = { student_id: trimmedRoleId }
        if (enrollmentDateInput) updateData.enrollment_date = enrollmentDateInput
        const { error: studentUpdateError } = await supabase
          .from("students")
          .update(updateData)
          .eq("user_id", editingUser.id)

        roleUpdateError = studentUpdateError
      } else if (role === 'teacher') {
        const updateData: any = { 
          teacher_id: trimmedRoleId, 
          department: trimmedDepartment 
        }
        if (trimmedQualifications) updateData.qualifications = trimmedQualifications
        const { error: teacherUpdateError } = await supabase
          .from("teachers")
          .update(updateData)
          .eq("user_id", editingUser.id)

        roleUpdateError = teacherUpdateError
      } else if (role === 'administrator') {
        const { error: adminUpdateError } = await supabase
          .from("administrators")
          .update({ admin_id: trimmedRoleId })
          .eq("user_id", editingUser.id)

        roleUpdateError = adminUpdateError
      }

      if (roleUpdateError) {
        console.error(`${role.charAt(0).toUpperCase() + role.slice(1)} Update Error:`, roleUpdateError)
        setFormError(`${role.charAt(0).toUpperCase() + role.slice(1)} profile update failed: ${roleUpdateError.message}`)
        setFormLoading(false)
        return
      }

      // Success
      setFormLoading(false)
      setShowEditModal(false)
      setEditingUser(null)
      fetchUsers()
      
    } catch (err) {
      console.error('Unexpected error during user update:', err)
      setFormError("An unexpected error occurred. Please try again.")
      setFormLoading(false)
    }
  }

  const handleRoleChange = (value: string) => {
    setRole(value)
    setRoleIdInput("")
    if (value !== 'teacher') setDepartment("")
  }

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(successPassword)
    setShowSuccessModal(false)
    setSuccessPassword("")
  }

  const isEditing = showEditModal && editingUser !== null
  const currentOnSubmit = isEditing ? handleUpdate : handleFormSubmit
  const currentTitle = isEditing ? "Edit User" : "Create New User"
  const currentDescription = isEditing 
    ? "Update the user's details." 
    : "Fill in the details to create a new user account. A temporary password will be generated."
  const currentButtonText = formLoading 
    ? (isEditing ? "Updating user..." : "Creating user...") 
    : (isEditing ? "Update User" : "Create User")

  if (loading) {
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
                <p className="text-muted-foreground">Loading users...</p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    )
  }

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
                  <CardTitle>Users ({users.length})</CardTitle>
                  <CardDescription>All registered users in the system</CardDescription>
                </div>
                <Dialog open={showAddModal} onOpenChange={(open) => { setShowAddModal(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button onClick={handleAddUser}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{currentTitle}</DialogTitle>
                      <DialogDescription>{currentDescription}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={currentOnSubmit} className="space-y-4">
                      {formError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                      )}
                      <div className="space-y-2">
                        <label htmlFor="firstName" className="text-sm font-medium">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          id="firstName"
                          placeholder="John"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          disabled={formLoading}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="lastName" className="text-sm font-medium">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          id="lastName"
                          placeholder="Doe"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          disabled={formLoading}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="john.doe@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={formLoading}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="role" className="text-sm font-medium">
                          Role <span className="text-red-500">*</span>
                        </label>
                        <Select value={role} onValueChange={handleRoleChange} disabled={formLoading || isEditing}>
                          <SelectTrigger id="role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="teacher">Teacher</SelectItem>
                            <SelectItem value="administrator">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="roleId" className="text-sm font-medium">
                          {role.charAt(0).toUpperCase() + role.slice(1)} ID <span className="text-red-500">*</span>
                        </label>
                        <Input
                          id="roleId"
                          placeholder={`e.g., ${getPrefix(role)}123456`}
                          value={roleIdInput}
                          onChange={(e) => setRoleIdInput(e.target.value)}
                          disabled={formLoading}
                          required
                        />
                      </div>
                      
                      {role === 'teacher' && (
                        <div className="space-y-2">
                          <label htmlFor="department" className="text-sm font-medium">
                            Department <span className="text-red-500">*</span>
                          </label>
                          <Input
                            id="department"
                            placeholder="e.g., Computer Science"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            disabled={formLoading}
                            required
                          />
                        </div>
                      )}
                      
                      {isEditing && role === 'student' && (
                        <div className="space-y-2">
                          <label htmlFor="enrollmentDate" className="text-sm font-medium">
                            Enrollment Date
                          </label>
                          <Input
                            id="enrollmentDate"
                            type="date"
                            value={enrollmentDateInput}
                            onChange={(e) => setEnrollmentDateInput(e.target.value)}
                            disabled={formLoading}
                          />
                        </div>
                      )}
                      
                      {isEditing && role === 'teacher' && (
                        <div className="space-y-2">
                          <label htmlFor="qualifications" className="text-sm font-medium">
                            Qualifications
                          </label>
                          <Textarea
                            id="qualifications"
                            placeholder="Enter qualifications..."
                            value={qualifications}
                            onChange={(e) => setQualifications(e.target.value)}
                            disabled={formLoading}
                          />
                        </div>
                      )}
                      
                      <Button type="submit" className="w-full" disabled={formLoading}>
                        {currentButtonText}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="flex gap-4 mb-4">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="administrator">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => { setRoleFilter("all"); setStatusFilter("all"); setSearchTerm(""); }}>
                    Clear Filters
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div>
                  <p className="text-muted-foreground">No users found matching the criteria.</p>
                  {users.length === 0 && (
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>No users in the database. Check console for fetch errors.</AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Name</th>
                        <th className="text-left py-3 px-4 font-medium">Email</th>
                        <th className="text-left py-3 px-4 font-medium">Role</th>
                        <th className="text-left py-3 px-4 font-medium">Role ID</th>
                        <th className="text-left py-3 px-4 font-medium">Department</th>
                        <th className="text-left py-3 px-4 font-medium">Enrollment Date</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-left py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">{user.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="capitalize">
                              {user.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">{getRoleId(user) || '-'}</td>
                          <td className="py-3 px-4">
                            {user.role === "teacher" ? user.teacher?.department || "-" : "-"}
                          </td>
                          <td className="py-3 px-4">
                            {user.role === "student" ? user.student?.enrollment_date || "-" : "-"}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={user.status === "active" ? "default" : "secondary"}
                              className={user.status === "active" ? "bg-green-500 text-white" : "bg-gray-500 text-white"}
                            >
                              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(user.id)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditModal} onOpenChange={(open) => { setShowEditModal(open); if (!open) { setEditingUser(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{currentTitle}</DialogTitle>
            <DialogDescription>{currentDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={currentOnSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium">
                First Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="firstName"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={formLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={formLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address <span className="text-red-500">*</span>
              </label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={formLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium">
                Role <span className="text-red-500">*</span>
              </label>
              <Select value={role} onValueChange={handleRoleChange} disabled={formLoading || isEditing}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="administrator">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="roleId" className="text-sm font-medium">
                {role.charAt(0).toUpperCase() + role.slice(1)} ID <span className="text-red-500">*</span>
              </label>
              <Input
                id="roleId"
                placeholder={`e.g., ${getPrefix(role)}123456`}
                value={roleIdInput}
                onChange={(e) => setRoleIdInput(e.target.value)}
                disabled={formLoading}
                required
              />
            </div>
            
            {role === 'teacher' && (
              <div className="space-y-2">
                <label htmlFor="department" className="text-sm font-medium">
                  Department <span className="text-red-500">*</span>
                </label>
                <Input
                  id="department"
                  placeholder="e.g., Computer Science"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>
            )}
            
            {isEditing && role === 'student' && (
              <div className="space-y-2">
                <label htmlFor="enrollmentDate" className="text-sm font-medium">
                  Enrollment Date
                </label>
                <Input
                  id="enrollmentDate"
                  type="date"
                  value={enrollmentDateInput}
                  onChange={(e) => setEnrollmentDateInput(e.target.value)}
                  disabled={formLoading}
                />
              </div>
            )}
            
            {isEditing && role === 'teacher' && (
              <div className="space-y-2">
                <label htmlFor="qualifications" className="text-sm font-medium">
                  Qualifications
                </label>
                <Textarea
                  id="qualifications"
                  placeholder="Enter qualifications..."
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  disabled={formLoading}
                />
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={formLoading}>
              {currentButtonText}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Modal for Password */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Created Successfully!</DialogTitle>
            <DialogDescription>
              The user has been created with the following temporary password. Share this with the user securely. They can change it after login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md text-center font-mono text-lg">
              {successPassword}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleCopyPassword}
                className="flex-1"
              >
                Copy Password
              </Button>
              <DialogClose asChild>
                <Button className="flex-1">Close</Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}