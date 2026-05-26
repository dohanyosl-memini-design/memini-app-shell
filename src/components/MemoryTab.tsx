'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Search, X } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface MemoryEntryType {
  id: string
  label: string
  icon: string
  color: string
}

interface MemoryEntry {
  id: string
  typeId: string
  type: MemoryEntryType
  content: string
  date: string | null
  source: string
  createdAt: string
}

interface MemoryTabProps {
  companyId?: string
  contactId?: string
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  pink: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
}

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  user: { label: 'Kézi', color: 'bg-gray-100 text-gray-500' },
  mcp: { label: 'MCP', color: 'bg-blue-100 text-blue-600' },
  web: { label: 'Webes', color: 'bg-green-100 text-green-700' },
}

export default function MemoryTab({ companyId, contactId }: MemoryTabProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [types, setTypes] = useState<MemoryEntryType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [researching, setResearching] = useState(false)
  const [researchResult, setResearchResult] = useState<string | null>(null)
  const [researchSaved, setResearchSaved] = useState(false)

  const [form, setForm] = useState({
    typeId: '',
    content: '',
    date: '',
  })

  const fetchEntries = useCallback(async () => {
    const params = new URLSearchParams()
    if (companyId) params.set('companyId', companyId)
    if (contactId) params.set('contactId', contactId)
    const res = await fetch(`/api/memories?${params}`)
    if (res.ok) {
      const data = await res.json() as MemoryEntry[]
      setEntries(data)
    }
    setLoading(false)
  }, [companyId, contactId])

  useEffect(() => {
    fetchEntries()
    fetch('/api/memory-types')
      .then(r => r.json())
      .then((data: MemoryEntryType[]) => {
        setTypes(data)
        if (data.length > 0) setForm(f => ({ ...f, typeId: data[0].id }))
      })
  }, [fetchEntries])

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!form.typeId || !form.content.trim()) return
    await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: companyId ?? null,
        contactId: contactId ?? null,
        typeId: form.typeId,
        content: form.content.trim(),
        date: form.date || null,
        source: 'user',
      }),
    })
    setForm(f => ({ ...f, content: '', date: '' }))
    setShowForm(false)
    fetchEntries()
  }

  async function handleDelete(id: string) {
    if (!confirm('Törli ezt a bejegyzést?')) return
    await fetch(`/api/memories/${id}`, { method: 'DELETE' })
    fetchEntries()
  }

  async function handleResearch() {
    if (!companyId) return
    setResearching(true)
    setResearchResult(null)
    setResearchSaved(false)
    try {
      const res = await fetch('/api/memories/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      const data = await res.json() as { summary: string; saved: boolean }
      setResearchResult(data.summary)
      if (data.saved) {
        setResearchSaved(true)
        fetchEntries()
      }
    } finally {
      setResearching(false)
    }
  }

  if (loading) {
    return <div className="py-8 text-center text-gray-400 text-sm">Betöltés...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center gap-2 justify-end">
        {companyId && (
          <button
            onClick={handleResearch}
            disabled={researching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Search size={14} />
            {researching ? 'Kutatás...' : '🔍 Kutatás'}
          </button>
        )}
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} />
          Bejegyzés
        </button>
      </div>

      {/* Research result */}
      {researchResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-green-800">🌐 Webes kutatás eredménye</p>
            {researchSaved && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Mentve</span>
            )}
            <button onClick={() => setResearchResult(null)} className="text-green-500 hover:text-green-700">
              <X size={14} />
            </button>
          </div>
          <p className="text-sm text-green-700 whitespace-pre-line">{researchResult}</p>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAddEntry} className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Típus</label>
              <select
                value={form.typeId}
                onChange={e => setForm(f => ({ ...f, typeId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {types.map(t => (
                  <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dátum (opcionális)</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tartalom *</label>
            <textarea
              required
              rows={3}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Mit jegyezz fel..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Mégse
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Mentés
            </button>
          </div>
        </form>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-3xl mb-3">🧠</p>
          <p className="text-gray-400 text-sm">Még nincs memória bejegyzés.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => {
            const colors = COLOR_MAP[entry.type.color] ?? COLOR_MAP.gray
            const sourceBadge = SOURCE_BADGE[entry.source] ?? SOURCE_BADGE.user
            return (
              <div
                key={entry.id}
                className={`group flex gap-3 p-3 rounded-xl border ${colors.border} ${colors.bg} transition-colors`}
              >
                <div className="text-lg shrink-0 mt-0.5">{entry.type.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold ${colors.text}`}>{entry.type.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${sourceBadge.color}`}>
                      {sourceBadge.label}
                    </span>
                    {entry.date && (
                      <span className="text-xs text-gray-400">
                        {format(new Date(entry.date), 'yyyy. MMM d.', { locale: hu })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{entry.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(entry.createdAt), 'yyyy. MMM d. HH:mm', { locale: hu })}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-colors mt-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
