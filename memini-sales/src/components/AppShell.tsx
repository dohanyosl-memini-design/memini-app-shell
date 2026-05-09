'use client'

import { usePathname, useRouter } from 'next/navigation'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isHome = pathname === '/home'

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      {!isHome && (
        <header className="flex items-center px-4 pt-10 pb-2">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition"
          >
            ←
          </button>
        </header>
      )}
      <main className="flex-1">{children}</main>
    </div>
  )
}
