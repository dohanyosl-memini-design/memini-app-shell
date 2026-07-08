'use client'

import { isSameDay } from 'date-fns'
import { Sparkles } from 'lucide-react'
import type { CalendarEvent, RitualBand } from '@/lib/calendar/types'
import EventCard from './EventCard'

interface Props {
  day: Date
  events: CalendarEvent[]      // lejárt nélkül (a lejárt a felső sávban)
  rituals: RitualBand[]
  onEventClick: (e: CalendarEvent) => void
}

function sortByTime(a: CalendarEvent, b: CalendarEvent) {
  return new Date(a.date).getTime() - new Date(b.date).getTime()
}

export default function DayView({ day, events, rituals, onEventClick }: Props) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.date), day)).sort(sortByTime)
  const dayRituals = rituals.filter((r) => isSameDay(new Date(r.date), day))

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

      {dayEvents.length === 0 ? (
        <p className="py-12 text-center text-gray-400">Nincs esemény ezen a napon.</p>
      ) : (
        <div className="space-y-2">
          {dayEvents.map((e) => (
            <EventCard key={e.id} event={e} onClick={onEventClick} />
          ))}
        </div>
      )}
    </div>
  )
}
