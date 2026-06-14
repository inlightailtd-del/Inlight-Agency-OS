'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Briefcase, CheckSquare, DollarSign, Brain, Zap, Crown, TrendingUp, ListOrdered, Activity, BookOpen, Factory, Phone, Video, Globe, Code2, Cog, Send, Link2, Rocket, LogOut, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/dashboard/clients', icon: Users },
  { name: 'Projects', href: '/dashboard/projects', icon: Briefcase },
  { name: 'Milestones', href: '/dashboard/milestones', icon: CheckSquare },
  { name: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
  { name: 'Finance', href: '/dashboard/finance', icon: DollarSign },
  { name: 'Company Brain', href: '/dashboard/brain', icon: Brain },
  { name: 'Agents', href: '/dashboard/agents', icon: Zap },
  { name: 'Employees', href: '/dashboard/employees', icon: Users },
  { name: 'Managers', href: '/dashboard/managers', icon: Zap },
  { name: 'CEO Agent', href: '/dashboard/ceo', icon: Crown },
  { name: 'Revenue', href: '/dashboard/revenue', icon: TrendingUp },
  { name: 'Sales', href: '/dashboard/sales', icon: Phone },
  { name: 'Outreach', href: '/dashboard/outreach', icon: Send },
  { name: 'Voice AI', href: '/dashboard/voice', icon: Phone },
  { name: 'Content Mkting', href: '/dashboard/content-marketing', icon: BookOpen },
  { name: 'Video', href: '/dashboard/video', icon: Video },
  { name: 'Websites', href: '/dashboard/websites', icon: Globe },
  { name: 'Software', href: '/dashboard/software', icon: Code2 },
  { name: 'Automation', href: '/dashboard/automations', icon: Cog },
  { name: 'Integrations', href: '/dashboard/integrations', icon: Link2 },
  { name: 'Factory', href: '/dashboard/factory', icon: Factory },
  { name: 'Optimization', href: '/dashboard/optimization', icon: Activity },
  { name: 'Queue', href: '/dashboard/queue', icon: ListOrdered },
  { name: 'Learning', href: '/dashboard/learning', icon: BookOpen },
  { name: 'Growth', href: '/dashboard/growth', icon: Rocket },
]

export function Sidebar({ className = '' }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Signed out successfully')
      router.push('/login')
    } catch (error) {
      toast.error('Failed to sign out')
    }
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={`hidden md:flex flex-col w-64 bg-slate-900 text-white ${className}`}>
        {/* Logo */}
        <div className="px-6 py-8 border-b border-slate-800">
          <h1 className="text-2xl font-bold">INLIGHT</h1>
          <p className="text-xs text-slate-400 mt-1">Agency OS</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  active
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="px-4 py-6 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 bg-slate-900 text-white rounded-lg"
        >
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50">
          <div className="w-64 bg-slate-900 text-white h-full flex flex-col">
            {/* Logo */}
            <div className="px-6 py-8 border-b border-slate-800">
              <h1 className="text-2xl font-bold">INLIGHT</h1>
              <p className="text-xs text-slate-400 mt-1">Agency OS</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      active
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Logout Button */}
            <div className="px-4 py-6 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition"
              >
                <LogOut size={20} />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
