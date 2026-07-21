'use client'

import { useState, useEffect } from 'react'
import { CHANNELS } from '@/lib/marketingConstants'

interface ThemeOption { id: string; title: string }

interface PieceFormProps {
  defaultThemeId?: string
  defaultArcId?: string
  defaultChannel?: string
  defaultDate?: string
  parentPieceId?: string
  onSave: (createdId: string) => void
  onCancel: () => void
}

export default function PieceForm({ defaultThemeId, defaultArcId, defaultChannel, defaultDate, parentPieceId, onSave, onCancel }: PieceFormProps) {
  const [themes, setThemes] = useState<ThemeOption[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    channel: defaultChannel || 'blog',
    themeId: defaultThemeId || '',
    scheduledFor: defaultDate || '',
  })

  useEffect(() => {
    fetch('/api/marketing/themes').then(r => r.json()).then(setThemes)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/marketing/pieces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        channel: form.channel,
        themeId: form.themeId || null,
        arcId: defaultArcId || null,
        parentPieceId: parentPieceId || null,
        scheduledFor: form.scheduledFor || null,
        status: form.scheduledFor ? 'scheduled' : 'draft',
      }),
    })
    setLoading(false)
    if (res.ok) { const p = await res.json(); onSave(p.id) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cím *</label>
        <input required type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          placeholder="pl. 5 részlet az ulmi dómról, amit a turisták nem vesznek észre"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Csatorna</label>
        <div className="grid grid-cols-3 gap-1.5">
          {CHANNELS.map(c => (
            <button key={c.key} type="button" onClick={() => setForm({ ...form, channel: c.key })}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${form.channel === c.key ? c.color + ' ring-2 ring-offset-1 ring-current' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              <span>{c.icon}</span><span className="truncate">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Téma</label>
          <select value={form.themeId} onChange={e => setForm({ ...form, themeId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm">
            <option value="">— nincs (ad-hoc) —</option>
            {themes.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ütemezés</label>
          <input type="date" value={form.scheduledFor} onChange={e => setForm({ ...form, scheduledFor: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">Mégse</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm">
          {loading ? 'Létrehozás...' : 'Létrehozás és szerkesztés'}
        </button>
      </div>
    </form>
  )
}
