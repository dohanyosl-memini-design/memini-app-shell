export type ThemeId = 'nature' | 'city' | 'dark' | 'light'

export interface Theme {
  id: ThemeId
  label: string
  emoji: string
  bgImage?: string
  bgGradient: string
  overlayColor: string
  cardBg: string
  cardBorder: string
  inputBg: string
  inputBorder: string
  textPrimary: string
  textSecondary: string
  buttonBg: string
  buttonText: string
}

export const THEMES: Record<ThemeId, Theme> = {
  nature: {
    id: 'nature',
    label: 'Természet',
    emoji: '🌿',
    bgImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=2560&q=85&auto=format&fit=crop',
    bgGradient: 'linear-gradient(135deg, #1a2a1a 0%, #2d4a2d 100%)',
    overlayColor: 'rgba(0,0,0,0.15)',
    cardBg: 'rgba(255,255,255,0.38)',
    cardBorder: 'rgba(255,255,255,0.55)',
    inputBg: 'rgba(255,255,255,0.28)',
    inputBorder: 'rgba(255,255,255,0.45)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.7)',
    buttonBg: 'rgba(255,255,255,0.92)',
    buttonText: '#1a2a1a',
  },
  city: {
    id: 'city',
    label: 'Város',
    emoji: '🏙️',
    bgImage: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=2560&q=85&auto=format&fit=crop',
    bgGradient: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a3a 100%)',
    overlayColor: 'rgba(10,10,30,0.2)',
    cardBg: 'rgba(255,255,255,0.32)',
    cardBorder: 'rgba(255,255,255,0.48)',
    inputBg: 'rgba(255,255,255,0.22)',
    inputBorder: 'rgba(255,255,255,0.38)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.65)',
    buttonBg: 'rgba(255,255,255,0.92)',
    buttonText: '#0f0f1a',
  },
  dark: {
    id: 'dark',
    label: 'Sötét',
    emoji: '🌑',
    bgGradient: 'linear-gradient(145deg, #080810 0%, #0f0f1e 40%, #141420 100%)',
    overlayColor: 'rgba(0,0,0,0)',
    cardBg: 'rgba(255,255,255,0.12)',
    cardBorder: 'rgba(255,255,255,0.22)',
    inputBg: 'rgba(255,255,255,0.1)',
    inputBorder: 'rgba(255,255,255,0.2)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.5)',
    buttonBg: '#ffffff',
    buttonText: '#080810',
  },
  light: {
    id: 'light',
    label: 'Világos',
    emoji: '☀️',
    bgGradient: 'linear-gradient(145deg, #e8edf5 0%, #dde4f0 50%, #d0d9ee 100%)',
    overlayColor: 'rgba(0,0,0,0)',
    cardBg: 'rgba(255,255,255,0.65)',
    cardBorder: 'rgba(255,255,255,0.9)',
    inputBg: 'rgba(255,255,255,0.7)',
    inputBorder: 'rgba(0,0,0,0.1)',
    textPrimary: '#1a1a2e',
    textSecondary: 'rgba(26,26,46,0.55)',
    buttonBg: '#1a1a2e',
    buttonText: '#ffffff',
  },
}

export const DEFAULT_THEME: ThemeId = 'nature'
