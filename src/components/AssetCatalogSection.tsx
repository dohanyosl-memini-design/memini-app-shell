'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronRight, Package, RotateCcw } from 'lucide-react'
import { ASSET_CATEGORIES, ASSET_CATEGORY_LABEL } from '@/lib/assetConstants'

interface AssetComponent {
  id: string
  name: string
  nameDE: string | null
  imageUrl: string | null
  defaultValue: number
  defaultQuantity: number
  active: boolean
  sortOrder: number
}

interface AssetType {
  id: string
  name: string
  nameDE: string | null
  category: string | null
  defaultValue: number
  imageUrl: string | null
  contractAddendumDe: string | null
  active: boolean
  sortOrder: number
  components: AssetComponent[]
}

const emptyType = { name: '', nameDE: '', category: 'stand', defaultValue: '', imageUrl: '', contractAddendumDe: '' }
const emptyComp = { name: '', nameDE: '', defaultValue: '', defaultQuantity: '1', imageUrl: '' }

function euro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function AssetCatalogSection() {
  const [types, setTypes] = useState<AssetType[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newType, setNewType] = useState(emptyType)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState(emptyType)

  const fetchTypes = useCallback(async () => {
    const res = await fetch('/api/asset-types?includeInactive=true')
    if (res.ok) setTypes(await res.json() as AssetType[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTypes() }, [fetchTypes])

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleAddType(e: React.FormEvent) {
    e.preventDefault()
    if (!newType.name.trim()) return
    await fetch('/api/asset-types', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newType),
    })
    setNewType(emptyType)
    setShowAdd(false)
    fetchTypes()
  }

  async function handleSaveType(id: string) {
    await fetch(`/api/asset-types/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    })
    setEditId(null)
    fetchTypes()
  }

  async function setTypeActive(id: string, active: boolean) {
    if (!active && !confirm('Kivezeti ezt a kelléket? A korábbi kihelyezések és szerződések érintetlenek maradnak.')) return
    await fetch(`/api/asset-types/${id}`, {
      method: active ? 'PUT' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: active ? JSON.stringify({ active: true }) : undefined,
    })
    fetchTypes()
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Betöltés...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Kellékek</h3>
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
          <Plus size={12} />Új kellék
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        A kiadható eszközök katalógusa. Minden kellékhez alkatrészek és egy értéke tartozik — ez kerül a szerződésbe és a kárszámításba. Kivezetni lehet, törölni soha.
      </p>

      {showAdd && (
        <form onSubmit={handleAddType} className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input required value={newType.name} onChange={e => setNewType(n => ({ ...n, name: e.target.value }))}
              placeholder="Név (magyar)" className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
            <input value={newType.nameDE} onChange={e => setNewType(n => ({ ...n, nameDE: e.target.value }))}
              placeholder="Név (német) — ez megy a szerződésbe" className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
            <select value={newType.category} onChange={e => setNewType(n => ({ ...n, category: e.target.value }))}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{ASSET_CATEGORY_LABEL[c]}</option>)}
            </select>
            <input type="number" step="0.01" value={newType.defaultValue} onChange={e => setNewType(n => ({ ...n, defaultValue: e.target.value }))}
              placeholder="Érték (€)" className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
          </div>
          <textarea value={newType.contractAddendumDe} onChange={e => setNewType(n => ({ ...n, contractAddendumDe: e.target.value }))}
            placeholder="Szerződés-kiegészítés (német) — opcionális, csak ehhez a kellékhez" rows={2}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-gray-500 text-sm">Mégse</button>
            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg">Hozzáad</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {types.map(t => (
          <div key={t.id} className={`border rounded-xl overflow-hidden ${t.active ? 'border-gray-100' : 'border-gray-100 bg-gray-50/60'}`}>
            {/* fejléc */}
            <div className="flex items-center gap-3 px-3 py-2.5 bg-white">
              <button onClick={() => toggle(t.id)} className="text-gray-400 hover:text-gray-600">
                {expanded.has(t.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {t.imageUrl
                ? <img src={t.imageUrl} alt="" className="w-9 h-9 rounded object-cover bg-gray-100" />
                : <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center text-gray-300"><Package size={16} /></div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${t.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{t.name}</span>
                  {t.category && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{ASSET_CATEGORY_LABEL[t.category] ?? t.category}</span>}
                  {!t.active && <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">kivezetve</span>}
                </div>
                {t.nameDE && <span className="text-xs text-gray-400">{t.nameDE}</span>}
              </div>
              <span className="text-xs text-gray-400">{t.components.filter(c => c.active).length} alkatrész</span>
              <span className="text-sm text-gray-600 tabular-nums">{euro(t.defaultValue)}</span>
              {t.active ? (
                <>
                  <button onClick={() => { setEditId(t.id); setEditData({ name: t.name, nameDE: t.nameDE ?? '', category: t.category ?? 'other', defaultValue: String(t.defaultValue), imageUrl: t.imageUrl ?? '', contractAddendumDe: t.contractAddendumDe ?? '' }); setExpanded(p => new Set(p).add(t.id)) }}
                    className="text-gray-300 hover:text-blue-500"><Edit2 size={13} /></button>
                  <button onClick={() => setTypeActive(t.id, false)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                </>
              ) : (
                <button onClick={() => setTypeActive(t.id, true)} className="text-gray-300 hover:text-green-600" title="Visszaállítás"><RotateCcw size={13} /></button>
              )}
            </div>

            {/* kinyitott törzs */}
            {expanded.has(t.id) && (
              <div className="border-t border-gray-100 px-3 py-3 bg-gray-50/50 space-y-3">
                {editId === t.id && (
                  <div className="p-3 bg-white rounded-lg border border-gray-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} placeholder="Név (magyar)" className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                      <input value={editData.nameDE} onChange={e => setEditData(d => ({ ...d, nameDE: e.target.value }))} placeholder="Név (német)" className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                      <select value={editData.category} onChange={e => setEditData(d => ({ ...d, category: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
                        {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{ASSET_CATEGORY_LABEL[c]}</option>)}
                      </select>
                      <input type="number" step="0.01" value={editData.defaultValue} onChange={e => setEditData(d => ({ ...d, defaultValue: e.target.value }))} placeholder="Érték (€)" className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <input value={editData.imageUrl} onChange={e => setEditData(d => ({ ...d, imageUrl: e.target.value }))} placeholder="Kép URL (opcionális)" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                    <textarea value={editData.contractAddendumDe} onChange={e => setEditData(d => ({ ...d, contractAddendumDe: e.target.value }))} placeholder="Szerződés-kiegészítés (német)" rows={2} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditId(null)} className="px-3 py-1.5 text-gray-500 text-sm">Mégse</button>
                      <button onClick={() => handleSaveType(t.id)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg">Mentés</button>
                    </div>
                  </div>
                )}
                <ComponentList typeId={t.id} components={t.components} onChange={fetchTypes} />
              </div>
            )}
          </div>
        ))}
        {types.length === 0 && <div className="text-sm text-gray-400 py-6 text-center">Még nincs kellék. Vegyél fel egyet az „Új kellék" gombbal.</div>}
      </div>
    </div>
  )
}

// ─── Alkatrész-lista egy kelléken belül ──────────────────────────────────────

function ComponentList({ typeId, components, onChange }: { typeId: string; components: AssetComponent[]; onChange: () => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyComp)
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState(emptyComp)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    await fetch('/api/asset-components', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, assetTypeId: typeId }),
    })
    setForm(emptyComp)
    setShowAdd(false)
    onChange()
  }

  async function save(id: string) {
    await fetch(`/api/asset-components/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    })
    setEditId(null)
    onChange()
  }

  async function setActive(id: string, active: boolean) {
    if (!active && !confirm('Kivezeti ezt az alkatrészt?')) return
    await fetch(`/api/asset-components/${id}`, {
      method: active ? 'PUT' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: active ? JSON.stringify({ active: true }) : undefined,
    })
    onChange()
  }

  const visible = components
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alkatrészek</span>
        <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
          <Plus size={11} />Új alkatrész
        </button>
      </div>

      {showAdd && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2 mb-2 p-2 bg-white rounded-lg border border-gray-100">
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Név (magyar)" className="flex-1 min-w-[120px] px-2 py-1 border border-gray-200 rounded text-sm" />
          <input value={form.nameDE} onChange={e => setForm(f => ({ ...f, nameDE: e.target.value }))} placeholder="Név (német)" className="flex-1 min-w-[120px] px-2 py-1 border border-gray-200 rounded text-sm" />
          <input type="number" step="0.01" value={form.defaultValue} onChange={e => setForm(f => ({ ...f, defaultValue: e.target.value }))} placeholder="€" className="w-20 px-2 py-1 border border-gray-200 rounded text-sm" />
          <input type="number" value={form.defaultQuantity} onChange={e => setForm(f => ({ ...f, defaultQuantity: e.target.value }))} placeholder="db" className="w-16 px-2 py-1 border border-gray-200 rounded text-sm" />
          <button type="submit" className="px-2.5 py-1 bg-blue-600 text-white text-sm rounded">Hozzáad</button>
          <button type="button" onClick={() => setShowAdd(false)} className="text-gray-400"><X size={14} /></button>
        </form>
      )}

      <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden bg-white">
        {visible.map(c => (
          <div key={c.id} className="flex items-center gap-2 px-3 py-1.5">
            {editId === c.id ? (
              <>
                <input value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm" />
                <input value={editData.nameDE} onChange={e => setEditData(d => ({ ...d, nameDE: e.target.value }))} placeholder="német" className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm" />
                <input type="number" step="0.01" value={editData.defaultValue} onChange={e => setEditData(d => ({ ...d, defaultValue: e.target.value }))} className="w-20 px-2 py-1 border border-gray-200 rounded text-sm" />
                <input type="number" value={editData.defaultQuantity} onChange={e => setEditData(d => ({ ...d, defaultQuantity: e.target.value }))} className="w-16 px-2 py-1 border border-gray-200 rounded text-sm" />
                <button onClick={() => save(c.id)} className="text-green-600"><Check size={14} /></button>
                <button onClick={() => setEditId(null)} className="text-gray-400"><X size={14} /></button>
              </>
            ) : (
              <>
                <span className={`flex-1 text-sm ${c.active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                  {c.name}{c.nameDE ? <span className="text-gray-400"> · {c.nameDE}</span> : null}
                </span>
                {!c.active && <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">kivezetve</span>}
                <span className="text-xs text-gray-400 tabular-nums">{c.defaultQuantity} db</span>
                <span className="text-sm text-gray-600 tabular-nums w-16 text-right">{euro(c.defaultValue)}</span>
                {c.active ? (
                  <>
                    <button onClick={() => { setEditId(c.id); setEditData({ name: c.name, nameDE: c.nameDE ?? '', defaultValue: String(c.defaultValue), defaultQuantity: String(c.defaultQuantity), imageUrl: c.imageUrl ?? '' }) }} className="text-gray-300 hover:text-blue-500"><Edit2 size={12} /></button>
                    <button onClick={() => setActive(c.id, false)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                  </>
                ) : (
                  <button onClick={() => setActive(c.id, true)} className="text-gray-300 hover:text-green-600"><RotateCcw size={12} /></button>
                )}
              </>
            )}
          </div>
        ))}
        {visible.length === 0 && <div className="text-xs text-gray-400 py-3 text-center">Nincs alkatrész.</div>}
      </div>
    </div>
  )
}
