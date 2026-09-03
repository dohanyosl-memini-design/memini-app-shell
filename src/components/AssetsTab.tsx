'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Check, Trash2, PackageCheck, PackageOpen, Undo2, AlertTriangle, Bot, History, FileDown, Printer } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import {
  PLACEMENT_STATUS_LABEL, isOutStatus,
  type PlacementStatus,
} from '@/lib/assetConstants'

interface CatComponent { id: string; name: string; nameDE: string | null; defaultValue: number; defaultQuantity: number }
interface CatType { id: string; name: string; nameDE: string | null; category: string | null; defaultValue: number; components: CatComponent[] }

interface PItem {
  id: string; kind: string; parentItemId: string | null
  nameSnapshot: string; unitValueSnapshot: number
  quantity: number; returnedQty: number; lostQty: number
}
interface PEvent { id: string; actor: string; action: string; createdAt: string }
interface Placement {
  id: string; status: string; source: string
  contractNumber: string | null; contractStatus: string
  issuedAt: string | null; confirmedAt: string | null; closedAt: string | null; notes: string | null
  issuedBy: { id: string; name: string } | null
  closedBy: { id: string; name: string } | null
  items: PItem[]
  events?: PEvent[]
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
  discarded: 'bg-gray-100 text-gray-400',
}

export default function AssetsTab({ companyId }: { companyId: string }) {
  const [placements, setPlacements] = useState<Placement[]>([])
  const [catalog, setCatalog] = useState<CatType[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)

  const fetchAll = useCallback(async () => {
    const [pRes, cRes] = await Promise.all([
      fetch(`/api/asset-placements?companyId=${companyId}`),
      fetch('/api/asset-types'),
    ])
    if (pRes.ok) setPlacements(await pRes.json() as Placement[])
    if (cRes.ok) setCatalog(await cRes.json() as CatType[])
    setLoading(false)
  }, [companyId])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (loading) return <div className="text-sm text-gray-400 py-4">Betöltés...</div>

  const drafts = placements.filter(p => p.status === 'draft')
  const out = placements.filter(p => isOutStatus(p.status))
  const history = placements.filter(p => ['returned', 'closed_with_loss'].includes(p.status))

  const outValue = out.reduce((s, p) => s + p.values.outstandingValue, 0)
  const lostValue = placements.reduce((s, p) => s + p.values.lostValue, 0)
  const outCount = out.reduce((s, p) => s + p.items.filter(i => i.kind === 'asset').reduce((a, i) => a + (i.quantity - i.returnedQty - i.lostQty), 0), 0)

  return (
    <div className="space-y-5">
      {/* összegző csík */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Kint lévő eszköz" value={`${outCount} db`} tone="amber" icon={<PackageOpen size={15} />} />
        <Stat label="Kint lévő érték" value={euro(outValue)} tone="gray" icon={<PackageCheck size={15} />} />
        <Stat label="Eddigi hiány" value={euro(lostValue)} tone={lostValue > 0 ? 'red' : 'gray'} icon={<AlertTriangle size={15} />} />
      </div>

      {/* új átadás */}
      <div>
        <button onClick={() => setShowBuilder(v => !v)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <Plus size={15} />Új átadás
        </button>
        {showBuilder && (
          <HandoverBuilder catalog={catalog} companyId={companyId} onDone={() => { setShowBuilder(false); fetchAll() }} />
        )}
      </div>

      {/* Arthur piszkozatai */}
      {drafts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Bot size={15} className="text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-700">Előkészített piszkozatok</h3>
          </div>
          <div className="space-y-2">
            {drafts.map(p => <PlacementCard key={p.id} p={p} onChange={fetchAll} draftMode />)}
          </div>
        </section>
      )}

      {/* kint lévő */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Kint lévő eszközök</h3>
        {out.length === 0
          ? <div className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-xl">Jelenleg nincs kint lévő eszköz ennél a partnernél.</div>
          : <div className="space-y-2">{out.map(p => <PlacementCard key={p.id} p={p} onChange={fetchAll} />)}</div>}
      </section>

      {/* előzmény */}
      {history.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <History size={15} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Előzmény</h3>
          </div>
          <div className="space-y-2">{history.map(p => <PlacementCard key={p.id} p={p} onChange={fetchAll} compact />)}</div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, tone, icon }: { label: string; value: string; tone: 'amber' | 'red' | 'gray'; icon: React.ReactNode }) {
  const tones = {
    amber: 'text-amber-700',
    red: 'text-red-600',
    gray: 'text-gray-700',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">{icon}{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
    </div>
  )
}

// ─── Egy kihelyezés kártyája ─────────────────────────────────────────────────

function PlacementCard({ p, onChange, draftMode, compact }: { p: Placement; onChange: () => void; draftMode?: boolean; compact?: boolean }) {
  const [returning, setReturning] = useState(false)
  const [busy, setBusy] = useState(false)
  const assets = p.items.filter(i => i.kind === 'asset')
  const childrenOf = (id: string) => p.items.filter(i => i.parentItemId === id)

  async function confirm() {
    setBusy(true)
    await fetch(`/api/asset-placements/${p.id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    setBusy(false); onChange()
  }
  async function discard() {
    if (!confirm2('Elveti ezt a piszkozatot?')) return
    setBusy(true)
    await fetch(`/api/asset-placements/${p.id}`, { method: 'DELETE' })
    setBusy(false); onChange()
  }
  // A szerződés generálása + letöltése egy lépésben. A GET végpont kitölti a
  // sablont, összerakja a DOCX-et, kiosztja a sorszámot és „generated"-re állítja.
  async function downloadContract() {
    setBusy(true)
    try {
      const res = await fetch(`/api/asset-placements/${p.id}/contract/docx`)
      if (!res.ok) { alert('Hiba a szerződés generálásakor.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = res.headers.get('Content-Disposition') || ''
      const m = cd.match(/filename="(.+?)"/)
      a.download = m ? m[1] : 'Leihvertrag.docx'
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false); onChange()
    }
  }

  return (
    <div className={`bg-white rounded-xl border ${p.status === 'closed_with_loss' ? 'border-red-100' : 'border-gray-100'} shadow-sm overflow-hidden`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLE[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {PLACEMENT_STATUS_LABEL[p.status as PlacementStatus] ?? p.status}
            </span>
            {p.source === 'agent' && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Bot size={10} />Arthur</span>}
            {p.source === 'migration' && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Excel-import</span>}
            {p.contractStatus !== 'none' && p.contractNumber && <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">📄 {p.contractNumber}</span>}
            <span className="text-xs text-gray-400">
              {draftMode ? 'előkészítve' : `kiadva: ${fmtDate(p.issuedAt)}`}
              {p.issuedBy && ` · ${p.issuedBy.name}`}
            </span>
          </div>
          {/* tétel-fa */}
          <div className="mt-2 space-y-1">
            {assets.map(a => (
              <div key={a.id}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-800">{a.nameSnapshot}</span>
                  <span className="text-gray-400 tabular-nums">{a.quantity} db</span>
                  <QtyBadge item={a} />
                </div>
                {childrenOf(a.id).map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-sm text-gray-500 pl-4">
                    <span className="text-gray-300">└</span>
                    <span>{c.nameSnapshot}</span>
                    <span className="text-gray-400 tabular-nums">{c.quantity} db</span>
                    <QtyBadge item={c} />
                  </div>
                ))}
              </div>
            ))}
          </div>
          {p.notes && <p className="mt-2 text-xs text-gray-400">{p.notes}</p>}
          {!compact && (p.values.outstandingValue > 0 || p.values.lostValue > 0) && (
            <div className="mt-2 flex gap-4 text-xs">
              {p.values.outstandingValue > 0 && <span className="text-gray-500">Kint: <b className="tabular-nums">{euro(p.values.outstandingValue)}</b></span>}
              {p.values.lostValue > 0 && <span className="text-red-600">Hiány: <b className="tabular-nums">{euro(p.values.lostValue)}</b></span>}
            </div>
          )}
          {p.status === 'closed_with_loss' && p.closedBy && (
            <p className="mt-1 text-xs text-gray-400">Lezárta: {p.closedBy.name} · {fmtDate(p.closedAt)}</p>
          )}
        </div>

        {/* műveletek */}
        {!compact && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {draftMode ? (
              <>
                <button onClick={confirm} disabled={busy} className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50">
                  <Check size={12} />Megerősítem
                </button>
                <button onClick={discard} disabled={busy} className="flex items-center gap-1 px-2.5 py-1 text-gray-500 text-xs rounded-lg hover:bg-gray-50">
                  <Trash2 size={12} />Elvetem
                </button>
              </>
            ) : isOutStatus(p.status) ? (
              <button onClick={() => setReturning(v => !v)} className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-50">
                <Undo2 size={12} />Visszavétel
              </button>
            ) : null}
            <div className="flex gap-1">
              <button onClick={downloadContract} disabled={busy} title="Szerződés letöltése Word-ben" className="flex items-center gap-1 px-2 py-1 border border-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-50 disabled:opacity-50">
                <FileDown size={12} />Word
              </button>
              <button onClick={() => window.open(`/eszkozok/${p.id}/print`, '_blank')} title="Nyomtatás / Mentés PDF-ként" className="flex items-center gap-1 px-2 py-1 border border-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-50">
                <Printer size={12} />PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {returning && <ReturnPanel p={p} onClose={() => setReturning(false)} onDone={() => { setReturning(false); onChange() }} />}
    </div>
  )
}

function QtyBadge({ item }: { item: PItem }) {
  const outstanding = item.quantity - item.returnedQty - item.lostQty
  if (item.returnedQty === 0 && item.lostQty === 0) return null
  return (
    <span className="flex items-center gap-1.5 text-xs">
      {item.returnedQty > 0 && <span className="text-green-600">✓ {item.returnedQty} vissza</span>}
      {item.lostQty > 0 && <span className="text-red-600">✕ {item.lostQty} hiány</span>}
      {outstanding > 0 && <span className="text-amber-600">{outstanding} kint</span>}
    </span>
  )
}

// ─── Visszavétel-panel (tétel-szint) ─────────────────────────────────────────

function ReturnPanel({ p, onClose, onDone }: { p: Placement; onClose: () => void; onDone: () => void }) {
  // csak a még kint lévő (outstanding > 0) tételek jelennek meg
  const openItems = p.items.filter(i => i.quantity - i.returnedQty - i.lostQty > 0)
  const [rows, setRows] = useState<Record<string, { returned: number; lost: number }>>(() => {
    const init: Record<string, { returned: number; lost: number }> = {}
    for (const i of openItems) {
      const outstanding = i.quantity - i.returnedQty - i.lostQty
      init[i.id] = { returned: i.returnedQty + outstanding, lost: i.lostQty } // alapból: minden visszajött
    }
    return init
  })
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    const items = Object.entries(rows).map(([itemId, v]) => ({ itemId, returnedQty: v.returned, lostQty: v.lost }))
    await fetch(`/api/asset-placements/${p.id}/return`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    setBusy(false); onDone()
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Visszavétel — mi jött vissza?</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
      <div className="space-y-1.5">
        {openItems.map(i => {
          const outstanding = i.quantity - i.returnedQty - i.lostQty
          const row = rows[i.id]
          const back = row.returned - i.returnedQty // most visszahozott
          const lostNow = row.lost - i.lostQty
          return (
            <div key={i.id} className={`flex items-center gap-2 text-sm ${i.kind === 'component' ? 'pl-4' : ''}`}>
              <span className="flex-1 text-gray-700">{i.kind === 'component' ? '└ ' : ''}{i.nameSnapshot} <span className="text-gray-400">({outstanding} kint)</span></span>
              <label className="flex items-center gap-1 text-xs text-gray-500">vissza
                <input type="number" min={i.returnedQty} max={i.quantity - i.lostQty} value={row.returned}
                  onChange={e => setRows(r => ({ ...r, [i.id]: { ...r[i.id], returned: Number(e.target.value) } }))}
                  className="w-14 px-1.5 py-1 border border-gray-200 rounded text-sm tabular-nums" />
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-500">hiány
                <input type="number" min={i.lostQty} max={i.quantity - row.returned} value={row.lost}
                  onChange={e => setRows(r => ({ ...r, [i.id]: { ...r[i.id], lost: Number(e.target.value) } }))}
                  className="w-14 px-1.5 py-1 border border-gray-200 rounded text-sm tabular-nums" />
              </label>
            </div>
          )
        })}
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onClose} className="px-3 py-1.5 text-gray-500 text-sm">Mégse</button>
        <button onClick={submit} disabled={busy} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
          {busy ? 'Mentés...' : 'Visszavétel rögzítése'}
        </button>
      </div>
    </div>
  )
}

// ─── Új átadás összeállítása ─────────────────────────────────────────────────

interface BuilderRow { key: string; assetTypeId: string; quantity: number; components: Record<string, { checked: boolean; quantity: number }> }

function HandoverBuilder({ catalog, companyId, onDone }: { catalog: CatType[]; companyId: string; onDone: () => void }) {
  const [rows, setRows] = useState<BuilderRow[]>([])
  const [pick, setPick] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  function addAsset(typeId: string) {
    const t = catalog.find(c => c.id === typeId)
    if (!t) return
    const components: BuilderRow['components'] = {}
    for (const c of t.components) components[c.id] = { checked: true, quantity: c.defaultQuantity }
    setRows(r => [...r, { key: `${typeId}-${Date.now()}`, assetTypeId: typeId, quantity: 1, components }])
    setPick('')
  }

  async function submit(confirmNow: boolean) {
    if (rows.length === 0) return
    setBusy(true)
    const items = rows.map(r => ({
      assetTypeId: r.assetTypeId,
      quantity: r.quantity,
      components: Object.entries(r.components).filter(([, v]) => v.checked).map(([componentId, v]) => ({ componentId, quantity: v.quantity })),
    }))
    await fetch('/api/asset-placements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, notes, items, confirm: confirmNow }),
    })
    setBusy(false); onDone()
  }

  return (
    <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
      {/* kellék hozzáadása */}
      <div className="flex items-center gap-2">
        <select value={pick} onChange={e => { if (e.target.value) addAsset(e.target.value) }} className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">+ Kellék hozzáadása…</option>
          {catalog.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      {catalog.length === 0 && <p className="text-xs text-amber-600">Előbb vegyél fel kellékeket a Beállítások → Eszközök fülön.</p>}

      {/* kiválasztott kellékek */}
      {rows.map((r, idx) => {
        const t = catalog.find(c => c.id === r.assetTypeId)
        if (!t) return null
        return (
          <div key={r.key} className="p-3 bg-white rounded-lg border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex-1 text-sm font-medium text-gray-800">{t.name}</span>
              <label className="flex items-center gap-1 text-xs text-gray-500">db
                <input type="number" min={1} value={r.quantity} onChange={e => setRows(rs => rs.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} className="w-14 px-1.5 py-1 border border-gray-200 rounded text-sm tabular-nums" />
              </label>
              <button onClick={() => setRows(rs => rs.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
            </div>
            {t.components.length > 0 && (
              <div className="pl-2 space-y-1">
                <div className="text-xs text-gray-400 mb-1">Mely alkatrészek mennek vele?</div>
                {t.components.map(c => {
                  const cur = r.components[c.id] ?? { checked: false, quantity: c.defaultQuantity }
                  return (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <input type="checkbox" checked={cur.checked} onChange={e => setRows(rs => rs.map((x, i) => i === idx ? { ...x, components: { ...x.components, [c.id]: { ...cur, checked: e.target.checked } } } : x))} className="rounded" />
                        <span className={cur.checked ? 'text-gray-700' : 'text-gray-400'}>{c.name}</span>
                      </label>
                      {cur.checked && (
                        <input type="number" min={1} value={cur.quantity} onChange={e => setRows(rs => rs.map((x, i) => i === idx ? { ...x, components: { ...x.components, [c.id]: { ...cur, quantity: Number(e.target.value) } } } : x))} className="w-14 px-1.5 py-1 border border-gray-200 rounded text-sm tabular-nums" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {rows.length > 0 && (
        <>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Megjegyzés (opcionális)" rows={2} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">A megerősítés téged rögzít kiadóként — ez a fizikai átadás visszaigazolása.</p>
            <div className="flex gap-2">
              <button onClick={() => submit(false)} disabled={busy} className="px-3 py-1.5 text-gray-600 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">Piszkozatként</button>
              <button onClick={() => submit(true)} disabled={busy} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                {busy ? 'Mentés...' : 'Átadás megerősítése'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// confirm ütközés elkerülése (a PlacementCard-ban van egy `confirm` nevű fv)
function confirm2(msg: string) { return typeof window !== 'undefined' ? window.confirm(msg) : true }
