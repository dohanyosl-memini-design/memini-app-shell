'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import type { Session } from 'next-auth'
import Sidebar from '@/components/Sidebar'

function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'
  const isPrintPage = /\/orders\/[^/]+\/print$/.test(pathname)

  if (isLoginPage || isPrintPage) return <>{children}</>
  if (!session) return <>{children}</>

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar session={session} />
      {/* pb-16 on mobile reserves space for the fixed bottom nav */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <div className="max-w-screen-2xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

export default function ClientLayout({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  return (
    <SessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  )
}
