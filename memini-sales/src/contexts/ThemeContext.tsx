'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { THEMES, DEFAULT_THEME, type Theme, type ThemeId } from '@/lib/themes'

interface ThemeContextValue {
  theme: Theme
  themeId: ThemeId
  setTheme: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[DEFAULT_THEME],
  themeId: DEFAULT_THEME,
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME)

  useEffect(() => {
    const saved = localStorage.getItem('memini-theme') as ThemeId | null
    if (saved && THEMES[saved]) setThemeId(saved)
  }, [])

  function setTheme(id: ThemeId) {
    setThemeId(id)
    localStorage.setItem('memini-theme', id)
  }

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeId], themeId, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
