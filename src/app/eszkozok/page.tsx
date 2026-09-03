'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { PackageOpen, PackageCheck, AlertTriangle, Bot, FileWarning, Building2, FileDown, Printer, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { PLACEMENT_STATUS_LABEL, isOutStatus, type PlacementStatus } from '@/lib/assetConstants'

interface PItem {
  id: string; kind: string; parentItemId: string | null
  nameSnapshot: string; unitValueSnapshot: number
  quantity: number; returnedQty: number; lostQty: number
}
interface Placement {
  id: string; status: string; source: string
  contractNumber: string | null; contractStatus: string
  issuedAt: string | null; notes: string | null
  company: { id: string; name: string } | null
  issuedBy: { id: string; name: string } | null
  items: PItem[]
  values: { totalValue: number; outstandingValue: number; lostValue: number }
}

function euro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtDate(d: string | null) {
  return d ? format(new Date(d), 'yyyy. MM. dd.', { locale: hu }) : '—'
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  out: 'bg-amber-50 text-amber-700',
  partially_returned: 'bg-amber-50 text-amber-700',
  returned: 'bg-green-50 text-green-700',
  closed_with_loss: 'bg-red-50 text-red-700',
}

type StatusFilter = 'kint' | 'mind' | 'draft' | 'returned' | 'closed_with_loss'

export default function EszkozokPage() {
  const [placements, setPlacements] = useState<Placement[]>([])
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState('')
  const [asset, setAsset] = useState('')
  const [statusF, setStatusF] = useState<StatusFilter>('kint')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [onlyNoContract, setOnlyNoContract] = useState(false)

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/asset-placements')
    if (res.ok) {
      const data = await res.json() as Placement[]
      setPlacements(data.filter(p => p.status !== 'discarded'))
    }
    setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  // ── összesítők ──────────────────────────────────────────────────────────
  const out = placements.filter(p => isOutStatus(p.status))
  const outCount = out.reduce((s, p) => s + p.items.filter(i => i.kind === 'asset').reduce((a, i) => a + (i.quantity - i.returnedQty - i.lostQty), 0), 0)
  const partnersWithOut = new Set(out.map(p => p.company?.id).filter(Boolean)).size
  const outValue = out.reduce((s, p) => s + p.values.outstandingValue, 0)
  const lostValue = placements.reduce((s, p) => s + p.values.lostValue, 0)
  const draftCount = placements.filter(p => p.status === 'draft').length
  const noContractOut = out.filter(p => p.contractStatus === 'none').length

  // ── szűrő-opciók ────────────────────────────────────────────────────────
  const companies = useMemo(() => {
    const m = new Map<string, string>()
    placements.forEach(p => { if (p.company) m.set(p.company.id, p.company.name) })
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'hu'))
  }, [placements])
  const assets = useMemo(() => {
    const s = new Set<string>()
    placements.forEach(p => p.items.filter(i => i.kind === 'asset').forEach(i => s.add(i.nameSnapshot)))
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'hu'))
  }, [placements])

  // ── sorok ───────────────────────────────────────────────────────────────
  const rows = placements.filter(p => {
    if (statusF === 'kint' && !isOutStatus(p.status)) return false
    if (statusF === 'draft' && p.status !== 'draft') return false
    if (statusF === 'returned' && p.status !== 'returned') return false
    if (statusF === 'closed_with_loss' && p.status !== 'closed_with_loss') return false
    if (company && p.company?.id !== company) return false
    if (asset && !p.items.some(i => i.kind === 'asset' && i.nameSnapshot === asset)) return false
    if (onlyMissing && p.values.lostValue <= 0) return false
    if (onlyNoContract && !(isOutStatus(p.status) && p.contractStatus === 'none')) return false
    return true
  })

  async function downloadContract(id: string) {
    const res = await fetch(`/api/asset-placements/${id}/contract/docx`)
    if (!res.ok) { alert('Hiba a szerződés generálásakor.'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const m = (res.headers.get('Content-Disposition') || '').match(/filename="(.+?)"/)
    a.download = m ? m[1] : 'Leihvertrag.docx'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    fetchAll()
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <PackageOpen className="text-blue-600" /> Kihelyezett eszközök
        </h1>
        <p className="text-sm text-gray-500 mt-1">Minden partnernél kint lévő kellék egy helyen — ki, mit, mikor, és mennyi az érték.</p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-10 text-center">Betöltés...</div>
      ) : (
        <>
          {/* statisztika-csík */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat icon={<PackageOpen size={16} />} label="Kint lévő eszköz" value={`${outCount} db`} tone="amber" />
            <Stat icon={<Building2 size={16} />} label="Érintett partner" value={`${partnersWithOut}`} tone="gray" />
            <Stat icon={<PackageCheck size={16} />} label="Kint lévő érték" value={euro(outValue)} tone="gray" />
            <Stat icon={<AlertTriangle size={16} />} label="Eddigi hiány" value={euro(lostValue)} tone={lostValue > 0 ? 'red' : 'gray'} />
          </div>

          {/* kiemelések */}
          {(noContractOut > 0 || draftCount > 0) && (
            <div className="flex flex-wrap gap-3 mb-4">
              {noContractOut > 0 && (
                <button
                  onClick={() => { setOnlyNoContract(v => !v); setStatusF('kint') }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${onlyNoContract ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100'}`}
                >
                  <FileWarning size={15} />
                  <b>{noContractOut}</b> kint van szerződés nélkül
                </button>
              )}
              {draftCount > 0 && (
                <button
                  onClick={() => setStatusF(s => s === 'draft' ? 'kint' : 'draft')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${statusF === 'draft' ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-purple-50 border-purple-100 text-purple-700 hover:bg-purple-100'}`}
                >
                  <Bot size={15} />
                  <b>{draftCount}</b> előkészített piszkozat
                </button>
              )}
            </div>
          )}

          {/* szűrők */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4 flex flex-wrap items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <select value={statusF} onChange={e => setStatusF(e.target.value as StatusFilter)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="kint">Kint lévők</option>
              <option value="mind">Mind</option>
              <option value="draft">Piszkozatok</option>
              <option value="returned">Visszavéve</option>
              <option value="closed_with_loss">Hiánnyal lezárva</option>
            </select>
            <select value={company} onChange={e => setCompany(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white max-w-[200px]">
              <option value="">Minden partner</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={asset} onChange={e => setAsset(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white max-w-[180px]">
              <option value="">Minden kellék</option>
              {assets.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-1 cursor-pointer">
              <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} className="rounded" /> csak hiányos
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={onlyNoContract} onChange={e => setOnlyNoContract(e.target.checked)} className="rounded" /> csak szerződés nélkül
            </label>
            <span className="ml-auto text-xs text-gray-400">{rows.length} tétel</span>
          </div>

          {/* táblázat */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Partner</th>
                  <th className="px-4 py-3 font-medium">Eszközök</th>
                  <th className="px-4 py-3 font-medium text-center">Kint</th>
                  <th className="px-4 py-3 font-medium">Kiadva</th>
                  <th className="px-4 py-3 font-medium">Kiadó</th>
                  <th className="px-4 py-3 font-medium">Állapot</th>
                  <th className="px-4 py-3 font-medium text-right">Hiány</th>
                  <th className="px-4 py-3 font-medium text-right">Szerződés</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(p => {
                  const assetRows = p.items.filter(i => i.kind === 'asset')
                  const outQty = assetRows.reduce((a, i) => a + (i.quantity - i.returnedQty - i.lostQty), 0)
                  const names = assetRows.map(i => `${i.nameSnapshot}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ')
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        {p.company
                          ? <Link href={`/companies/${p.company.id}`} className="text-blue-600 hover:underline font-medium">{p.company.name}</Link>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{names || '—'}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{isOutStatus(p.status) ? outQty : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(p.issuedAt)}</td>
                      <td className="px-4 py-3 text-gray-500">{p.issuedBy?.name ?? (p.status === 'draft' ? '—' : '')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLE[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {PLACEMENT_STATUS_LABEL[p.status as PlacementStatus] ?? p.status}
                        </span>
                        {p.source === 'agent' && <span className="ml-1 text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">Arthur</span>}
                        {p.source === 'migration' && <span className="ml-1 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Excel</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {p.values.lostValue > 0 ? <span className="text-red-600 font-medium">{euro(p.values.lostValue)}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {p.contractNumber && <span className="text-xs text-gray-400 mr-2">{p.contractNumber}</span>}
                        {p.items.length > 0 && (
                          <span className="inline-flex items-center gap-2">
                            <button onClick={() => downloadContract(p.id)} title="Word letöltése" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs">
                              <FileDown size={13} />Word
                            </button>
                            <button onClick={() => window.open(`/eszkozok/${p.id}/print`, '_blank')} title="Nyomtatás / PDF" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs">
                              <Printer size={13} />PDF
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">Nincs a szűrőnek megfelelő tétel.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'amber' | 'red' | 'gray' }) {
  const toneClass = { amber: 'text-amber-700', red: 'text-red-600', gray: 'text-gray-800' }[tone]
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">{icon}{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  )
}
