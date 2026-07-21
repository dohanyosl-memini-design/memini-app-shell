'use client'

import { useState } from 'react'

interface ThemeData {
  id: string
  title: string
  message: string | null
  outline: string | null
  status: string
  startDate: string | null
  endDate: string | null
  arcId: string | null
}

interface ThemeFormProps {
  theme: ThemeData | null
  defaultArcId?: string
  onSave: () => void
  onCancel: () => void
}

export default function ThemeForm({ theme, defaultArcId, onSave, onCancel }: ThemeFormProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: theme?.title || '',
    message: theme?.message || '',
    outline: theme?.outline || '',
    status: theme?.status || 'planned',
    startDate: theme?.startDate ? theme.startDate.slice(0, 10) : '',
    endDate: theme?.endDate ? theme.endDate.slice(0, 10) : '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      ...form,
      arcId: theme?.arcId ?? defaultArcId ?? null,
    }
    await fetch(theme ? `/api/marketing/themes/${theme.id}` : '/api/marketing/themes', {
      method: theme ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setLoading(false)
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Téma címe *</label>
        <input required type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          placeholder="pl. A dómok rejtett részletei — sorozat"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mondanivaló</label>
        <textarea rows={2} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
          placeholder="Mi a téma központi üzenete? Kinek szól, mit akarunk elérni?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y text-sm" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Struktúra / részek (vázlat)</label>
        <textarea rows={6} value={form.outline} onChange={e => setForm({ ...form, outline: e.target.value })}
          placeholder={'- 1. rész: ...\n- 2. rész: ...\n- 3. rész: ...'}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y text-sm font-mono leading-relaxed" />
        <p className="text-xs text-gray-400 mt-1">Ez a vázlat lesz a generálás alapja — ebből készül a blog, abból a többi tartalom.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Állapot</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm">
            <option value="planned">Tervezett</option>
            <option value="approved">Elfogadva</option>
            <option value="active">Folyamatban</option>
            <option value="done">Kész</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kezdés</label>
          <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vége</label>
          <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">Mégse</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm">
          {loading ? 'Mentés...' : theme ? 'Módosítás' : 'Téma létrehozása'}
        </button>
      </div>
    </form>
  )
}
