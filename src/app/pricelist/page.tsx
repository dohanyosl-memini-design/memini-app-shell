'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Euro, ChevronDown, ChevronUp, Download } from 'lucide-react'
import Modal from '@/components/Modal'

interface Tier { qty: number; m: number }
interface Carrier { id: string; code: string; name: string; nameDE: string | null; group: string | null }

interface PriceEntry {
  id: string
  name: string
  hordozo: string | null
  costPrice: number
  basePrice: number
  tiers: Tier[]
  notes: string | null
  sortOrder: number
}

const DEFAULT_TIERS: Tier[] = [
  {qty:50,m:1},{qty:100,m:0.985},{qty:200,m:0.97},{qty:300,m:0.96},{qty:500,m:0.94},{qty:1000,m:0.92},{qty:2000,m:0.9}
]

function fmt(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function PriceEntryForm({ entry, onSave, onCancel, carriers }: {
  entry: PriceEntry | null
  onSave: () => void
  onCancel: () => void
  carriers: Carrier[]
}) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(entry?.name || '')
  const [hordozo, setHordozo] = useState(entry?.hordozo || '')
  const [costPrice, setCostPrice] = useState(entry?.costPrice?.toString() || '')
  const [basePrice, setBasePrice] = useState(entry?.basePrice?.toString() || '')
  const [tiers, setTiers] = useState<Tier[]>(entry?.tiers?.length ? entry.tiers : DEFAULT_TIERS)
  const [notes, setNotes] = useState(entry?.notes || '')

  function updateTier(i: number, field: 'qty' | 'm', val: string) {
    setTiers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: parseFloat(val) || 0 } : t))
  }

  function addTier() {
    setTiers(prev => [...prev, { qty: 0, m: 1 }])
  }

  function removeTier(i: number) {
    setTiers(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const method = entry ? 'PUT' : 'POST'
    const url = entry ? `/api/pricelist/${entry.id}` : '/api/pricelist'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, hordozo: hordozo || null, costPrice, basePrice, tiers, notes }),
    })
    setLoading(false)
    onSave()
  }

  const base = parseFloat(basePrice) || 0
  const cost = parseFloat(costPrice) || 0

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Termék neve *</label>
        <input required type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="pl. Kő Grafitoptik GO – normál"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hordozó típus</label>
        <select value={hordozo} onChange={e => setHordozo(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Egyéb / nincs megadva</option>
          {Array.from(new Set(carriers.map(c => c.group).filter(Boolean))).map(group => (
            <optgroup key={group!} label={group!}>
              {carriers.filter(c => c.group === group).map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </optgroup>
          ))}
          {carriers.filter(c => !c.group).map(c => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bekerülési ár (€)</label>
          <input type="number" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alap egységár – 50db (€)</label>
          <input type="number" step="0.01" value={basePrice} onChange={e => setBasePrice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Mennyiségi sávok</label>
          <button type="button" onClick={addTier} className="text-xs text-blue-600 hover:underline">+ sáv hozzáadása</button>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-gray-500">db</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Szorzó</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">Ár (€)</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">Haszon (€)</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tiers.map((t, i) => {
                const price = base * t.m
                const profit = price - cost
                return (
                  <tr key={i}>
                    <td className="px-3 py-1.5">
                      <input type="number" value={t.qty} onChange={e => updateTier(i, 'qty', e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-200 rounded text-sm" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="number" step="0.001" value={t.m} onChange={e => updateTier(i, 'm', e.target.value)}
                        className="w-24 px-2 py-1 border border-gray-200 rounded text-sm" />
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-900">
                      {base > 0 ? fmt(price) : '–'}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono text-xs ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {base > 0 && cost > 0 ? (profit >= 0 ? '+' : '') + fmt(profit) : '–'}
                    </td>
                    <td className="px-2 py-1.5">
                      <button type="button" onClick={() => removeTier(i)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Mégse</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Mentés...' : 'Mentés'}
        </button>
      </div>
    </form>
  )
}

export default function PriceListPage() {
  const [entries, setEntries] = useState<PriceEntry[]>([])
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState<PriceEntry | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [seeding, setSeeding] = useState(false)

  const fetchEntries = useCallback(async () => {
    const res = await fetch('/api/pricelist')
    const data = await res.json()
    setEntries(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => {
    fetch('/api/carriers').then(r => r.json()).then(setCarriers).catch(() => {})
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Törli ezt a sort?')) return
    await fetch(`/api/pricelist/${id}`, { method: 'DELETE' })
    fetchEntries()
  }

  async function handleSeed() {
    setSeeding(true)
    await fetch('/api/pricelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _seed: true }),
    })
    await fetchEntries()
    setSeeding(false)
  }

  // Group entries by carrier group
  const grouped: { group: string; items: PriceEntry[] }[] = []
  const assigned = new Set<string>()
  const carrierGroups = Array.from(new Set(carriers.map(c => c.group).filter(Boolean))) as string[]
  const codesForGroup = (group: string) => carriers.filter(c => c.group === group).map(c => c.code)

  for (const group of carrierGroups) {
    const codes = codesForGroup(group)
    const items = entries.filter(e => e.hordozo && codes.includes(e.hordozo))
    if (items.length > 0) {
      grouped.push({ group, items })
      items.forEach(e => assigned.add(e.id))
    }
  }
  const others = entries.filter(e => !assigned.has(e.id))
  if (others.length > 0) grouped.push({ group: 'Egyéb', items: others })

  // Collect all unique qty tiers from all entries
  const allQtys = Array.from(new Set(entries.flatMap(e => e.tiers.map(t => t.qty)))).sort((a, b) => a - b)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Euro size={22} className="text-blue-600" />
            Ártáblázat 2026
          </h1>
          <p className="text-gray-500 mt-1">Nettó mennyiségi árak · EUR</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeed} disabled={seeding}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <Download size={15} />
            {seeding ? 'Betöltés...' : 'Adatok szinkronizálása'}
          </button>
          <button
            onClick={() => { setEditEntry(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />Új sor
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Betöltés...</div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
          <Euro size={40} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">Még nincs ártáblázat adat.</p>
          <p className="text-sm text-gray-400 mb-6">Kattints az &quot;Alapadatok betöltése&quot; gombra az Excel-ből importált adatok betöltéséhez.</p>
          <button onClick={handleSeed} disabled={seeding}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {seeding ? 'Betöltés...' : 'Alapadatok betöltése'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ group, items }) => {
            const isCollapsed = collapsed[group]
            const qtys = Array.from(new Set(items.flatMap(e => e.tiers.map(t => t.qty)))).sort((a, b) => a - b)

            return (
              <div key={group} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setCollapsed(prev => ({ ...prev, [group]: !prev[group] }))}
                  className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
                >
                  <span className="font-semibold text-gray-800 text-sm">{group}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{items.length} termék</span>
                    {isCollapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase min-w-[200px]">Termék</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Beker. ár</th>
                          {qtys.map(q => (
                            <th key={q} className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{q} db</th>
                          ))}
                          <th className="w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {items.map(entry => {
                          const tierMap = Object.fromEntries(entry.tiers.map(t => [t.qty, t]))
                          return (
                            <tr key={entry.id} className="group hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{entry.name}</p>
                                {entry.notes && <p className="text-xs text-gray-400 mt-0.5">{entry.notes}</p>}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-mono text-gray-600">€{fmt(entry.costPrice)}</span>
                              </td>
                              {qtys.map(q => {
                                const tier = tierMap[q]
                                const price = tier ? entry.basePrice * tier.m : null
                                const profit = price !== null ? price - entry.costPrice : null
                                return (
                                  <td key={q} className="px-4 py-3 text-right">
                                    {price !== null ? (
                                      <div>
                                        <p className="font-mono font-medium text-gray-900">€{fmt(price)}</p>
                                        <p className={`text-xs font-mono ${profit! >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                          {profit! >= 0 ? '+' : ''}{fmt(profit!)}
                                        </p>
                                      </div>
                                    ) : (
                                      <span className="text-gray-300">–</span>
                                    )}
                                  </td>
                                )
                              })}
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditEntry(entry); setShowModal(true) }}
                                    className="text-gray-400 hover:text-blue-600 transition-colors p-1">
                                    <Edit2 size={13} />
                                  </button>
                                  <button onClick={() => handleDelete(entry.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editEntry ? 'Sor szerkesztése' : 'Új ártáblázat sor'} onClose={() => setShowModal(false)} size="lg">
          <PriceEntryForm
            entry={editEntry}
            onSave={() => { setShowModal(false); fetchEntries() }}
            onCancel={() => setShowModal(false)}
            carriers={carriers}
          />
        </Modal>
      )}
    </div>
  )
}
