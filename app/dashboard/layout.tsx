import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params?: { slug?: string }
}) {
  // Determine page title based on current route
  const getPageTitle = () => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
    if (pathname.includes('/clients')) return 'Clients'
    if (pathname.includes('/projects')) return 'Projects'
    if (pathname.includes('/tasks')) return 'Tasks'
    if (pathname.includes('/finance')) return 'Finance'
    if (pathname.includes('/brain')) return 'Company Brain'
    if (pathname.includes('/agents')) return 'Agents'
    return 'Dashboard'
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header title="Dashboard" />

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
