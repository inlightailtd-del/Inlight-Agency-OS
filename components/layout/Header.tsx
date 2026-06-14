'use client'

import { useEffect, useState } from 'react'
import { Bell, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function Header({ title }: { title: string }) {
  const [userName, setUserName] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    const getUserName = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // For now, use email. Later, get from profile
        setUserName(user.email?.split('@')[0] || 'User')
      }
    }

    getUserName()
  }, [supabase])

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Page Title */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, {userName}
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User Menu */}
          <button className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition">
            <User size={20} />
            <span className="text-sm font-medium hidden sm:inline">{userName}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
