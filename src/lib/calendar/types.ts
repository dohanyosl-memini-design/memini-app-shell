// Naptár modul (FÁZIS 1) — egységes eseménymodell a meglévő adatok fölött.
// A naptár NEM új adatsiló: minden esemény meglévő entitásokból (task, activity,
// deal, reorder) képződik, csak memóriában. Új tábla/migráció NINCS.

export type CalendarSource = 'task' | 'activity' | 'followup' | 'reorder' | 'ritual'

export type CalendarStatus = 'open' | 'done' | 'overdue'

export interface CalendarEvent {
  id: string                 // pl. "task-123", "reorder-7"
  source: CalendarSource
  title: string
  date: string               // ISO
  time?: string              // HH:mm, ha van értelmes időpont
  status?: CalendarStatus
  linkTo: string             // deep link a CRM megfelelő oldalára
  entityId?: string
  // Megjelenítést segítő, opcionális extra mezők (a drawerhez):
  subtitle?: string          // pl. cégnév / kapcsolattartó
  meta?: string              // pl. "Utolsó rendelés: 2025-01-10 · 22 hó"
}

// Heti ritmus — háttérsávként jelenik meg, NEM eseménykártyaként.
export interface RitualBand {
  date: string               // ISO (adott nap)
  weekday: number            // 0=vasárnap ... 6=szombat
  title: string
}

export interface CalendarPayload {
  from: string
  to: string
  events: CalendarEvent[]
  rituals: RitualBand[]
}

// Forrásonkénti megjelenítési meta (Tailwind osztályok). A follow-up
// figyelmeztető (amber), a reorder saját, bevétel-kritikus szín (violet).
export interface SourceMeta {
  label: string
  dot: string          // színes pötty
  cardBorder: string   // kártya bal szegély
  badge: string        // badge háttér+szöveg
}

export const SOURCE_META: Record<CalendarSource, SourceMeta> = {
  task:     { label: 'Feladat',   dot: 'bg-blue-500',   cardBorder: 'border-l-blue-400',   badge: 'bg-blue-100 text-blue-700' },
  activity: { label: 'Aktivitás', dot: 'bg-slate-400',  cardBorder: 'border-l-slate-300',  badge: 'bg-slate-100 text-slate-600' },
  followup: { label: 'Follow-up', dot: 'bg-amber-500',  cardBorder: 'border-l-amber-400',  badge: 'bg-amber-100 text-amber-700' },
  reorder:  { label: 'Reorder',   dot: 'bg-violet-500', cardBorder: 'border-l-violet-400', badge: 'bg-violet-100 text-violet-700' },
  ritual:   { label: 'Ritmus',    dot: 'bg-gray-300',   cardBorder: 'border-l-gray-200',   badge: 'bg-gray-100 text-gray-500' },
}
