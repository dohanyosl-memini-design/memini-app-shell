'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Skull, Search, ArrowLeft, RotateCcw, Building2, MapPin, Package } from 'lucide-react'
import Modal from '@/components/Modal'

interface LostCompany {
  id: string
  name: string
  city: string | null
  lifecycle: 'lost_lead' | 'lost_partner'
  lostReason: string | null
  lostAt: string | null
  firstOrderDate: string | null
  _count: { orders: number }
}

type Filter = 'all' | 'lost_lead' | 'lost_partner'

const RESTORE_TARGETS: { value: string; label: string }[] = [
  { value: 'prospect', label: 'Prospekt' },
  { value: 'cold_lead', label: 'Hideg lead' },
  { value: 'interested', label: 'Érdeklődő' },
  { value: 'partner', label: 'Partner' },
  { value: 'inactive', label: 'Inaktív' },
]

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
}

function relationshipLength(first: string | null, lost: string | null): string | null {
  if (!first || !lost) return null
  const months = Math.round((new Date(lost).getTime() - new Date(first).getTime()) / (1000 * 60 * 60 * 24 * 30.4))
  if (months < 1) return 'kevesebb mint 1 hónap'
  if (months < 12) return `${months} hónap`
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest ? `${years} év ${rest} hó` : `${years} év`
}

export default function CemeteryPage() {
  const [companies, setCompanies] = useState<LostCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [restoring, setRestoring] = useState<LostCompany | null>(null)
  const [restoreTarget, setRestoreTarget] = useState('prospect')
  const [busy, setBusy] = useState(false)

  const fetchCemetery = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ view: 'cemetery' })
    if (search) params.set('search', search)
    if (filter !== 'all') params.set('lifecycle', filter)
    const res = await fetch(`/api/companies?${params}`)
    const data = await res.json()
    setCompanies(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search, filter])

  useEffect(() => { fetchCemetery() }, [fetchCemetery])

  function openRestore(c: LostCompany) {
    setRestoring(c)
    // Ex-partnert alapból partnerként hozunk vissza, ex-leadet prospektként.
    setRestoreTarget(c.lifecycle === 'lost_partner' ? 'partner' : 'prospect')
  }

  async function confirmRestore() {
    if (!restoring) return
    setBusy(true)
    await fetch(`/api/companies/${restoring.id}/lifecycle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: restoreTarget }),
    })
    setBusy(false)
    setRestoring(null)
    fetchCemetery()
  }

  const leads = companies.filter(c => c.lifecycle === 'lost_lead')
  const partners = companies.filter(c => c.lifecycle === 'lost_partner')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Fejléc */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-800">
            <Skull className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Temető</h1>
            <p className="text-sm text-gray-500">Elvesztett leadek és partnerek — minden adatuk megmaradt, bármikor visszahozható</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/companies" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} /> Partnerek
          </Link>
          <Link href="/leads" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} /> Leadek
          </Link>
        </div>
      </div>

      {/* Kereső + szűrő */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név vagy város szerint…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {([['all', 'Mind'], ['lost_lead', `Elvesztett leadek (${leads.length})`], ['lost_partner', `Elvesztett partnerek (${partners.length})`]] as [Filter, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-3 py-2 ${filter === val ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm py-12 text-center">Betöltés…</p>
      ) : companies.length === 0 ? (
        <div className="text-center py-16">
          <Skull className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500">A temető üres — még senkit sem vesztettünk el.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {companies.map((c) => {
            const isPartner = c.lifecycle === 'lost_partner'
            const rel = relationshipLength(c.firstOrderDate, c.lostAt)
            return (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 size={15} className="text-gray-400 shrink-0" />
                      <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                    </div>
                    {c.city && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <MapPin size={12} /> {c.city}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${isPartner ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                    {isPartner ? 'ex-partner' : 'ex-lead'}
                  </span>
                </div>

                <div className="mt-3 rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Miért veszett el</p>
                  <p className="text-sm text-gray-700">{c.lostReason || '—'}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>Elvesztve: {fmtDate(c.lostAt)}</span>
                  {rel && <span>Kapcsolat hossza: {rel}</span>}
                  {isPartner && (
                    <span className="flex items-center gap-1">
                      <Package size={12} /> {c._count.orders} rendelés
                    </span>
                  )}
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => openRestore(c)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <RotateCcw size={14} /> Visszahozás
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Visszahozás modal */}
      {restoring && (
        <Modal title={`${restoring.name} visszahozása`} onClose={() => setRestoring(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Melyik állapotba kerüljön vissza?</p>
            <select
              value={restoreTarget}
              onChange={(e) => setRestoreTarget(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              {RESTORE_TARGETS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRestoring(null)} disabled={busy} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50">Mégse</button>
              <button onClick={confirmRestore} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 disabled:opacity-50">
                <RotateCcw size={16} /> {busy ? 'Folyamatban…' : 'Visszahozás'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
