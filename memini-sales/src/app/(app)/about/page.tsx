'use client'

import { Contact } from 'lucide-react'
import { Background } from '@/components/Background'
import { useTheme } from '@/contexts/ThemeContext'

export default function AboutPage() {
  const { theme } = useTheme()

  return (
    <>
      <Background />
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <Contact size={48} strokeWidth={1.2} style={{ color: theme.textSecondary }} />
        <h1 className="text-2xl font-bold mt-4" style={{ color: theme.textPrimary }}>
          Bemutatkozás
        </h1>
        <p className="mt-2" style={{ color: theme.textSecondary }}>
          Hamarosan...
        </p>
      </div>
    </>
  )
}
