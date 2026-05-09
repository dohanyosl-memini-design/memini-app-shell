'use client'

import { Check } from 'lucide-react'
import { Background } from '@/components/Background'
import { useTheme } from '@/contexts/ThemeContext'
import { THEMES, type ThemeId } from '@/lib/themes'

const THEME_ORDER: ThemeId[] = ['nature', 'city', 'dark', 'light']

export default function SettingsPage() {
  const { theme, themeId, setTheme } = useTheme()

  return (
    <>
      <Background />
      <div
        className="min-h-screen px-6 pb-10 md:px-10 lg:px-16"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <h1
          className="text-2xl md:text-3xl font-bold mb-8 mt-2"
          style={{ color: theme.textPrimary }}
        >
          Beállítások
        </h1>

        <p
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: theme.textSecondary }}
        >
          Megjelenés
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-2xl">
          {THEME_ORDER.map((id) => {
            const t = THEMES[id]
            const active = themeId === id
            return (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className="relative rounded-2xl p-5 flex flex-col items-center gap-3 transition active:scale-95"
                style={{
                  background: active ? theme.cardBg : 'rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: `1px solid ${active ? theme.cardBorder : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: active ? '0 4px 24px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                <span className="text-3xl">{t.emoji}</span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: theme.textPrimary }}
                >
                  {t.label}
                </span>
                {active && (
                  <div
                    className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: theme.buttonBg }}
                  >
                    <Check size={12} strokeWidth={3} style={{ color: theme.buttonText }} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
