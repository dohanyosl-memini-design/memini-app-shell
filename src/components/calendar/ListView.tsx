'use client'

import { format, isSameDay, isToday, eachDayOfInterval } from 'date-fns'
import { hu } from 'date-fns/locale'
import type { CalendarEvent, RitualBand } from '@/lib/calendar/types'
import EventCard from './EventCard'

interface Props {
  from: Date
  to: Date
  events: CalendarEvent[]      // lejárt nélkül
  rituals: RitualBand[]
  onEventClick: (e: CalendarEvent) => void
}

function sortByTime(a: CalendarEvent, b: CalendarEvent) {
  return new Date(a.date).getTime() - new Date(b.date).getTime()
}

export default function ListView({ from, to, events, rituals, onEventClick }: Props) {
  const days = eachDayOfInterval({ start: from, end: to })

  // Csak azok a napok, ahol van esemény vagy ritmus
  const rows = days
    .map((day) => ({
      day,
      dayEvents: events.filter((e) => isSameDay(new Date(e.date), day)).sort(sortByTime),
      dayRituals: rituals.filter((r) => isSameDay(new Date(r.date), day)),
    }))
    .filter((r) => r.dayEvents.length > 0 || r.dayRituals.length > 0)

  if (rows.length === 0) {
    return <p className="py-12 text-center text-gray-400">Nincs esemény a következő 14 napban.</p>
  }

  return (
    <div className="space-y-4">
      {rows.map(({ day, dayEvents, dayRituals }) => {
        const today = isToday(day)
        return (
          <div key={day.toISOString()}>
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className={`text-sm font-bold ${today ? 'text-blue-700' : 'text-gray-700'}`}>
                {format(day, 'EEEE, MMM d.', { locale: hu })}
              </h3>
              {today && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">MA</span>}
              {dayRituals.map((r, i) => (
                <span key={i} className="text-[10px] font-medium uppercase tracking-wide text-gray-400">· {r.title}</span>
              ))}
            </div>
            <div className="space-y-1.5">
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
