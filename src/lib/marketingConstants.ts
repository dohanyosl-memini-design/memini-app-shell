// Marketing-konstansok (V1) — kliens és szerver oldalon egyaránt használható,
// prisma-függőség nélkül.

export const ARC_LEVELS = ['vision', 'yearly', 'quarterly', 'monthly'] as const
export type ArcLevel = (typeof ARC_LEVELS)[number]

export const ARC_LEVEL_LABELS: Record<string, string> = {
  vision:    'Hosszú távú',
  yearly:    'Éves',
  quarterly: 'Negyedéves',
  monthly:   'Havi',
}

export const ARC_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: 'Aktív',         color: 'bg-blue-100 text-blue-700' },
  achieved: { label: 'Teljesült',     color: 'bg-green-100 text-green-700' },
  missed:   { label: 'Nem teljesült', color: 'bg-red-100 text-red-600' },
  dropped:  { label: 'Elvetve',       color: 'bg-gray-100 text-gray-500' },
}

// Csatornák — a bodyDe/Hu/En + a naptár színkódjához.
export const CHANNELS: Array<{ key: string; label: string; icon: string; color: string; dot: string }> = [
  { key: 'blog',       label: 'Blogcikk',   icon: '📝', color: 'bg-violet-100 text-violet-700 border-violet-300', dot: 'bg-violet-500' },
  { key: 'linkedin',   label: 'LinkedIn',   icon: '💼', color: 'bg-sky-100 text-sky-700 border-sky-300',          dot: 'bg-sky-500' },
  { key: 'facebook',   label: 'Facebook',   icon: '👍', color: 'bg-blue-100 text-blue-700 border-blue-300',       dot: 'bg-blue-500' },
  { key: 'instagram',  label: 'Instagram',  icon: '📸', color: 'bg-pink-100 text-pink-700 border-pink-300',       dot: 'bg-pink-500' },
  { key: 'newsletter', label: 'Hírlevél',   icon: '✉️', color: 'bg-amber-100 text-amber-700 border-amber-300',    dot: 'bg-amber-500' },
  { key: 'pinterest',  label: 'Pinterest',  icon: '📌', color: 'bg-red-100 text-red-700 border-red-300',          dot: 'bg-red-500' },
]

export const CHANNEL_KEYS = CHANNELS.map(c => c.key)

export function channelInfo(key: string) {
  return CHANNELS.find(c => c.key === key)
}

export const PIECE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Piszkozat',  color: 'bg-gray-100 text-gray-600' },
  ready:     { label: 'Kész',       color: 'bg-blue-100 text-blue-700' },
  scheduled: { label: 'Ütemezett',  color: 'bg-amber-100 text-amber-700' },
  published: { label: 'Publikált',  color: 'bg-green-100 text-green-700' },
  archived:  { label: 'Archivált',  color: 'bg-gray-100 text-gray-400' },
}

export const THEME_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planned:  { label: 'Tervezett',    color: 'bg-gray-100 text-gray-600' },
  approved: { label: 'Elfogadva',    color: 'bg-indigo-100 text-indigo-700' },
  active:   { label: 'Folyamatban',  color: 'bg-blue-100 text-blue-700' },
  done:     { label: 'Kész',         color: 'bg-green-100 text-green-700' },
}

// A három nyelv, német elsődleges (német logika).
export const LANGUAGES = [
  { key: 'de', label: 'Deutsch',  field: 'bodyDe', primary: true },
  { key: 'hu', label: 'Magyar',   field: 'bodyHu', primary: false },
  { key: 'en', label: 'English',  field: 'bodyEn', primary: false },
] as const
export type LangKey = (typeof LANGUAGES)[number]['key']

export const STRATEGIC_AREAS = [
  'Értékesítés és partnerhálózat',
  'Termék- és mintafejlesztés',
  'Gyártás és készlet',
  'Kiszállítás és operáció',
  'Automatizáció és rendszerek',
  'Pénzügy és nyereségesség',
  'Márka és marketing',
  'Csapat és kapacitás',
]

const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december']

export function arcPeriodLabel(a: { level: string; year: number | null; quarter: number | null; month: number | null }): string {
  if (a.level === 'yearly' && a.year) return String(a.year)
  if (a.level === 'quarterly' && a.year && a.quarter) return `${a.year} Q${a.quarter}`
  if (a.level === 'monthly' && a.year && a.month) return `${a.year}. ${MONTHS[a.month - 1]}`
  return ''
}
