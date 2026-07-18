// Cél-konstansok (V1) — kliens és szerver oldalon egyaránt használható,
// prisma-függőség nélkül. A goalProgress.ts is innen importál.

export const GOAL_LEVELS = ['vision', 'yearly', 'quarterly', 'monthly'] as const
export type GoalLevel = (typeof GOAL_LEVELS)[number]

export const GOAL_LEVEL_LABELS: Record<string, string> = {
  vision:    'Hosszú távú',
  yearly:    'Éves',
  quarterly: 'Negyedéves',
  monthly:   'Havi',
}

export const GOAL_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: 'Aktív',       color: 'bg-blue-100 text-blue-700' },
  achieved: { label: 'Teljesült',   color: 'bg-green-100 text-green-700' },
  missed:   { label: 'Nem teljesült', color: 'bg-red-100 text-red-600' },
  dropped:  { label: 'Elvetve',     color: 'bg-gray-100 text-gray-500' },
}

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

export const GOAL_METRICS: Array<{ key: string; label: string; unit: string }> = [
  { key: 'outreach',       label: 'Kiküldött outreach',  unit: 'db' },
  { key: 'followup',       label: 'Follow-up aktivitás', unit: 'db' },
  { key: 'sampleRequests', label: 'Mintakérés',          unit: 'db' },
  { key: 'newPartners',    label: 'Új partner (won)',    unit: 'db' },
  { key: 'reorders',       label: 'Reorder',             unit: 'db' },
  { key: 'volumeEur',      label: 'Rendelési volumen',   unit: '€'  },
]

// Cél-időszak rövid megjelenítése, pl. "2026 Q3" vagy "2026. augusztus"
export function goalPeriodLabel(g: { level: string; year: number | null; quarter: number | null; month: number | null }): string {
  const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június',
    'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
  if (g.level === 'yearly' && g.year) return String(g.year)
  if (g.level === 'quarterly' && g.year && g.quarter) return `${g.year} Q${g.quarter}`
  if (g.level === 'monthly' && g.year && g.month) return `${g.year}. ${MONTHS[g.month - 1]}`
  return ''
}
