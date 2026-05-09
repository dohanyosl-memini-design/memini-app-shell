'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { Background } from '@/components/Background'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme } = useTheme()
  const isHome = pathname === '/home'

  return (
    <div className="flex flex-col min-h-screen">
      <Background />
      {!isHome && (
        <header
          className="flex items-end px-5 pb-3 md:px-10 lg:px-16"
          style={{
            paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
            paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
          }}
        >
          <button
            onClick={() => router.back()}
            className="w-11 h-11 rounded-full flex items-center justify-center transition active:scale-90"
            style={{
              background: theme.cardBg,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${theme.cardBorder}`,
              color: theme.textPrimary,
            }}
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
        </header>
      )}
      <main className="flex-1" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {children}
      </main>
    </div>
  )
}
