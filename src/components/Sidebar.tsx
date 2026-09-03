'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import type { Session } from 'next-auth'
import {
  LayoutDashboard, Users, Building2, TrendingUp,
  CheckSquare, BarChart3, Package, FileText, Wallet,
  ClipboardList, ShoppingCart, LogOut, Euro, Menu, X,
  GitMerge, BookOpen, Calculator, HelpCircle, Shield,
  Sun, Moon, Bot, Factory, RefreshCw, CalendarDays, Megaphone, Mail, Brain,
  PackageOpen,
} from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

const navGroups = [
  {
    label: null,
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/naptar', label: 'Naptár', icon: CalendarDays },
      { href: '/tasks', label: 'Feladatok', icon: CheckSquare },
      { href: '/brain', label: 'Memini Brain', icon: Brain },
      { href: '/marketing', label: 'Marketing', icon: Megaphone },
    ],
  },
  {
    label: 'CRM',
    items: [
      { href: '/contacts', label: 'Ügyfelek', icon: Users },
      { href: '/companies', label: 'Cégek', icon: Building2 },
      { href: '/leads', label: 'Lead CRM', icon: GitMerge },
      { href: '/deals', label: 'Dealek', icon: TrendingUp },
    ],
  },
  {
    label: 'Kommunikáció',
    items: [
      { href: '/emails', label: 'Levelek', icon: Mail },
    ],
  },
  {
    label: 'Értékesítés',
    items: [
      { href: '/quotes', label: 'Ajánlatok', icon: ClipboardList },
      { href: '/orders', label: 'Megrendelések', icon: ShoppingCart },
      { href: '/invoices', label: 'Számlák', icon: FileText },
      { href: '/reorders', label: 'Reorder lista', icon: RefreshCw },
    ],
  },
  {
    label: 'Raktár',
    items: [
      { href: '/warehouse', label: 'Termékek & Készlet', icon: Package },
      { href: '/eszkozok', label: 'Kihelyezett eszközök', icon: PackageOpen },
      { href: '/pricelist', label: 'Ártáblázat', icon: Euro },
    ],
  },
  {
    label: 'Pénzügy',
    items: [
      { href: '/finance', label: 'Cashflow', icon: Wallet },
      { href: '/bookkeeping', label: 'Könyvelés', icon: Calculator },
      { href: '/reports', label: 'Riportok', icon: BarChart3 },
      { href: '/kpi', label: 'KPI Monitor', icon: TrendingUp },
      { href: '/currency', label: 'Árfolyam', icon: Euro },
    ],
  },
  {
    label: 'Gyártás',
    items: [
      { href: '/manufacturing', label: 'Gyártópartnerek', icon: Factory },
    ],
  },
  {
    label: 'Egyéb',
    items: [
      { href: '/chat', label: 'AI Chat', icon: Bot },
      { href: '/arthur', label: 'Arthur', icon: Bot },
      { href: '/settings', label: 'Beállítások', icon: Shield },
      { href: '/faq', label: 'Súgó / FAQ', icon: HelpCircle },
      { href: '/backup', label: 'Adatmentés', icon: Shield },
    ],
  },
]

const allItems = navGroups.flatMap(g => g.items)

const bottomNavItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Feladatok', icon: CheckSquare },
  { href: '/finance', label: 'Cashflow', icon: Wallet },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
]

export default function Sidebar({ session }: { session?: Session | null }) {
  const pathname = usePathname()
  const user = session?.user
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { dark, toggle } = useTheme()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <div className="hidden md:flex h-screen w-56 lg:w-60 bg-slate-900 text-white flex-col shrink-0">
        <div className="shrink-0 p-4 lg:p-5 border-b border-slate-700">
          <h1 className="text-base lg:text-lg font-bold text-white">Memini Design</h1>
          <p className="text-slate-400 text-xs mt-0.5">Vállalatirányítás</p>
        </div>

        <nav
          className="p-3 space-y-2"
          style={{ overflowY: 'scroll', maxHeight: 'calc(100vh - 130px)' }}
        >
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-1">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                      isActive(href)
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="font-medium">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 p-4 border-t border-slate-700">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{user.name}</p>
                <p className="text-slate-500 text-xs truncate">{user.email}</p>
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <button
                  onClick={toggle}
                  title={dark ? 'Nappali mód' : 'Éjszakai mód'}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  {dark ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  title="Kijelentkezés"
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-xs">Memini Design · Ulm, DE</p>
          )}
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 safe-area-pb">
        <div className="flex items-stretch">
          {bottomNavItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
                isActive(href) ? 'text-blue-400' : 'text-slate-400'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
          {/* Több gomb */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-slate-400"
          >
            <Menu size={20} />
            <span className="text-[10px] font-medium">Több</span>
          </button>
        </div>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 rounded-t-2xl"
            style={{ maxHeight: '90vh', overflowY: 'scroll' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div>
                <p className="text-white font-semibold">Memini Design</p>
                {user && <p className="text-slate-400 text-xs">{user.name} · {user.email}</p>}
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <nav className="p-3 space-y-2">
              {navGroups.map((group, gi) => (
                <div key={gi}>
                  {group.label && (
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-1">
                      {group.label}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-sm ${
                          isActive(href)
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="font-medium">{label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="px-4 pb-8 pt-2 border-t border-slate-700">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-3 w-full px-3 py-3 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors text-sm"
              >
                <LogOut size={18} />
                <span className="font-medium">Kijelentkezés</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
