"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Edit2, Trash2, Users, BookOpen, AlertCircle, ChevronDown, ChevronRight, Clock, MapPin, UserCheck } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"

interface Course {
  id: string
  course_id: string
  name: string
  description: string | null
  semester: string
  units?: Unit[]
  enrollments_count?: number
}

interface Unit {
  id: string
  unit_id: string
  course_id: string
  name: string
  description: string | null
  teacher_assignments?: UnitTeacher[]
}

interface UnitTeacher {
  id: string
  unit_id: string
  teacher_id: string
  teacher_name: string
  teacher_code: string
  room: string
  schedule: {
    days: string[]
    start_time: string
    end_time: string
  }
}

interface Teacher {
  id: string
  teacher_id: string
  user_id: string
  name: string
  department: string
}

interface Student {
  id: string
  student_id: string
  user_id: string
  name: string
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function hasTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const toMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const s1 = toMinutes(start1)
  const e1 = toMinutes(end1)
  const s2 = toMinutes(start2)
  const e2 = toMinutes(end2)

  return Math.max(s1, s2) < Math.min(e1, e2)
}

export default function CoursesManagementPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())
  
  // Course modal states
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [courseFormData, setCourseFormData] = useState({
    course_id: '',
    name: '',
    description: '',
    semester: ''
  })
  
  // Unit modal states
  const [showUnitModal, setShowUnitModal] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [selectedCourseForUnit, setSelectedCourseForUnit] = useState<string | null>(null)
  const [unitFormData, setUnitFormData] = useState({
    unit_id: '',
    name: '',
    description: ''
  })
  
  // Teacher assignment modal states
  const [showTeacherAssignmentModal, setShowTeacherAssignmentModal] = useState(false)
  const [selectedUnitForTeacher, setSelectedUnitForTeacher] = useState<Unit | null>(null)
  const [editingTeacherAssignment, setEditingTeacherAssignment] = useState<UnitTeacher | null>(null)
  const [teacherAssignmentFormData, setTeacherAssignmentFormData] = useState({
    teacher_id: '',
    room: '',
    days: [] as string[],
    start_time: '',
    end_time: ''
  })
  
  // Enrollment modal states
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false)
  const [selectedCourseForEnrollment, setSelectedCourseForEnrollment] = useState<Course | null>(null)
  const [selectedStudentsForEnrollment, setSelectedStudentsForEnrollment] = useState<string[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([])
  
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchCourses(),
        fetchTeachers(),
        fetchStudents()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCourses = async () => {
    const { data: coursesData, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching courses:', error)
      return
    }

    // Fetch units and enrollment counts for each course
    const coursesWithDetails = await Promise.all(
      (coursesData || []).map(async (course) => {
        // Fetch units
        const { data: units } = await supabase
          .from('units')
          .select('*')
          .eq('course_id', course.id)

        // Fetch teacher assignments for each unit
        const unitsWithTeachers = await Promise.all(
          (units || []).map(async (unit) => {
            const { data: assignments } = await supabase
              .from('unit_teachers')
              .select('id, teacher_id, room, schedule')
              .eq('unit_id', unit.id)

            // Fetch teacher details for each assignment
            const assignmentsWithDetails = await Promise.all(
              (assignments || []).map(async (assignment) => {
                const { data: teacher } = await supabase
                  .from('teachers')
                  .select('teacher_id, user_id')
                  .eq('id', assignment.teacher_id)
                  .single()

                if (!teacher) return null

                const { data: user } = await supabase
                  .from('users')
                  .select('first_name, last_name')
                  .eq('id', teacher.user_id)
                  .single()

                return {
                  id: assignment.id,
                  unit_id: unit.id,
                  teacher_id: assignment.teacher_id,
                  teacher_name: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
                  teacher_code: teacher.teacher_id,
                  room: assignment.room,
                  schedule: assignment.schedule
                }
              })
            )

            return {
              ...unit,
              teacher_assignments: assignmentsWithDetails.filter(a => a !== null) as UnitTeacher[]
            }
          })
        )

        // Fetch enrollment count
        const { count } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id)
          .eq('status', 'active')

        return {
          ...course,
          units: unitsWithTeachers,
          enrollments_count: count || 0
        }
      })
    )

    setCourses(coursesWithDetails)
  }

  const fetchTeachers = async () => {
    const { data: teachersData } = await supabase
      .from('teachers')
      .select('id, teacher_id, user_id, department')

    if (!teachersData) return

    const teachersWithNames = await Promise.all(
      teachersData.map(async (teacher) => {
        const { data: user } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', teacher.user_id)
          .single()

        return {
          ...teacher,
          name: user ? `${user.first_name} ${user.last_name}` : 'Unknown'
        }
      })
    )

    setTeachers(teachersWithNames)
  }

  const fetchStudents = async () => {
    const { data: studentsData } = await supabase
      .from('students')
      .select('id, student_id, user_id')

    if (!studentsData) return

    const studentsWithNames = await Promise.all(
      studentsData.map(async (student) => {
        const { data: user } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', student.user_id)
          .single()

        return {
          ...student,
          name: user ? `${user.first_name} ${user.last_name}` : 'Unknown'
        }
      })
    )

    setStudents(studentsWithNames)
  }

  const toggleCourseExpansion = (courseId: string) => {
    const newExpanded = new Set(expandedCourses)
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId)
    } else {
      newExpanded.add(courseId)
    }
    setExpandedCourses(newExpanded)
  }

  // Course CRUD handlers
  const handleAddCourse = () => {
    setEditingCourse(null)
    setCourseFormData({ course_id: '', name: '', description: '', semester: '' })
    setFormError('')
    setShowCourseModal(true)
  }

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course)
    setCourseFormData({
      course_id: course.course_id,
      name: course.name,
      description: course.description || '',
      semester: course.semester
    })
    setFormError('')
    setShowCourseModal(true)
  }

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    try {
      if (editingCourse) {
        const { error } = await supabase
          .from('courses')
          .update({
            course_id: courseFormData.course_id,
            name: courseFormData.name,
            description: courseFormData.description || null,
            semester: courseFormData.semester
          })
          .eq('id', editingCourse.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('courses')
          .insert({
            course_id: courseFormData.course_id,
            name: courseFormData.name,
            description: courseFormData.description || null,
            semester: courseFormData.semester
          })

        if (error) throw error
      }

      setShowCourseModal(false)
      fetchCourses()
    } catch (error: any) {
      setFormError(error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure? This will delete all units, teacher assignments, and enrollments for this course.')) return

    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId)

      if (error) throw error
      fetchCourses()
    } catch (error: any) {
      alert('Error deleting course: ' + error.message)
    }
  }

  // Unit CRUD handlers
  const handleAddUnit = (courseId: string) => {
    setEditingUnit(null)
    setSelectedCourseForUnit(courseId)
    setUnitFormData({
      unit_id: '',
      name: '',
      description: ''
    })
    setFormError('')
    setShowUnitModal(true)
  }

  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit)
    setSelectedCourseForUnit(unit.course_id)
    setUnitFormData({
      unit_id: unit.unit_id,
      name: unit.name,
      description: unit.description || ''
    })
    setFormError('')
    setShowUnitModal(true)
  }

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    try {
      if (editingUnit) {
        const { error } = await supabase
          .from('units')
          .update({
            unit_id: unitFormData.unit_id,
            name: unitFormData.name,
            description: unitFormData.description || null
          })
          .eq('id', editingUnit.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('units')
          .insert({
            unit_id: unitFormData.unit_id,
            course_id: selectedCourseForUnit,
            name: unitFormData.name,
            description: unitFormData.description || null
          })

        if (error) throw error
      }

      setShowUnitModal(false)
      fetchCourses()
    } catch (error: any) {
      setFormError(error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm('Are you sure? This will delete all teacher assignments and attendance sessions for this unit.')) return

    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unitId)

      if (error) throw error
      fetchCourses()
    } catch (error: any) {
      alert('Error deleting unit: ' + error.message)
    }
  }

  // Teacher assignment handlers
  const handleAddTeacherAssignment = (unit: Unit) => {
    setEditingTeacherAssignment(null)
    setSelectedUnitForTeacher(unit)
    setTeacherAssignmentFormData({
      teacher_id: '',
      room: '',
      days: [],
      start_time: '',
      end_time: ''
    })
    setFormError('')
    setShowTeacherAssignmentModal(true)
  }

  const handleEditTeacherAssignment = (unit: Unit, assignment: UnitTeacher) => {
    setEditingTeacherAssignment(assignment)
    setSelectedUnitForTeacher(unit)
    setTeacherAssignmentFormData({
      teacher_id: assignment.teacher_id,
      room: assignment.room,
      days: assignment.schedule.days || [],
      start_time: assignment.schedule.start_time || '',
      end_time: assignment.schedule.end_time || ''
    })
    setFormError('')
    setShowTeacherAssignmentModal(true)
  }

  const handleTeacherAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setFormError('')
    setFormLoading(true)

    if (!teacherAssignmentFormData.teacher_id || !teacherAssignmentFormData.room) {
      setFormError('Please fill in all required fields')
      setFormLoading(false)
      return
    }

    if (teacherAssignmentFormData.days.length === 0) {
      setFormError('Please select at least one day')
      setFormLoading(false)
      return
    }

    if (!teacherAssignmentFormData.start_time || !teacherAssignmentFormData.end_time) {
      setFormError('Please provide start and end times')
      setFormLoading(false)
      return
    }

    // Ensure end time is after start time
    const toMinutes = (time: string): number => {
      const [h, m] = time.split(":").map(Number)
      return h * 60 + m
    }
    const startMinutes = toMinutes(teacherAssignmentFormData.start_time)
    const endMinutes = toMinutes(teacherAssignmentFormData.end_time)
    if (endMinutes <= startMinutes) {
      setFormError('End time must be after start time')
      setFormLoading(false)
      return
    }

    // Frontend conflict check
    try {
      const { data: existingAssignmentsData } = await supabase
        .from('unit_teachers')
        .select('id, schedule')
        .eq('teacher_id', teacherAssignmentFormData.teacher_id)

      let existingAssignments = existingAssignmentsData || []

      if (editingTeacherAssignment && editingTeacherAssignment.teacher_id === teacherAssignmentFormData.teacher_id) {
        existingAssignments = existingAssignments.filter(a => a.id !== editingTeacherAssignment.id)
      }

      const proposedDays = teacherAssignmentFormData.days
      const proposedStart = teacherAssignmentFormData.start_time
      const proposedEnd = teacherAssignmentFormData.end_time

      for (const day of proposedDays) {
        for (const ass of existingAssignments) {
          const existingDays = ass.schedule.days || []
          const existingStart = ass.schedule.start_time || ''
          const existingEnd = ass.schedule.end_time || ''

          if (existingDays.includes(day) && hasTimeOverlap(proposedStart, proposedEnd, existingStart, existingEnd)) {
            setFormError(`Conflict detected: Teacher is already assigned to another unit on ${day} from ${existingStart} to ${existingEnd}. Please choose a different time slot.`)
            setFormLoading(false)
            return
          }
        }
      }
    } catch (error) {
      console.error('Error checking schedule conflicts:', error)
      // Proceed anyway, backend will catch it
    }

    try {
      const schedule = {
        days: teacherAssignmentFormData.days,
        start_time: teacherAssignmentFormData.start_time,
        end_time: teacherAssignmentFormData.end_time
      }

      if (editingTeacherAssignment) {
        const { error } = await supabase
          .from('unit_teachers')
          .update({
            teacher_id: teacherAssignmentFormData.teacher_id,
            room: teacherAssignmentFormData.room,
            schedule
          })
          .eq('id', editingTeacherAssignment.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('unit_teachers')
          .insert({
            unit_id: selectedUnitForTeacher!.id,
            teacher_id: teacherAssignmentFormData.teacher_id,
            room: teacherAssignmentFormData.room,
            schedule
          })

        if (error) throw error
      }

      setShowTeacherAssignmentModal(false)
      fetchCourses()
    } catch (error: any) {
      setFormError(error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteTeacherAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this teacher assignment?')) return

    try {
      const { error } = await supabase
        .from('unit_teachers')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error
      fetchCourses()
    } catch (error: any) {
      alert('Error deleting teacher assignment: ' + error.message)
    }
  }

  const toggleDay = (day: string) => {
    const newDays = teacherAssignmentFormData.days.includes(day)
      ? teacherAssignmentFormData.days.filter(d => d !== day)
      : [...teacherAssignmentFormData.days, day]
    
    setTeacherAssignmentFormData({ ...teacherAssignmentFormData, days: newDays })
  }

  // Enrollment handlers
  const handleManageEnrollments = async (course: Course) => {
    setSelectedCourseForEnrollment(course)
    setSelectedStudentsForEnrollment([])
    
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('course_id', course.id)
      .eq('status', 'active')

    const enrolledIds = enrollments?.map(e => e.student_id) || []
    const enrolled = students.filter(s => enrolledIds.includes(s.id))
    setEnrolledStudents(enrolled)
    
    setShowEnrollmentModal(true)
  }

  const handleEnrollStudents = async () => {
    if (!selectedCourseForEnrollment || selectedStudentsForEnrollment.length === 0) {
      alert('Please select at least one student')
      return
    }

    setFormLoading(true)
    try {
      const enrollments = selectedStudentsForEnrollment.map(studentId => ({
        student_id: studentId,
        course_id: selectedCourseForEnrollment.id,
        enrollment_date: new Date().toISOString().split('T')[0],
        status: 'active'
      }))

      const { error } = await supabase
        .from('enrollments')
        .insert(enrollments)

      if (error) throw error

      setShowEnrollmentModal(false)
      fetchCourses()
    } catch (error: any) {
      alert('Error enrolling students: ' + error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleUnenrollStudent = async (studentId: string) => {
    if (!selectedCourseForEnrollment) return
    if (!confirm('Are you sure you want to drop this student from the course?')) return

    try {
      const { error } = await supabase
        .from('enrollments')
        .update({ status: 'dropped' })
        .eq('course_id', selectedCourseForEnrollment.id)
        .eq('student_id', studentId)

      if (error) throw error

      const updated = enrolledStudents.filter(s => s.id !== studentId)
      setEnrolledStudents(updated)
      fetchCourses()
    } catch (error: any) {
      alert('Error dropping student: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 pl-64">
          <Navbar />
          <main className="pt-16 p-6">
            <p>Loading courses...</p>
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
            <h1 className="text-3xl font-bold mb-2">Course Management</h1>
            <p className="text-muted-foreground">Manage courses, units, teacher schedules, and student enrollments</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Courses ({courses.length})</CardTitle>
                  <CardDescription>View and manage all courses and their units</CardDescription>
                </div>
                <Button onClick={handleAddCourse}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Course
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {courses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No courses found. Create your first course to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {courses.map((course) => (
                    <Card key={course.id} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleCourseExpansion(course.id)}
                                className="p-0 h-6 w-6"
                              >
                                {expandedCourses.has(course.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              <div>
                                <CardTitle className="text-lg">{course.name}</CardTitle>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="outline">{course.course_id}</Badge>
                                  <Badge>{course.semester}</Badge>
                                  <Badge variant="secondary">
                                    {course.units?.length || 0} units
                                  </Badge>
                                  <Badge variant="secondary">
                                    {course.enrollments_count} students
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            {course.description && (
                              <p className="text-sm text-muted-foreground mt-2 ml-8">{course.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleManageEnrollments(course)}
                            >
                              <Users className="h-4 w-4 mr-1" />
                              Enrollments
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCourse(course)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCourse(course.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      {expandedCourses.has(course.id) && (
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold">Units</h4>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddUnit(course.id)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Unit
                              </Button>
                            </div>

                            {course.units && course.units.length > 0 ? (
                              <div className="space-y-3">
                                {course.units.map((unit) => (
                                  <Card key={unit.id} className="bg-muted/30">
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{unit.name}</span>
                                            <Badge variant="outline" className="text-xs">
                                              {unit.unit_id}
                                            </Badge>
                                          </div>
                                          {unit.description && (
                                            <p className="text-xs text-muted-foreground mt-1 ml-6">
                                              {unit.description}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditUnit(unit)}
                                          >
                                            <Edit2 className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteUnit(unit.id)}
                                          >
                                            <Trash2 className="h-3 w-3 text-red-500" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Teacher Assignments */}
                                      <div className="space-y-2 ml-6">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-semibold text-muted-foreground">
                                            Teacher Schedules ({unit.teacher_assignments?.length || 0})
                                          </span>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 text-xs"
                                            onClick={() => handleAddTeacherAssignment(unit)}
                                          >
                                            <Plus className="h-3 w-3 mr-1" />
                                            Assign Teacher
                                          </Button>
                                        </div>

                                        {unit.teacher_assignments && unit.teacher_assignments.length > 0 ? (
                                          <div className="space-y-2">
                                            {unit.teacher_assignments.map((assignment) => (
                                              <div
                                                key={assignment.id}
                                                className="flex items-start justify-between p-2 border rounded bg-background"
                                              >
                                                <div className="flex-1 space-y-1">
                                                  <div className="flex items-center gap-2">
                                                    <UserCheck className="h-3 w-3 text-green-500" />
                                                    <span className="text-sm font-medium">
                                                      {assignment.teacher_name}
                                                    </span>
                                                    <Badge variant="outline" className="text-xs">
                                                      {assignment.teacher_code}
                                                    </Badge>
                                                  </div>
                                                  <div className="flex items-center gap-3 text-xs text-muted-foreground ml-5">
                                                    <div className="flex items-center gap-1">
                                                      <MapPin className="h-3 w-3" />
                                                      <span>{assignment.room}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      <Clock className="h-3 w-3" />
                                                      <span>
                                                        {assignment.schedule.days.join(', ')} • {' '}
                                                        {assignment.schedule.start_time} - {assignment.schedule.end_time}
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="flex gap-1">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7"
                                                    onClick={() => handleEditTeacherAssignment(unit, assignment)}
                                                  >
                                                    <Edit2 className="h-3 w-3" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7"
                                                    onClick={() => handleDeleteTeacherAssignment(assignment.id)}
                                                  >
                                                    <Trash2 className="h-3 w-3 text-red-500" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-muted-foreground text-center py-2">
                                            No teachers assigned yet.
                                          </p>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No units yet. Add a unit to get started.
                              </p>
                            )}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Course Modal */}
          <Dialog open={showCourseModal} onOpenChange={setShowCourseModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCourse ? 'Edit Course' : 'Create New Course'}</DialogTitle>
                <DialogDescription>
                  {editingCourse ? 'Update course details' : 'Fill in the details to create a new course'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCourseSubmit} className="space-y-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Course ID *</label>
                  <Input
                    placeholder="e.g., CS101"
                    value={courseFormData.course_id}
                    onChange={(e) => setCourseFormData({ ...courseFormData, course_id: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Course Name *</label>
                  <Input
                    placeholder="e.g., Introduction to Computer Science"
                    value={courseFormData.name}
                    onChange={(e) => setCourseFormData({ ...courseFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Course description..."
                    value={courseFormData.description}
                    onChange={(e) => setCourseFormData({ ...courseFormData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Semester *</label>
                  <Input
                    placeholder="e.g., Fall 2025"
                    value={courseFormData.semester}
                    onChange={(e) => setCourseFormData({ ...courseFormData, semester: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={formLoading}>
                  {formLoading ? 'Saving...' : editingCourse ? 'Update Course' : 'Create Course'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Unit Modal */}
          <Dialog open={showUnitModal} onOpenChange={setShowUnitModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUnit ? 'Edit Unit' : 'Create New Unit'}</DialogTitle>
                <DialogDescription>
                  {editingUnit ? 'Update unit details' : 'Fill in the details to create a new unit. You can assign teachers and schedules after creation.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUnitSubmit} className="space-y-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit ID *</label>
                  <Input
                    placeholder="e.g., CS101-Unit1"
                    value={unitFormData.unit_id}
                    onChange={(e) => setUnitFormData({ ...unitFormData, unit_id: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit Name *</label>
                  <Input
                    placeholder="e.g., Introduction to Algorithms"
                    value={unitFormData.name}
                    onChange={(e) => setUnitFormData({ ...unitFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Unit description..."
                    value={unitFormData.description}
                    onChange={(e) => setUnitFormData({ ...unitFormData, description: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={formLoading}>
                  {formLoading ? 'Saving...' : editingUnit ? 'Update Unit' : 'Create Unit'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Teacher Assignment Modal */}
          <Dialog open={showTeacherAssignmentModal} onOpenChange={setShowTeacherAssignmentModal}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTeacherAssignment ? 'Edit Teacher Assignment' : 'Assign Teacher to Unit'}
                </DialogTitle>
                <DialogDescription>
                  Assign a teacher with their schedule and room for {selectedUnitForTeacher?.name}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleTeacherAssignmentSubmit} className="space-y-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Teacher *</label>
                  <Select
                    value={teacherAssignmentFormData.teacher_id}
                    onValueChange={(value) => setTeacherAssignmentFormData({ ...teacherAssignmentFormData, teacher_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name} - {teacher.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Room *</label>
                  <Input
                    placeholder="e.g., Room 101 or Lab A"
                    value={teacherAssignmentFormData.room}
                    onChange={(e) => setTeacherAssignmentFormData({ ...teacherAssignmentFormData, room: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Days *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={day}
                          checked={teacherAssignmentFormData.days.includes(day)}
                          onChange={() => toggleDay(day)}
                          className="rounded"
                        />
                        <label htmlFor={day} className="text-sm cursor-pointer">
                          {day}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Time *</label>
                    <Input
                      type="time"
                      value={teacherAssignmentFormData.start_time}
                      onChange={(e) => setTeacherAssignmentFormData({ ...teacherAssignmentFormData, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Time *</label>
                    <Input
                      type="time"
                      value={teacherAssignmentFormData.end_time}
                      onChange={(e) => setTeacherAssignmentFormData({ ...teacherAssignmentFormData, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  {/* <AlertDescription className="text-xs">
                    Multiple teachers can be assigned to the same unit with different schedules and rooms.
                    The system will check for conflicts automatically.
                  </AlertDescription> */}
                </Alert>

                <Button type="submit" className="w-full" disabled={formLoading}>
                  {formLoading ? 'Saving...' : editingTeacherAssignment ? 'Update Assignment' : 'Assign Teacher'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Enrollment Modal */}
          <Dialog open={showEnrollmentModal} onOpenChange={setShowEnrollmentModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Manage Enrollments - {selectedCourseForEnrollment?.name}</DialogTitle>
                <DialogDescription>
                  Enroll students or remove existing enrollments
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Enrolled Students ({enrolledStudents.length})</h4>
                  {enrolledStudents.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                      {enrolledStudents.map((student) => (
                        <div key={student.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">{student.name} ({student.student_id})</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnenrollStudent(student.id)}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Enroll New Students</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                    {students
                      .filter(s => !enrolledStudents.find(e => e.id === s.id))
                      .map((student) => (
                        <div key={student.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedStudentsForEnrollment.includes(student.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentsForEnrollment([...selectedStudentsForEnrollment, student.id])
                              } else {
                                setSelectedStudentsForEnrollment(
                                  selectedStudentsForEnrollment.filter(id => id !== student.id)
                                )
                              }
                            }}
                            className="rounded"
                          />
                          <label className="text-sm">{student.name} ({student.student_id})</label>
                        </div>
                      ))}
                  </div>
                </div>

                <Button
                  onClick={handleEnrollStudents}
                  disabled={formLoading || selectedStudentsForEnrollment.length === 0}
                  className="w-full"
                >
                  {formLoading ? 'Enrolling...' : `Enroll ${selectedStudentsForEnrollment.length} Student(s)`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}