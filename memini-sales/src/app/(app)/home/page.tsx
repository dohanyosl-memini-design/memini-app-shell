'use client'

import Link from 'next/link'
import Image from 'next/image'
import { UserPlus, ClipboardList, MapPin, Settings, Contact } from 'lucide-react'
import { Background } from '@/components/Background'
import { useTheme } from '@/contexts/ThemeContext'
import { useSession } from 'next-auth/react'

const TILES = [
  {
    href: '/new-partner',
    label: 'Új partner',
    Icon: UserPlus,
  },
  {
    href: '/order',
    label: 'Megrendelés',
    Icon: ClipboardList,
  },
  {
    href: '/cities',
    label: 'Városok',
    Icon: MapPin,
  },
  {
    href: '/about',
    label: 'Bemutatkozás',
    Icon: Contact,
  },
]

export default function HomePage() {
  const { theme } = useTheme()
  const { data: session } = useSession()
  const name = session?.user?.name?.split(' ')[0] ?? ''

  return (
    <>
      <Background />
      <div
        className="min-h-screen flex flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-8 pb-4 md:px-10 md:pt-12 lg:px-16">
          <Image
            src="/memini-logo.svg"
            alt="Memini"
            width={110}
            height={32}
            className="md:w-[136px]"
            priority
          />
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-full px-3 py-2 transition"
            style={{
              background: theme.cardBg,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${theme.cardBorder}`,
              color: theme.textPrimary,
            }}
          >
            {name && (
              <span className="text-sm font-medium hidden sm:block">{name}</span>
            )}
            <Settings size={18} strokeWidth={1.8} />
          </Link>
        </header>

        {/* Cards */}
        <main className="flex-1 flex items-center justify-center px-6 py-6 md:px-10 lg:px-16">
          {/* Portrait: egymás alatt | Landscape md+: egymás mellett */}
          <div className="w-full max-w-sm landscape:md:max-w-4xl landscape:md:flex landscape:md:gap-5 flex flex-col gap-4 md:gap-5">
            {TILES.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-5 rounded-3xl px-7 py-6 md:py-8 active:scale-[0.97] transition-transform duration-150 landscape:md:flex-col landscape:md:items-center landscape:md:flex-1 landscape:md:py-10"
                style={{
                  background: theme.cardBg,
                  backdropFilter: 'blur(32px)',
                  WebkitBackdropFilter: 'blur(32px)',
                  border: `1px solid ${theme.cardBorder}`,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                }}
              >
                <Icon
                  size={28}
                  strokeWidth={1.5}
                  style={{ color: theme.textPrimary, flexShrink: 0 }}
                  className="md:w-9 md:h-9 landscape:md:w-10 landscape:md:h-10"
                />
                <span
                  className="text-xl font-semibold md:text-2xl landscape:md:text-xl"
                  style={{ color: theme.textPrimary }}
                >
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </>
  )
}
