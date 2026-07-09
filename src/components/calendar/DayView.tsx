'use client'

import { isSameDay, isToday } from 'date-fns'
import { Sparkles, Clock } from 'lucide-react'
import type { CalendarEvent, RitualBand } from '@/lib/calendar/types'
import EventCard from './EventCard'

interface Props {
  day: Date
  events: CalendarEvent[]      // lejárt nélkül (a lejárt a felső sávban)
  rituals: RitualBand[]
  onEventClick: (e: CalendarEvent) => void
  onCreateSlot: (d: Date, hour: number | null) => void
}

// A napi idővonal órahatárai (6:00 – 23:00)
const START_HOUR = 6
const END_HOUR = 23
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i) // 6..23

function sortByTime(a: CalendarEvent, b: CalendarEvent) {
  return new Date(a.date).getTime() - new Date(b.date).getTime()
}

// HH:mm → óra szám, vagy null ha nincs időpont
function hourOf(e: CalendarEvent): number | null {
  if (!e.time) return null
  const h = parseInt(e.time.slice(0, 2), 10)
  return Number.isFinite(h) ? h : null
}

export default function DayView({ day, events, rituals, onEventClick, onCreateSlot }: Props) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.date), day)).sort(sortByTime)
  const dayRituals = rituals.filter((r) => isSameDay(new Date(r.date), day))

  // Időpont nélküli VAGY a 6:00–24:00 sávon kívüli események a felső sávba
  const untimed = dayEvents.filter((e) => {
    const h = hourOf(e)
    return h === null || h < START_HOUR
  })
  // Órához köthető események óránként csoportosítva
  const byHour = new Map<number, CalendarEvent[]>()
  for (const e of dayEvents) {
    const h = hourOf(e)
    if (h === null || h < START_HOUR || h > END_HOUR) continue
    const arr = byHour.get(h) ?? []
    arr.push(e)
    byHour.set(h, arr)
  }

  const today = isToday(day)
  const nowHour = today ? new Date().getHours() : -1

  return (
    <div className="max-w-2xl">
      {/* Heti ritmus az adott napon */}
      {dayRituals.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 mb-3 flex items-center gap-2">
          <Sparkles size={15} className="text-gray-400 shrink-0" />
          <span className="text-xs font-medium text-gray-500">
            {dayRituals.map((r) => r.title).join(' · ')}
          </span>
        </div>
      )}

      {/* Időpont nélküli tételek */}
      {untimed.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Időpont nélkül</p>
          <div className="space-y-1.5">
            {untimed.map((e) => <EventCard key={e.id} event={e} onClick={onEventClick} />)}
          </div>
        </div>
      )}

      {/* Órabontott idővonal 6:00 – 23:00 — üres sávra kattintva új időpont */}
      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
        {HOURS.map((h) => {
          const hourEvents = (byHour.get(h) ?? []).sort(sortByTime)
          const isNow = h === nowHour
          return (
            <div key={h} onClick={() => onCreateSlot(day, h)} className="flex gap-2 min-h-[3.25rem] cursor-pointer hover:bg-gray-50/60">
              <div className={`w-14 shrink-0 pr-1 pt-1.5 text-right text-xs tabular-nums ${isNow ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                {h}:00
              </div>
              <div className="flex-1 py-1.5 pr-2 space-y-1">
                {isNow && (
                  <div className="flex items-center gap-1 text-[10px] font-medium text-red-500">
                    <Clock size={10} /> most
                  </div>
                )}
                {hourEvents.map((e) => (
                  <div key={e.id} onClick={(ev) => ev.stopPropagation()}>
                    <EventCard event={e} onClick={onEventClick} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
