'use client'

import { format, isSameDay, isToday } from 'date-fns'
import { hu } from 'date-fns/locale'
import type { CalendarEvent, RitualBand } from '@/lib/calendar/types'
import EventCard from './EventCard'

interface Props {
  days: Date[]                 // a hét 7 napja (hétfőtől)
  events: CalendarEvent[]      // lejárt nélkül
  rituals: RitualBand[]
  onEventClick: (e: CalendarEvent) => void
}

function sortByTime(a: CalendarEvent, b: CalendarEvent) {
  return new Date(a.date).getTime() - new Date(b.date).getTime()
}

export default function WeekView({ days, events, rituals, onEventClick }: Props) {
  return (
    // Mobilon 1 oszlop (vertikális napi lista), desktopon 7 oszlop
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map((day) => {
        const dayEvents = events.filter((e) => isSameDay(new Date(e.date), day)).sort(sortByTime)
        const dayRituals = rituals.filter((r) => isSameDay(new Date(r.date), day))
        const today = isToday(day)

        return (
          <div
            key={day.toISOString()}
            className={`rounded-xl border ${today ? 'border-blue-400 bg-blue-50/40' : 'border-gray-200 bg-gray-50/50'} flex flex-col min-h-[7rem]`}
          >
            <div className={`px-2.5 py-1.5 border-b ${today ? 'border-blue-200' : 'border-gray-100'} flex items-center justify-between`}>
              <span className={`text-xs font-semibold uppercase ${today ? 'text-blue-700' : 'text-gray-500'}`}>
                {format(day, 'EEE', { locale: hu })}
              </span>
              <span className={`text-sm font-bold ${today ? 'text-blue-700' : 'text-gray-700'}`}>
                {format(day, 'MMM d.', { locale: hu })}
              </span>
            </div>

            {/* Heti ritmus háttérsáv (nem kártya) */}
            {dayRituals.map((r, i) => (
              <div key={i} className="mx-1.5 mt-1.5 rounded-md bg-gray-100/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                {r.title}
              </div>
            ))}

            <div className="flex-1 p-1.5 space-y-1.5">
              {dayEvents.length === 0 && dayRituals.length === 0 && (
                <p className="text-[11px] text-gray-300 px-1 py-2 text-center">—</p>
              )}
              {dayEvents.map((e) => (
                <EventCard key={e.id} event={e} onClick={onEventClick} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
