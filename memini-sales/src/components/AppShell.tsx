'use client'

import { usePathname, useRouter } from 'next/navigation'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isHome = pathname === '/home'

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      {!isHome && (
        <header
          className="flex items-end px-4 pb-3 pt-[max(1.5rem,env(safe-area-inset-top))]"
          style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))' }}
        >
          <button
            onClick={() => router.back()}
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 active:bg-white/30 transition text-lg"
          >
            ←
          </button>
        </header>
      )}
      <main className="flex-1" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {children}
      </main>
    </div>
  )
}
