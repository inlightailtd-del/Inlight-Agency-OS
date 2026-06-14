import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">INLIGHT Agency OS</h1>
          <div className="space-x-4">
            <Link
              href="/login"
              className="inline-block px-6 py-2 text-white hover:bg-slate-800 rounded-lg transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-block px-6 py-2 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-5xl font-bold mb-6">
            The Autonomous AI Operating System for Digital Agencies
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Manage clients, projects, and invoices. Powered by AI agents working for you 24/7.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-3 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 transition text-lg"
          >
            Start Free
          </Link>
        </div>

        {/* Features Grid - Coming Soon */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-2">CRM & Projects</h3>
            <p className="text-slate-300">Manage clients, contacts, and projects in one place.</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-2">Invoicing & Finance</h3>
            <p className="text-slate-300">Create invoices, track expenses, monitor cash flow.</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-2">AI Agents (Coming Soon)</h3>
            <p className="text-slate-300">Autonomous agents that work 24/7 to grow your business.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400">
          <p>&copy; 2026 INLIGHT. Built for Pakistani agencies by INLIGHT.</p>
        </div>
      </footer>
    </div>
  )
}
