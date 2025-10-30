"use client"

import { Card } from "@/components/ui/card"

export default function SessionManager() {
  const sessions = [
    { id: 1, course: "CS101", date: "2024-10-29", attendees: 28, status: "completed" },
    { id: 2, course: "CS102", date: "2024-10-28", attendees: 25, status: "completed" },
    { id: 3, course: "CS103", date: "2024-10-27", attendees: 22, status: "completed" },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-foreground mb-6">Session History</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((session) => (
          <Card key={session.id} className="p-6 border border-border">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{session.course}</h3>
                <p className="text-sm text-muted-foreground">{session.date}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-accent/20 text-accent">
                {session.status}
              </span>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-2xl font-bold text-foreground">{session.attendees}</p>
              <p className="text-sm text-muted-foreground">Students Attended</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
