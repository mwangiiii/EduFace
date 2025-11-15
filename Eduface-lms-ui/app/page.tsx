import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold mb-4 text-blue-700">Welcome to EduFace LMS</h1>
      <p className="mb-8 text-lg text-gray-700">Your gateway to smart attendance and learning management.</p>
      <nav className="flex flex-wrap gap-4">
        <Link href="/login" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Login</Link>
        <Link href="/signup" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Sign Up</Link>
        <Link href="/dashboard" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Dashboard</Link>
        <Link href="/live-attendance" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Live Attendance</Link>
        <Link href="/reports" className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">Reports</Link>
      </nav>
    </main>
  );
}
