'use client'

import { useState, useEffect } from 'react'
import { GOAL_LEVELS, GOAL_LEVEL_LABELS, GOAL_METRICS, STRATEGIC_AREAS, goalPeriodLabel } from '@/lib/goalConstants'

interface GoalOption {
  id: string
  title: string
  level: string
  year: number | null
  quarter: number | null
  month: number | null
}

interface GoalData {
  id: string
  title: string
  description: string | null
  level: string
  year: number | null
  quarter: number | null
  month: number | null
  status: string
  strategicArea: string | null
  metricKey: string | null
  targetValue: number | null
  parentId: string | null
}

interface GoalFormProps {
  goal: GoalData | null
  defaultLevel?: string
  defaultParentId?: string
  onSave: () => void
  onCancel: () => void
}

const PARENT_LEVEL: Record<string, string | null> = {
  vision: null,
  yearly: 'vision',
  quarterly: 'yearly',
  monthly: 'quarterly',
}

const MONTH_NAMES = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']

export default function GoalForm({ goal, defaultLevel = 'vision', defaultParentId, onSave, onCancel }: GoalFormProps) {
  const now = new Date()
  const [allGoals, setAllGoals] = useState<GoalOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    level: goal?.level || defaultLevel,
    year: goal?.year ?? now.getFullYear(),
    quarter: goal?.quarter ?? Math.floor(now.getMonth() / 3) + 1,
    month: goal?.month ?? now.getMonth() + 1,
    status: goal?.status || 'active',
    strategicArea: goal?.strategicArea || '',
    metricKey: goal?.metricKey || '',
    targetValue: goal?.targetValue != null ? String(goal.targetValue) : '',
    parentId: goal?.parentId || defaultParentId || '',
  })

  useEffect(() => {
    fetch('/api/goals').then(r => r.json()).then(setAllGoals)
  }, [])

  const parentLevel = PARENT_LEVEL[form.level]
  const parentOptions = allGoals.filter(g => g.level === parentLevel && g.id !== goal?.id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      title: form.title,
      description: form.description,
      level: form.level,
      year: form.level === 'vision' ? null : Number(form.year),
      quarter: form.level === 'quarterly' ? Number(form.quarter) : null,
      month: form.level === 'monthly' ? Number(form.month) : null,
      status: form.status,
      strategicArea: form.strategicArea || null,
      metricKey: form.metricKey || null,
      targetValue: form.targetValue !== '' ? Number(form.targetValue) : null,
      parentId: form.parentId || null,
    }

    const res = await fetch(goal ? `/api/goals/${goal.id}` : '/api/goals', {
      method: goal ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error || 'Mentés sikertelen.')
      return
    }
    onSave()
  }

  const selectedMetric = GOAL_METRICS.find(m => m.key === form.metricKey)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Szint */}
      {!goal && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Cél szintje</label>
          <div className="grid grid-cols-4 gap-1.5">
            {GOAL_LEVELS.map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setForm({ ...form, level: l, parentId: '' })}
                className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  form.level === l
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-300 ring-2 ring-offset-1 ring-indigo-300'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {GOAL_LEVEL_LABELS[l]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cím */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cél megnevezése *</label>
        <input
          required
          type="text"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          placeholder={form.level === 'vision' ? 'pl. 5 éven belül 200 aktív német partner' : 'pl. Q3: dóm-szegmens outreach kampány'}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Leírás */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Leírás</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          placeholder="Mit jelent pontosan a cél? Mikor tekintjük teljesültnek?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y text-sm"
        />
      </div>

      {/* Időszak */}
      {form.level !== 'vision' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Év *</label>
            <input
              required
              type="number"
              min={2020}
              max={2040}
              value={form.year}
              onChange={e => setForm({ ...form, year: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          {form.level === 'quarterly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Negyedév *</label>
              <select
                value={form.quarter}
                onChange={e => setForm({ ...form, quarter: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
              </select>
            </div>
          )}
          {form.level === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hónap *</label>
              <select
                value={form.month}
                onChange={e => setForm({ ...form, month: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Szülő cél */}
      {parentLevel && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Szülő cél ({GOAL_LEVEL_LABELS[parentLevel]})
          </label>
          <select
            value={form.parentId}
            onChange={e => setForm({ ...form, parentId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="">— nincs (önálló cél) —</option>
            {parentOptions.map(g => (
              <option key={g.id} value={g.id}>
                {goalPeriodLabel(g) ? `[${goalPeriodLabel(g)}] ` : ''}{g.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stratégiai terület */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Stratégiai terület</label>
        <select
          value={form.strategicArea}
          onChange={e => setForm({ ...form, strategicArea: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        >
          <option value="">—</option>
          {STRATEGIC_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Metrika-kötés */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-3">
        <p className="text-xs text-indigo-700">
          Ha a cél számszerű, kösd egy CRM-mutatóhoz — a tényérték automatikusan a
          tölcsér-adatokból számítódik, nem kell kézzel frissíteni.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mutató</label>
            <select
              value={form.metricKey}
              onChange={e => setForm({ ...form, metricKey: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
            >
              <option value="">— kézi / feladat-alapú —</option>
              {GOAL_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Célérték {selectedMetric ? `(${selectedMetric.unit})` : ''}
            </label>
            <input
              type="number"
              step="any"
              min={0}
              value={form.targetValue}
              onChange={e => setForm({ ...form, targetValue: e.target.value })}
              disabled={!form.metricKey}
              placeholder={form.metricKey ? 'pl. 30' : '—'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Státusz (csak szerkesztésnél) */}
      {goal && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Státusz</label>
          <select
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="active">Aktív</option>
            <option value="achieved">Teljesült</option>
            <option value="missed">Nem teljesült</option>
            <option value="dropped">Elvetve</option>
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm">
          Mégse
        </button>
        <button type="submit" disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm">
          {loading ? 'Mentés...' : goal ? 'Módosítás' : 'Cél létrehozása'}
        </button>
      </div>
    </form>
  )
}
