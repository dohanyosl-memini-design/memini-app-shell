'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import Modal from '@/components/Modal'
import PieceForm from '@/components/marketing/PieceForm'
import { channelInfo, CHANNELS } from '@/lib/marketingConstants'

interface CalPiece { id: string; title: string; channel: string; status: string; scheduledFor: string | null }

const WEEKDAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function MarketingCalendar() {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed
  const [pieces, setPieces] = useState<CalPiece[]>([])
  const [addDate, setAddDate] = useState<string | null>(null)

  const load = useCallback(async () => {
    const from = ymd(new Date(year, month, 1))
    const to = ymd(new Date(year, month + 1, 0))
    const data = await (await fetch(`/api/marketing/pieces?from=${from}&to=${to}`)).json()
    setPieces(data)
  }, [year, month])

  useEffect(() => { load() }, [load])

  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7 // hétfő = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const byDay: Record<string, CalPiece[]> = {}
  for (const p of pieces) {
    if (!p.scheduledFor) continue
    const key = p.scheduledFor.slice(0, 10)
    ;(byDay[key] ??= []).push(p)
  }

  function prev() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function next() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const todayKey = ymd(now)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">{year}. {MONTHS[month]}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">Ma</button>
          <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={16} /></button>
          <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Csatorna-jelmagyarázat */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        {CHANNELS.map(c => <span key={c.key} className="flex items-center gap-1 text-[10px] text-gray-400"><span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.label}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(w => <div key={w} className="text-center text-[11px] font-medium text-gray-400 py-1">{w}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="min-h-[92px] rounded-lg bg-gray-50/50" />
          const key = ymd(new Date(year, month, d))
          const dayPieces = byDay[key] ?? []
          const isToday = key === todayKey
          return (
            <div key={i} className={`min-h-[92px] rounded-lg border p-1 group relative ${isToday ? 'border-violet-300 bg-violet-50/40' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-center justify-between px-0.5">
                <span className={`text-[11px] ${isToday ? 'font-bold text-violet-600' : 'text-gray-400'}`}>{d}</span>
                <button onClick={() => setAddDate(key)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-violet-600 transition-opacity"><Plus size={12} /></button>
              </div>
              <div className="space-y-0.5 mt-0.5">
                {dayPieces.slice(0, 4).map(p => {
                  const ci = channelInfo(p.channel)
                  return (
                    <button key={p.id} onClick={() => router.push(`/marketing/piece/${p.id}`)}
                      className={`w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded border truncate ${ci?.color ?? 'bg-gray-100'} ${p.status === 'published' ? 'opacity-60' : ''}`}
                      title={p.title}>
                      {ci?.icon} {p.title}
                    </button>
                  )
                })}
                {dayPieces.length > 4 && <span className="text-[9px] text-gray-400 px-1">+{dayPieces.length - 4} további</span>}
              </div>
            </div>
          )
        })}
      </div>

      {addDate && (
        <Modal title={`Új tartalom — ${addDate}`} onClose={() => setAddDate(null)} size="lg">
          <PieceForm defaultDate={addDate} onSave={(newId) => { setAddDate(null); router.push(`/marketing/piece/${newId}`) }} onCancel={() => setAddDate(null)} />
        </Modal>
      )}
    </div>
  )
}
