'use client'

import { useState, useEffect } from 'react'
import { ARC_LEVELS, ARC_LEVEL_LABELS, CHANNELS, STRATEGIC_AREAS, arcPeriodLabel } from '@/lib/marketingConstants'

interface ArcOption { id: string; title: string; level: string; year: number | null; quarter: number | null; month: number | null }
interface GoalOption { id: string; title: string; level: string }

interface ArcData {
  id: string
  title: string
  description: string | null
  level: string
  year: number | null
  quarter: number | null
  month: number | null
  status: string
  strategicArea: string | null
  cadence: Record<string, number> | null
  goalId: string | null
  parentId: string | null
}

interface ArcFormProps {
  arc: ArcData | null
  defaultLevel?: string
  defaultParentId?: string
  onSave: () => void
  onCancel: () => void
}

const PARENT_LEVEL: Record<string, string | null> = { vision: null, yearly: 'vision', quarterly: 'yearly', monthly: 'quarterly' }
const MONTH_NAMES = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']

export default function ArcForm({ arc, defaultLevel = 'vision', defaultParentId, onSave, onCancel }: ArcFormProps) {
  const now = new Date()
  const [arcs, setArcs] = useState<ArcOption[]>([])
  const [goals, setGoals] = useState<GoalOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: arc?.title || '',
    description: arc?.description || '',
    level: arc?.level || defaultLevel,
    year: arc?.year ?? now.getFullYear(),
    quarter: arc?.quarter ?? Math.floor(now.getMonth() / 3) + 1,
    month: arc?.month ?? now.getMonth() + 1,
    status: arc?.status || 'active',
    strategicArea: arc?.strategicArea || 'Márka és marketing',
    goalId: arc?.goalId || '',
  })
  const [cadence, setCadence] = useState<Record<string, number>>(arc?.cadence || {})

  useEffect(() => {
    fetch('/api/marketing/arcs').then(r => r.json()).then(setArcs)
    fetch('/api/goals?status=active').then(r => r.json()).then((g) => setGoals(g.filter((x: GoalOption) => x.level === 'yearly' || x.level === 'vision')))
  }, [])

  const parentLevel = PARENT_LEVEL[form.level]
  const parentOptions = arcs.filter(a => a.level === parentLevel && a.id !== arc?.id)
  const showCadence = form.level === 'monthly' || form.level === 'quarterly'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const cadenceClean = Object.fromEntries(Object.entries(cadence).filter(([, v]) => v > 0))
    const payload = {
      title: form.title,
      description: form.description,
      level: form.level,
      year: form.level === 'vision' ? null : Number(form.year),
      quarter: form.level === 'quarterly' ? Number(form.quarter) : null,
      month: form.level === 'monthly' ? Number(form.month) : null,
      status: form.status,
      strategicArea: form.strategicArea || null,
      goalId: form.goalId || null,
      cadence: Object.keys(cadenceClean).length ? cadenceClean : null,
      parentId: (arc?.parentId ?? defaultParentId ?? '') || null,
    }
    const res = await fetch(arc ? `/api/marketing/arcs/${arc.id}` : '/api/marketing/arcs', {
      method: arc ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(arc ? payload : { ...payload, parentId: defaultParentId || null }),
    })
    setLoading(false)
    if (!res.ok) { setError((await res.json().catch(() => null))?.error || 'Mentés sikertelen.'); return }
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!arc && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Szint</label>
          <div className="grid grid-cols-4 gap-1.5">
            {ARC_LEVELS.map(l => (
              <button key={l} type="button" onClick={() => setForm({ ...form, level: l })}
                className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${form.level === l ? 'bg-violet-100 text-violet-700 border-violet-300 ring-2 ring-offset-1 ring-violet-300' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {ARC_LEVEL_LABELS[l]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Megnevezés *</label>
        <input required type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          placeholder={form.level === 'vision' ? 'pl. Márkaépítés a német dóm-szegmensben' : 'pl. Nyári turistaszezon tartalmi ív'}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Leírás</label>
        <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y text-sm" />
      </div>

      {form.level !== 'vision' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Év *</label>
            <input required type="number" min={2020} max={2040} value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
          </div>
          {form.level === 'quarterly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Negyedév *</label>
              <select value={form.quarter} onChange={e => setForm({ ...form, quarter: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm">
                {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
              </select>
            </div>
          )}
          {form.level === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hónap *</label>
              <select value={form.month} onChange={e => setForm({ ...form, month: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm">
                {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {parentLevel && !arc && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Szülő ({ARC_LEVEL_LABELS[parentLevel]})</label>
          <select value={defaultParentId || ''} disabled={!!defaultParentId}
            onChange={() => {}}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 disabled:text-gray-500">
            <option value="">— önálló —</option>
            {parentOptions.map(a => <option key={a.id} value={a.id}>{arcPeriodLabel(a) ? `[${arcPeriodLabel(a)}] ` : ''}{a.title}</option>)}
          </select>
        </div>
      )}

      {showCadence && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
          <p className="text-xs text-violet-700 mb-2">Heti kadencia — hány tartalom csatornánként hetente. Ebből számítódik a telítettség.</p>
          <div className="grid grid-cols-3 gap-2">
            {CHANNELS.map(c => (
              <div key={c.key}>
                <label className="block text-[11px] text-gray-500 mb-0.5">{c.icon} {c.label}</label>
                <input type="number" min={0} value={cadence[c.key] ?? ''} placeholder="0"
                  onChange={e => setCadence({ ...cadence, [c.key]: Number(e.target.value) })}
                  className="w-full px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stratégiai terület</label>
          <select value={form.strategicArea} onChange={e => setForm({ ...form, strategicArea: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm">
            <option value="">—</option>
            {STRATEGIC_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Üzleti cél (opc.)</label>
          <select value={form.goalId} onChange={e => setForm({ ...form, goalId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm">
            <option value="">—</option>
            {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </div>
      </div>

      {arc && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Státusz</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm">
            <option value="active">Aktív</option>
            <option value="achieved">Teljesült</option>
            <option value="missed">Nem teljesült</option>
            <option value="dropped">Elvetve</option>
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">Mégse</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm">
          {loading ? 'Mentés...' : arc ? 'Módosítás' : 'Ív létrehozása'}
        </button>
      </div>
    </form>
  )
}
