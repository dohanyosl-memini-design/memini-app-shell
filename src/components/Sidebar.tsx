'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, TrendingUp,
  CheckSquare, BarChart3, Package, FileText, Wallet,
} from 'lucide-react'

const navGroups = [
  {
    label: null,
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'CRM',
    items: [
      { href: '/contacts', label: 'Ügyfelek', icon: Users },
      { href: '/companies', label: 'Cégek', icon: Building2 },
      { href: '/deals', label: 'Pipeline', icon: TrendingUp },
    ],
  },
  {
    label: 'Értékesítés',
    items: [
      { href: '/invoices', label: 'Számlák', icon: FileText },
    ],
  },
  {
    label: 'Raktár',
    items: [
      { href: '/warehouse', label: 'Termékek & Készlet', icon: Package },
    ],
  },
  {
    label: 'Pénzügy',
    items: [
      { href: '/finance', label: 'Cashflow', icon: Wallet },
      { href: '/reports', label: 'Riportok', icon: BarChart3 },
    ],
  },
  {
    label: 'Egyéb',
    items: [
      { href: '/tasks', label: 'Feladatok', icon: CheckSquare },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-60 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="p-5 border-b border-slate-700">
        <h1 className="text-lg font-bold text-white">Memini Design</h1>
        <p className="text-slate-400 text-xs mt-0.5">Vállalatirányítás</p>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-1">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="font-medium">{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <p className="text-slate-500 text-xs">Memini Design · Ulm, DE</p>
      </div>
    </div>
  )
}
