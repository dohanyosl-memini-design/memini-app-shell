'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Star, CornerDownRight, Hourglass, AlertTriangle, Calendar, CheckSquare, CheckCircle2 } from 'lucide-react'
import { TASK_TYPES } from '@/components/TaskForm'
import { channelInfo } from '@/lib/marketingConstants'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

type Bucket = 'overdue' | 'today' | 'day1' | 'day2' | 'later'
type Kind = 'task' | 'subtask' | 'content' | 'followup'

interface Item {
  kind: Kind
  id: string
  title: string
  date: string | null
  hasTime: boolean
  bucket: Bucket
  focused: boolean
  status: string
  priority?: string
  taskType?: string | null
  channel?: string | null
  href: string
  parentTitle?: string | null
  context?: string | null
  subDone?: number
  subTotal?: number
}

interface FocusResult { generatedAt: string; days: number; today: string; items: Item[] }

const PRIO_DOT: Record<string, string> = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-gray-400' }

function itemIcon(it: Item) {
  if (it.kind === 'subtask') return <CornerDownRight size={14} className="text-gray-400" />
  if (it.kind === 'followup') return <Hourglass size={14} className="text-amber-500" />
  if (it.kind === 'content') return <span className="text-sm">{channelInfo(it.channel || '')?.icon ?? '📄'}</span>
  const t = TASK_TYPES.find(x => x.value === it.taskType)
  return <span className="text-sm">{t?.icon ?? '✓'}</span>
}

function Row({ it, onStar, onToggleSub, onComplete }: { it: Item; onStar: (it: Item) => void; onToggleSub: (id: string) => void; onComplete: (it: Item) => void }) {
  const router = useRouter()
  const time = it.date && it.hasTime ? format(new Date(it.date), 'HH:mm') : null
  return (
    <div
      onClick={() => router.push(it.href)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-gray-100 hover:border-violet-200 hover:shadow-sm cursor-pointer transition-all group"
    >
      {it.kind === 'subtask' ? (
        <button onClick={e => { e.stopPropagation(); onToggleSub(it.id) }} title="Kész" className="shrink-0 text-gray-300 hover:text-green-600">
          <CheckSquare size={16} />
        </button>
      ) : (
        <span className="shrink-0 w-4 flex justify-center">{itemIcon(it)}</span>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {it.priority && it.kind !== 'subtask' && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIO_DOT[it.priority]}`} />}
          <span className="text-sm text-gray-800 truncate">{it.title}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {it.kind === 'subtask' && it.parentTitle && (
            <span className="text-[10px] text-gray-400">előkészítés: {it.parentTitle}</span>
          )}
          {it.kind === 'content' && <span className="text-[10px] text-violet-500">{channelInfo(it.channel || '')?.label} · posztolás</span>}
          {it.context && <span className="text-[10px] text-gray-400 truncate max-w-[220px]">{it.context}</span>}
          {typeof it.subTotal === 'number' && it.subTotal > 0 && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><CheckSquare size={9} />{it.subDone}/{it.subTotal}</span>
          )}
        </div>
      </div>

      {time && <span className="text-xs font-medium text-gray-500 shrink-0">{time}</span>}
      {(it.kind === 'task' || it.kind === 'followup') && (
        <button onClick={e => { e.stopPropagation(); onComplete(it) }} title="Késznek jelöl"
          className="shrink-0 text-gray-300 hover:text-green-600 transition-colors">
          <CheckCircle2 size={17} />
        </button>
      )}
      {it.kind !== 'subtask' && (
        <button onClick={e => { e.stopPropagation(); onStar(it) }} title="Kiemelés"
          className={`shrink-0 transition-colors ${it.focused ? 'text-amber-500' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-amber-500'}`}>
          <Star size={15} fill={it.focused ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  )
}

function Section({ title, icon, items, accent, ...rest }: {
  title: string; icon: React.ReactNode; items: Item[]; accent?: string
  onStar: (it: Item) => void; onToggleSub: (id: string) => void; onComplete: (it: Item) => void
}) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        {icon}
        <h3 className={`text-sm font-semibold ${accent ?? 'text-gray-700'}`}>{title}</h3>
        <span className="text-xs text-gray-400">{items.length}</span>
      </div>
      <div className="space-y-1.5">
        {items.map(it => <Row key={`${it.kind}-${it.id}`} it={it} onStar={rest.onStar} onToggleSub={rest.onToggleSub} onComplete={rest.onComplete} />)}
      </div>
    </div>
  )
}

export default function FocusView() {
  const [data, setData] = useState<FocusResult | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/focus?days=3')
    setData(await res.json())
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function onStar(it: Item) {
    if (it.kind === 'content') {
      await fetch(`/api/marketing/pieces/${it.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ focused: !it.focused }) })
    } else {
      await fetch(`/api/tasks/${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ focused: !it.focused }) })
    }
    load()
  }
  async function onToggleSub(id: string) {
    await fetch(`/api/subtasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: true }) })
    load()
  }
  async function onComplete(it: Item) {
    await fetch(`/api/tasks/${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) })
    load()
  }

  if (loading) return <div className="py-24 text-center text-gray-400">Betöltés...</div>
  if (!data) return null

  const items = data.items
  const focused = items.filter(i => i.focused)
  const byBucket = (b: Bucket) => items.filter(i => i.bucket === b && !i.focused)

  const today = new Date(`${data.today}T12:00:00`)
  const dayLabel = (offset: number) => {
    const d = new Date(today.getTime() + offset * 86400000)
    return format(d, 'MM. dd. (EEEE)', { locale: hu })
  }

  const empty = items.length === 0

  return (
    <div className="max-w-3xl space-y-6">
      {empty ? (
        <div className="py-16 text-center">
          <Calendar size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 mb-1">A következő 3 napra nincs időzített tennivaló.</p>
          <p className="text-xs text-gray-400">Adj határidőt feladatoknak/alfeladatoknak, ütemezz marketing-posztot, vagy emelj ki (★) valamit.</p>
        </div>
      ) : (
        <>
          <Section title="Kiemelt" icon={<Star size={15} className="text-amber-500" fill="currentColor" />} items={focused} accent="text-amber-600" onStar={onStar} onToggleSub={onToggleSub} onComplete={onComplete} />
          <Section title="Lejárt" icon={<AlertTriangle size={15} className="text-red-500" />} items={byBucket('overdue')} accent="text-red-600" onStar={onStar} onToggleSub={onToggleSub} onComplete={onComplete} />
          <Section title={`Ma · ${dayLabel(0)}`} icon={<span className="w-2 h-2 rounded-full bg-violet-500" />} items={byBucket('today')} onStar={onStar} onToggleSub={onToggleSub} onComplete={onComplete} />
          <Section title={`Holnap · ${dayLabel(1)}`} icon={<span className="w-2 h-2 rounded-full bg-blue-400" />} items={byBucket('day1')} onStar={onStar} onToggleSub={onToggleSub} onComplete={onComplete} />
          <Section title={`Holnapután · ${dayLabel(2)}`} icon={<span className="w-2 h-2 rounded-full bg-gray-300" />} items={byBucket('day2')} onStar={onStar} onToggleSub={onToggleSub} onComplete={onComplete} />
        </>
      )}
    </div>
  )
}
