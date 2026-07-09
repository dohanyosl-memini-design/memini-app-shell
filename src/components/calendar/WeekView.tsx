'use client'

import { format, isSameDay, isToday } from 'date-fns'
import { hu } from 'date-fns/locale'
import type { CalendarEvent, RitualBand } from '@/lib/calendar/types'
import { SOURCE_META } from '@/lib/calendar/types'

interface Props {
  days: Date[]                 // a hét 7 napja (hétfőtől)
  events: CalendarEvent[]      // minden esemény (egész napos + időzített)
  rituals: RitualBand[]
  onEventClick: (e: CalendarEvent) => void
  onOpenDay: (d: Date) => void
  onCreateSlot: (d: Date, hour: number | null) => void
}

const START_HOUR = 6
const END_HOUR = 23
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i) // 6..23

function hourOf(e: CalendarEvent): number | null {
  if (!e.time) return null
  const h = parseInt(e.time.slice(0, 2), 10)
  return Number.isFinite(h) ? h : null
}
function sortByTime(a: CalendarEvent, b: CalendarEvent) {
  return new Date(a.date).getTime() - new Date(b.date).getTime()
}

function Chip({ e, onClick }: { e: CalendarEvent; onClick: (e: CalendarEvent) => void }) {
  const m = SOURCE_META[e.source]
  return (
    <button
      onClick={(ev) => { ev.stopPropagation(); onClick(e) }}
      className={`w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate ${m.badge} ${e.status === 'overdue' ? 'ring-1 ring-red-300' : ''}`}
      title={e.title}
    >
      {e.time && <span className="font-semibold mr-0.5">{e.time}</span>}{e.title}
    </button>
  )
}

export default function WeekView({ days, events, rituals, onEventClick, onOpenDay, onCreateSlot }: Props) {
  const nowHour = new Date().getHours()

  // Csoportosítás: egész napos (idő nélküli / 6:00 előtti) és (nap, óra) szerint
  const allDayByDay = new Map<string, CalendarEvent[]>()
  const byDayHour = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const key = format(new Date(e.date), 'yyyy-MM-dd')
    const h = hourOf(e)
    if (h === null || h < START_HOUR || h > END_HOUR) {
      const arr = allDayByDay.get(key) ?? []; arr.push(e); allDayByDay.set(key, arr)
    } else {
      const k = `${key}-${h}`; const arr = byDayHour.get(k) ?? []; arr.push(e); byDayHour.set(k, arr)
    }
  }

  const cols = { gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(8.5rem, 1fr))` }

  return (
    <div className="overflow-auto max-h-[74vh] rounded-xl border border-gray-200 bg-white">
      <div className="grid" style={cols}>
        {/* Fejléc: sarok + napok */}
        <div className="sticky top-0 left-0 z-30 bg-white border-b border-r border-gray-100" />
        {days.map((d) => {
          const today = isToday(d)
          return (
            <button
              key={`h-${d.toISOString()}`}
              onClick={() => onOpenDay(d)}
              className={`sticky top-0 z-20 bg-white border-b border-gray-100 px-1 py-1.5 text-center ${today ? 'text-blue-700' : 'text-gray-600'}`}
            >
              <div className="text-[10px] font-semibold uppercase">{format(d, 'EEE', { locale: hu })}</div>
              <div className={`text-sm font-bold ${today ? 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white' : ''}`}>
                {format(d, 'd')}
              </div>
            </button>
          )
        })}

        {/* Egész napos sáv */}
        <div className="sticky left-0 z-10 bg-white border-b border-r border-gray-100 px-1 py-1 text-[9px] font-medium uppercase text-gray-400 flex items-center">
          egész napos
        </div>
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd')
          const list = (allDayByDay.get(key) ?? []).sort(sortByTime)
          const dayRituals = rituals.filter((r) => isSameDay(new Date(r.date), d))
          return (
            <div key={`ad-${d.toISOString()}`} onClick={() => onCreateSlot(d, null)} className={`border-b border-l border-gray-100 p-0.5 space-y-0.5 min-h-[2rem] cursor-pointer ${isToday(d) ? 'bg-blue-50/40' : ''}`}>
              {dayRituals.map((r, i) => (
                <div key={i} className="rounded bg-gray-100 px-1 py-0.5 text-[9px] font-medium uppercase text-gray-400 truncate">{r.title}</div>
              ))}
              {list.map((e) => <Chip key={e.id} e={e} onClick={onEventClick} />)}
            </div>
          )
        })}

        {/* Órarács */}
        {HOURS.map((h) => (
          <div key={`hour-${h}`} className="contents">
            <div className={`sticky left-0 z-10 bg-white border-r border-gray-100 pr-1 pt-0.5 text-right text-[10px] tabular-nums ${h === nowHour ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
              {h}:00
            </div>
            {days.map((d) => {
              const list = (byDayHour.get(`${format(d, 'yyyy-MM-dd')}-${h}`) ?? []).sort(sortByTime)
              const today = isToday(d)
              return (
                <div
                  key={`c-${d.toISOString()}-${h}`}
                  onClick={() => onCreateSlot(d, h)}
                  className={`border-b border-l border-gray-100 p-0.5 space-y-0.5 min-h-[2.75rem] cursor-pointer ${today ? 'bg-blue-50/40' : ''} ${today && h === nowHour ? 'border-t-2 border-t-red-400' : ''}`}
                >
                  {list.map((e) => <Chip key={e.id} e={e} onClick={onEventClick} />)}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
