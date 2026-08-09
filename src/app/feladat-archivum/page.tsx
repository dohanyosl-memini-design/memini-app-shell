'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Skull, RotateCcw, Undo2, Building2, Search, CheckCircle2 } from 'lucide-react'

interface Task {
  id: string
  title: string
  priority: string
  status: string
  dueDate: string | null
  updatedAt: string
  archivedAt: string | null
  archiveReason: string | null
  company?: { id: string; name: string } | null
}

type Tab = 'heaven' | 'cemetery'

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function TaskArchivePage() {
  const [tab, setTab] = useState<Tab>('heaven')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    // Mennyország: elvégzett (nem archivált) feladatok. Temető: archiváltak.
    const url = tab === 'heaven' ? '/api/tasks?status=completed' : '/api/tasks?archived=true'
    const res = await fetch(url)
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [tab])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // Elvégzett feladat újranyitása (vissza az aktív táblára, pending státuszba).
  async function reopen(id: string) {
    setBusyId(id)
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    })
    setBusyId(null)
    fetchTasks()
  }

  // Archivált feladat visszahozása a temetőből.
  async function restore(id: string) {
    setBusyId(id)
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore: true }),
    })
    setBusyId(null)
    fetchTasks()
  }

  const q = search.toLowerCase()
  const filtered = search
    ? tasks.filter((t) => t.title.toLowerCase().includes(q) || (t.company?.name.toLowerCase().includes(q) ?? false))
    : tasks

  const isHeaven = tab === 'heaven'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Fejléc */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isHeaven ? 'bg-sky-500' : 'bg-gray-800'}`}>
            {isHeaven ? <Sparkles className="text-white" size={22} /> : <Skull className="text-white" size={22} />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feladat-archívum</h1>
            <p className="text-sm text-gray-500">
              {isHeaven
                ? 'Az elvégzett feladatok — ami kész, becsorog a napi naplóba is'
                : 'Az elengedett (archivált) feladatok — semmi nem veszett el, bármelyik visszahozható'}
            </p>
          </div>
        </div>
        <Link href="/tasks" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft size={16} /> Feladatok
        </Link>
      </div>

      {/* Fül- és keresősor */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          <button
            onClick={() => setTab('heaven')}
            className={`flex items-center gap-1.5 px-3 py-2 ${isHeaven ? 'bg-sky-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <Sparkles size={14} /> Mennyország
          </button>
          <button
            onClick={() => setTab('cemetery')}
            className={`flex items-center gap-1.5 px-3 py-2 ${!isHeaven ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <Skull size={14} /> Temető
          </button>
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés cím vagy cég szerint…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm py-12 text-center">Betöltés…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          {isHeaven ? <Sparkles className="mx-auto text-gray-300 mb-3" size={40} /> : <Skull className="mx-auto text-gray-300 mb-3" size={40} />}
          <p className="text-gray-500">
            {isHeaven ? 'Még nincs elvégzett feladat itt.' : 'A feladat-temető üres.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isHeaven && <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
                  <p className={`font-medium text-gray-900 truncate ${isHeaven ? '' : ''}`}>{t.title}</p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  {t.company && (
                    <Link href={`/companies/${t.company.id}`} className="flex items-center gap-1 hover:text-blue-600">
                      <Building2 size={12} /> {t.company.name}
                    </Link>
                  )}
                  {isHeaven
                    ? <span>Kész: {fmtDate(t.updatedAt)}</span>
                    : <span>Archiválva: {fmtDate(t.archivedAt)}</span>}
                </div>
                {!isHeaven && t.archiveReason && (
                  <p className="mt-1.5 text-sm text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">{t.archiveReason}</p>
                )}
              </div>
              <button
                onClick={() => (isHeaven ? reopen(t.id) : restore(t.id))}
                disabled={busyId === t.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 shrink-0 disabled:opacity-50"
                title={isHeaven ? 'Újranyitás (vissza az aktív feladatok közé)' : 'Visszahozás a temetőből'}
              >
                {isHeaven ? <Undo2 size={14} /> : <RotateCcw size={14} />}
                {isHeaven ? 'Újranyit' : 'Vissza'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
