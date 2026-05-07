'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import type { Session } from 'next-auth'
import Sidebar from '@/components/Sidebar'

function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  if (!session) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar session={session} />
      <main className="flex-1 overflow-auto">
        {children}
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
