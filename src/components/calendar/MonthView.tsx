'use client'

import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, format,
} from 'date-fns'
import { hu } from 'date-fns/locale'
import type { CalendarEvent, RitualBand } from '@/lib/calendar/types'
import { SOURCE_META } from '@/lib/calendar/types'

interface Props {
  monthAnchor: Date            // a megjelenített hónap egy napja
  events: CalendarEvent[]      // minden esemény (a rács pöttyeihez)
  rituals: RitualBand[]
  onOpenDay: (d: Date) => void // napra kattintva → napi nézet
}

const MAX_DOTS = 4

function sortByTime(a: CalendarEvent, b: CalendarEvent) {
  return new Date(a.date).getTime() - new Date(b.date).getTime()
}

export default function MonthView({ monthAnchor, events, rituals, onOpenDay }: Props) {
  const gridStart = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weekdayLabels = days.slice(0, 7)

  return (
    <div>
      {/* Hét napjai fejléc */}
      <div className="grid grid-cols-7 mb-1">
        {weekdayLabels.map((d) => (
          <div key={d.toISOString()} className="text-center text-[11px] font-semibold uppercase text-gray-400 py-1">
            {format(d, 'EEEEEE', { locale: hu })}
          </div>
        ))}
      </div>

      {/* Hónap-rács — az egész hónap egy képernyőn, napra kattintva napi nézet */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, monthAnchor)
          const today = isToday(day)
          const dayEvents = events.filter((e) => isSameDay(new Date(e.date), day)).sort(sortByTime)
          const dayRituals = rituals.filter((r) => isSameDay(new Date(r.date), day))
          const shown = dayEvents.slice(0, MAX_DOTS)
          const extra = dayEvents.length - shown.length

          return (
            <button
              key={day.toISOString()}
              onClick={() => onOpenDay(day)}
              className={`aspect-square md:aspect-auto md:min-h-[4.5rem] rounded-lg border p-1 flex flex-col items-center md:items-stretch text-center transition-colors
                ${today ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white hover:bg-blue-50/40'}
                ${inMonth ? '' : 'opacity-40'}`}
            >
              <span className={`text-xs font-semibold leading-none mt-0.5 mb-1
                ${today ? 'flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white mx-auto' : inMonth ? 'text-gray-700' : 'text-gray-400'}`}>
                {format(day, 'd')}
              </span>

              {/* Esemény-pöttyök */}
              <span className="flex flex-wrap justify-center md:justify-start gap-0.5 px-0.5">
                {shown.map((e) => (
                  <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${SOURCE_META[e.source].dot}`} />
                ))}
                {extra > 0 && <span className="text-[9px] leading-none text-gray-400 font-medium">+{extra}</span>}
              </span>

              {/* Ritmus-jelölés (desktopon, halványan) */}
              {dayRituals.length > 0 && (
                <span className="hidden md:block mt-auto text-[9px] text-gray-300 truncate w-full text-left px-0.5">
                  {dayRituals[0].title}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <p className="mt-2 text-center text-[11px] text-gray-400">Kattints egy napra a napi nézethez</p>
    </div>
  )
}
