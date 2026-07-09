'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  startOfWeek, endOfWeek, addWeeks, addDays, addMonths,
  startOfMonth, endOfMonth, startOfDay, endOfDay,
  eachDayOfInterval, format,
} from 'date-fns'
import { hu } from 'date-fns/locale'
import { CalendarDays, CalendarClock, ChevronLeft, ChevronRight, List, Columns3, Grid3x3, AlertTriangle, Plus } from 'lucide-react'
import type { CalendarEvent, CalendarPayload } from '@/lib/calendar/types'
import { SOURCE_META } from '@/lib/calendar/types'
import DayView from '@/components/calendar/DayView'
import WeekView from '@/components/calendar/WeekView'
import MonthView from '@/components/calendar/MonthView'
import ListView from '@/components/calendar/ListView'
import EventCard from '@/components/calendar/EventCard'
import EventDrawer from '@/components/calendar/EventDrawer'
import CalendarCreateModal, { type CreateInitial } from '@/components/calendar/CalendarCreateModal'

type ViewMode = 'day' | 'week' | 'month' | 'list'

export default function NaptarPage() {
  const [view, setView] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [payload, setPayload] = useState<CalendarPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [createInit, setCreateInit] = useState<CreateInitial | null>(null)

  // Az aktuális nézet dátumtartománya
  const range = useMemo(() => {
    if (view === 'day') {
      return { from: startOfDay(anchor), to: endOfDay(anchor) }
    }
    if (view === 'week') {
      return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) }
    }
    if (view === 'month') {
      // A teljes hónap-rács (a szélein átnyúló hetekkel együtt)
      return { from: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }), to: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }) }
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

  function goToday() {
    setAnchor(new Date())
  }
  function stepPrev() {
    setAnchor((d) => (view === 'month' ? addMonths(d, -1) : view === 'day' ? addDays(d, -1) : addWeeks(d, -1)))
  }
  function stepNext() {
    setAnchor((d) => (view === 'month' ? addMonths(d, 1) : view === 'day' ? addDays(d, 1) : addWeeks(d, 1)))
  }
  // Napra kattintva (hét/hónap nézetből) → napi nézet
  function openDay(d: Date) {
    setAnchor(d)
    setView('day')
  }
  // Üres idősávra kattintva / "+ Új" → létrehozó modal (előtöltött nap + óra)
  function openCreate(d: Date, hour: number | null) {
    setCreateInit({
      date: format(d, 'yyyy-MM-dd'),
      time: hour != null ? `${String(hour).padStart(2, '0')}:00` : '',
      kind: hour != null ? 'appointment' : 'task',
    })
  }

  const events = payload?.events ?? []
  const rituals = payload?.rituals ?? []
  const overdue = events.filter((e) => e.status === 'overdue').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const rest = events.filter((e) => e.status !== 'overdue')
  const weekDays = eachDayOfInterval({ start: range.from, end: range.to }).slice(0, 7)

  const rangeLabel = view === 'day'
    ? format(anchor, 'yyyy. MMMM d., EEEE', { locale: hu })
    : view === 'week'
      ? `${format(range.from, 'MMM d.', { locale: hu })} – ${format(range.to, 'MMM d.', { locale: hu })}`
      : view === 'month'
        ? format(anchor, 'yyyy. MMMM', { locale: hu })
        : 'Következő 14 nap'

  return (
    <div className="p-4 md:p-6">
      {/* Fejléc */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays size={22} className="text-blue-600" /> Naptár
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm capitalize">{rangeLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openCreate(anchor, null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Új</span>
          </button>
          {view !== 'list' && (
            <div className="flex items-center gap-1">
              <button onClick={stepPrev} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ChevronLeft size={18} /></button>
              <button onClick={goToday} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">Ma</button>
              <button onClick={stepNext} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ChevronRight size={18} /></button>
            </div>
          )}

          {/* Nézetváltó */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${view === 'day' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <CalendarClock size={15} /> <span className="hidden sm:inline">Nap</span>
            </button>
            <button
              onClick={() => setView('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-l border-gray-200 ${view === 'week' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Columns3 size={15} /> <span className="hidden sm:inline">Hét</span>
            </button>
            <button
              onClick={() => setView('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-l border-gray-200 ${view === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Grid3x3 size={15} /> <span className="hidden sm:inline">Hónap</span>
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-l border-gray-200 ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <List size={15} /> <span className="hidden sm:inline">Lista</span>
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
      ) : view === 'day' ? (
        <DayView day={anchor} events={events} rituals={rituals} onEventClick={setSelected} onCreateSlot={openCreate} />
      ) : view === 'week' ? (
        <WeekView days={weekDays} events={events} rituals={rituals} onEventClick={setSelected} onOpenDay={openDay} onCreateSlot={openCreate} />
      ) : view === 'month' ? (
        <MonthView monthAnchor={anchor} events={events} rituals={rituals} onOpenDay={openDay} />
      ) : (
        <ListView from={range.from} to={range.to} events={rest} rituals={rituals} onEventClick={setSelected} />
      )}

      <EventDrawer event={selected} onClose={() => setSelected(null)} />

      {createInit && (
        <CalendarCreateModal
          initial={createInit}
          onClose={() => setCreateInit(null)}
          onSaved={() => { setCreateInit(null); fetchData() }}
        />
      )}
    </div>
  )
}
