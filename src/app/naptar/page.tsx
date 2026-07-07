'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  startOfWeek, endOfWeek, addWeeks, addDays, startOfDay, endOfDay,
  eachDayOfInterval, format,
} from 'date-fns'
import { hu } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, List, Columns3, AlertTriangle } from 'lucide-react'
import type { CalendarEvent, CalendarPayload } from '@/lib/calendar/types'
import { SOURCE_META } from '@/lib/calendar/types'
import WeekView from '@/components/calendar/WeekView'
import ListView from '@/components/calendar/ListView'
import EventCard from '@/components/calendar/EventCard'
import EventDrawer from '@/components/calendar/EventDrawer'

type ViewMode = 'week' | 'list'

export default function NaptarPage() {
  const [view, setView] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [payload, setPayload] = useState<CalendarPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  // Az aktuális nézet dátumtartománya
  const range = useMemo(() => {
    if (view === 'week') {
      return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) }
    }
    const from = startOfDay(new Date())
    return { from, to: endOfDay(addDays(from, 13)) }
  }, [view, anchor])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      from: format(range.from, 'yyyy-MM-dd'),
      to: format(range.to, 'yyyy-MM-dd'),
    })
    const res = await fetch(`/api/calendar?${params}`)
    setPayload(await res.json())
    setLoading(false)
  }, [range.from, range.to])

  useEffect(() => { fetchData() }, [fetchData])

  const events = payload?.events ?? []
  const rituals = payload?.rituals ?? []
  const overdue = events.filter((e) => e.status === 'overdue').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const rest = events.filter((e) => e.status !== 'overdue')
  const weekDays = eachDayOfInterval({ start: range.from, end: range.to }).slice(0, 7)

  const rangeLabel = view === 'week'
    ? `${format(range.from, 'MMM d.', { locale: hu })} – ${format(range.to, 'MMM d.', { locale: hu })}`
    : `Következő 14 nap`

  return (
    <div className="p-4 md:p-6">
      {/* Fejléc */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays size={22} className="text-blue-600" /> Naptár
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">{rangeLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {view === 'week' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setAnchor((d) => addWeeks(d, -1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ChevronLeft size={18} /></button>
              <button onClick={() => setAnchor(new Date())} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">Ma</button>
              <button onClick={() => setAnchor((d) => addWeeks(d, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ChevronRight size={18} /></button>
            </div>
          )}

          {/* Nézetváltó */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${view === 'week' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Columns3 size={15} /> Hét
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <List size={15} /> Lista
            </button>
          </div>
        </div>
      </div>

      {/* Forrás-jelmagyarázat */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-xs text-gray-500">
        {(['task', 'followup', 'reorder', 'activity'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${SOURCE_META[s].dot}`} /> {SOURCE_META[s].label}
          </span>
        ))}
      </div>

      {/* Lejárt sáv */}
      {overdue.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 mb-4">
          <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-red-700">
            <AlertTriangle size={16} /> Lejárt / esedékes ({overdue.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {overdue.map((e) => <EventCard key={e.id} event={e} onClick={setSelected} />)}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Betöltés...</div>
      ) : view === 'week' ? (
        <WeekView days={weekDays} events={rest} rituals={rituals} onEventClick={setSelected} />
      ) : (
        <ListView from={range.from} to={range.to} events={rest} rituals={rituals} onEventClick={setSelected} />
      )}

      <EventDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
