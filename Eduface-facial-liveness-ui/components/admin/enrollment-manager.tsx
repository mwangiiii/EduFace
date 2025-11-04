"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useApp } from "@/lib/context"

export default function EnrollmentManager() {
  const [newStudent, setNewStudent] = useState("")
  const { students, loading, loadStudents, addStudent } = useApp()

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const handleAddStudent = async () => {
    if (newStudent.trim()) {
      const [name, email] = newStudent.includes("@")
        ? newStudent.split("|")
        : [newStudent, `${newStudent.toLowerCase().replace(" ", ".")}@university.edu`]

      await addStudent(name.trim(), email.trim())
      setNewStudent("")
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-4">Student Enrollment</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Enter student name or name|email"
            value={newStudent}
            onChange={(e) => setNewStudent(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddStudent()}
            disabled={loading}
          />
          <Button
            onClick={handleAddStudent}
            disabled={loading}
            className="bg-primary text-primary-foreground hover:opacity-90"
          >
            {loading ? "Adding..." : "Add Student"}
          </Button>
        </div>
      </div>

      <Card className="border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Enrolled Date</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-6 py-4 text-foreground">{student.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{student.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        student.enrolled ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {student.enrolled ? "Enrolled" : "Pending"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(student.enrollmentDate).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
