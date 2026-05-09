'use client'

import { useTheme } from '@/contexts/ThemeContext'

export function Background() {
  const { theme } = useTheme()

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {theme.bgImage ? (
        <>
          {/* Photo — scale-110 hides blur edges */}
          <img
            src={theme.bgImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110"
            style={{ filter: 'blur(22px)' }}
          />
          {/* Darkening overlay */}
          <div
            className="absolute inset-0"
            style={{ background: theme.overlayColor }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: theme.bgGradient }}
        />
      )}
    </div>
  )
}
