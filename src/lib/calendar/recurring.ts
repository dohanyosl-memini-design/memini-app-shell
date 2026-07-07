// Heti ritmus — kódban definiált, ismétlődő "sávok" (nem eseménykártyák).
// A naptár háttérsávként jeleníti meg őket. Bővíthető új szabályokkal.

import { eachDayOfInterval } from 'date-fns'
import type { RitualBand } from './types'

// weekday: 0=vasárnap, 1=hétfő ... 6=szombat
export interface WeeklyRitual {
  weekday: number
  title: string
}

export const WEEKLY_RITUALS: WeeklyRitual[] = [
  { weekday: 1, title: 'Pipeline review' },              // hétfő
  { weekday: 4, title: 'Hívónap' },                      // csütörtök
  { weekday: 5, title: 'KPI-logolás + heti review' },    // péntek
]

const byWeekday = new Map<number, string[]>()
for (const r of WEEKLY_RITUALS) {
  const arr = byWeekday.get(r.weekday) ?? []
  arr.push(r.title)
  byWeekday.set(r.weekday, arr)
}

/** Egy adott dátumtartomány minden napjára visszaadja a ráeső ritmus-sávokat. */
export function getRitualsInRange(from: Date, to: Date): RitualBand[] {
  if (to < from) return []
  const bands: RitualBand[] = []
  for (const day of eachDayOfInterval({ start: from, end: to })) {
    const titles = byWeekday.get(day.getDay())
    if (!titles) continue
    for (const title of titles) {
      bands.push({ date: day.toISOString(), weekday: day.getDay(), title })
    }
  }
  return bands
}
