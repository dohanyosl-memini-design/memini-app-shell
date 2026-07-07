// Deal pipeline szakaszok — egyetlen közös forrás (B2B értékesítési tölcsér).
// Kulcsok angolul, UI-labelek magyarul.

export const DEAL_STAGE_KEYS = [
  'outreach_sent',
  'follow_up',
  'sample_requested',
  'sample_sent',
  'trial_order',
  'won',
  'lost',
] as const

export type DealStage = (typeof DEAL_STAGE_KEYS)[number]

export const DEFAULT_DEAL_STAGE: DealStage = 'outreach_sent'

// Zárt (nem aktív pipeline) szakaszok
export const CLOSED_STAGES: DealStage[] = ['won', 'lost']

export interface DealStageConfig {
  key: DealStage
  label: string
  // Kanban-oszlop stílusok (Tailwind)
  color: string
  headerColor: string
  // Dashboard chart hex-szín
  hex: string
}

export const DEAL_STAGES: DealStageConfig[] = [
  { key: 'outreach_sent',    label: 'Kiküldve',        color: 'border-gray-300',   headerColor: 'bg-gray-100 text-gray-700',     hex: '#94a3b8' },
  { key: 'follow_up',        label: 'Follow-up alatt', color: 'border-blue-300',   headerColor: 'bg-blue-100 text-blue-700',     hex: '#60a5fa' },
  { key: 'sample_requested', label: 'Mintakérés',      color: 'border-purple-300', headerColor: 'bg-purple-100 text-purple-700', hex: '#a78bfa' },
  { key: 'sample_sent',      label: 'Minta kint',      color: 'border-amber-300',  headerColor: 'bg-amber-100 text-amber-700',   hex: '#fbbf24' },
  { key: 'trial_order',      label: 'Próbarendelés',   color: 'border-teal-300',   headerColor: 'bg-teal-100 text-teal-700',     hex: '#2dd4bf' },
  { key: 'won',              label: 'Partner',         color: 'border-green-300',  headerColor: 'bg-green-100 text-green-700',   hex: '#4ade80' },
  { key: 'lost',             label: 'Elengedve',       color: 'border-red-300',    headerColor: 'bg-red-100 text-red-700',       hex: '#f87171' },
]

export const DEAL_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  DEAL_STAGES.map((s) => [s.key, s.label])
)

export const DEAL_STAGE_COLORS: Record<string, string> = Object.fromEntries(
  DEAL_STAGES.map((s) => [s.key, s.hex])
)

// Régi (generikus) szakasz-kulcsok → új tölcsér-kulcsok.
// A closed_won/closed_lost a korábbi UI-írások miatt szerepel (won/lost-tal keverve volt).
export const LEGACY_STAGE_MAP: Record<string, DealStage> = {
  prospect:    'outreach_sent',
  qualified:   'follow_up',
  proposal:    'sample_requested',
  negotiation: 'sample_sent',
  closed_won:  'won',
  closed_lost: 'lost',
}

export const LEGACY_STAGE_KEYS = Object.keys(LEGACY_STAGE_MAP)

/**
 * Bármilyen (új, régi vagy ismeretlen) stage-értéket érvényes új kulccsá normalizál.
 * Ismeretlen érték esetén a default szakaszt adja vissza.
 */
export function normalizeStage(stage: string | null | undefined): DealStage {
  if (!stage) return DEFAULT_DEAL_STAGE
  if ((DEAL_STAGE_KEYS as readonly string[]).includes(stage)) return stage as DealStage
  return LEGACY_STAGE_MAP[stage] ?? DEFAULT_DEAL_STAGE
}
