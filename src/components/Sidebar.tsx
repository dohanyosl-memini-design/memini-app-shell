'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Building2, TrendingUp, CheckSquare, BarChart3 } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Ügyfelek', icon: Users },
  { href: '/companies', label: 'Cégek', icon: Building2 },
  { href: '/deals', label: 'Pipeline', icon: TrendingUp },
  { href: '/tasks', label: 'Feladatok', icon: CheckSquare },
  { href: '/reports', label: 'Riportok', icon: BarChart3 },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">Memini CRM</h1>
        <p className="text-slate-400 text-sm mt-1">Ügyfélkezelő rendszer</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <p className="text-slate-500 text-xs">© 2026 Memini CRM</p>
      </div>
    </div>
  )
}
