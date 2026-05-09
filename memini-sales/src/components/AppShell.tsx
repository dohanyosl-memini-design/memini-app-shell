'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const NAV = [
  { href: '/products', label: 'Termékek', icon: '🏷️' },
  { href: '/new-partner', label: 'Új partner', icon: '➕' },
]

export function AppShell({ children, userName }: { children: React.ReactNode; userName: string }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <span className="font-bold text-lg text-brand-700">Memini Sales</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-gray-400 hover:text-gray-700 transition"
          >
            Kilépés
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="flex-shrink-0 bg-white border-t border-gray-100 flex">
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition ${
                active ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-2xl leading-none">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
