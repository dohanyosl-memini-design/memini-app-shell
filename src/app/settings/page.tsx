'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { KeyRound, CheckCircle2, AlertCircle, Trash2, Plus, Edit2, ChevronUp, ChevronDown, X, Check } from 'lucide-react'
import EmailSequenceTemplateSection from '@/components/EmailSequenceTemplateSection'
import AssetCatalogSection from '@/components/AssetCatalogSection'
import AssetContractTemplateSection from '@/components/AssetContractTemplateSection'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemoryEntryType {
  id: string
  label: string
  icon: string
  color: string
  isSystem: boolean
  order: number
}

interface TemplateType {
  id: string
  label: string
  icon: string
  isSystem: boolean
  order: number
  _count?: { templates: number }
}

interface CommTemplate {
  id: string
  name: string
  typeId: string
  type: TemplateType
  subject: string | null
  bodyHu: string
  description: string | null
  isActive: boolean
  order: number
}

// ─── Password Tab ──────────────────────────────────────────────────────────────

function PasswordTab() {
  const { data: session } = useSession()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    if (form.newPassword !== form.confirmPassword) {
      setResult({ ok: false, message: 'Az új jelszavak nem egyeznek' })
      return
    }
    if (form.newPassword.length < 8) {
      setResult({ ok: false, message: 'A jelszónak legalább 8 karakter kell' })
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    })
    const data = await res.json() as { error?: string }
    setLoading(false)
    if (res.ok) {
      setResult({ ok: true, message: 'Jelszó sikeresen megváltoztatva' })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } else {
      setResult({ ok: false, message: data.error || 'Hiba történt' })
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-lg">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
          {session?.user?.name?.[0] ?? '?'}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{session?.user?.name}</p>
          <p className="text-sm text-gray-500">{session?.user?.email}</p>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={16} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800">Jelszó módosítása</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jelenlegi jelszó</label>
            <input
              type="password"
              required
              value={form.currentPassword}
              onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Új jelszó</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.newPassword}
              onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Új jelszó megerősítése</label>
            <input
              type="password"
              required
              value={form.confirmPassword}
              onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {result.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {result.message}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? 'Mentés...' : 'Jelszó módosítása'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Memory Types Section ──────────────────────────────────────────────────────

function MemoryTypesSection() {
  const [types, setTypes] = useState<MemoryEntryType[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newType, setNewType] = useState({ label: '', icon: '', color: 'gray' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ label: '', icon: '', color: '' })

  const fetchTypes = useCallback(async () => {
    const res = await fetch('/api/memory-types')
    if (res.ok) setTypes(await res.json() as MemoryEntryType[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTypes() }, [fetchTypes])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/memory-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newType),
    })
    setNewType({ label: '', icon: '', color: 'gray' })
    setShowAdd(false)
    fetchTypes()
  }

  async function handleEdit(id: string) {
    await fetch(`/api/memory-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    })
    setEditId(null)
    fetchTypes()
  }

  async function handleDelete(id: string) {
    if (!confirm('Törli ezt a memória típust?')) return
    await fetch(`/api/memory-types/${id}`, { method: 'DELETE' })
    fetchTypes()
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Betöltés...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Memória típusok</h3>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} />Új típus
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="flex items-end gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ikon</label>
            <input
              type="text"
              required
              value={newType.icon}
              onChange={e => setNewType(n => ({ ...n, icon: e.target.value }))}
              placeholder="🏷️"
              className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Felirat</label>
            <input
              type="text"
              required
              value={newType.label}
              onChange={e => setNewType(n => ({ ...n, label: e.target.value }))}
              placeholder="Pl. Személyes"
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Szín</label>
            <select
              value={newType.color}
              onChange={e => setNewType(n => ({ ...n, color: e.target.value }))}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
            >
              {['gray','blue','green','red','amber','purple','pink'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg">Hozzáad</button>
          <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-gray-500 text-sm">
            <X size={14} />
          </button>
        </form>
      )}

      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
        {types.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 bg-white">
            <span className="text-lg w-8 text-center">{t.icon}</span>
            {editId === t.id ? (
              <>
                <input
                  type="text"
                  value={editData.icon}
                  onChange={e => setEditData(d => ({ ...d, icon: e.target.value }))}
                  className="w-12 px-2 py-1 border border-gray-200 rounded text-sm"
                />
                <input
                  type="text"
                  value={editData.label}
                  onChange={e => setEditData(d => ({ ...d, label: e.target.value }))}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                />
                <button onClick={() => handleEdit(t.id)} className="text-green-600 hover:text-green-700">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-900">{t.label}</span>
                {t.isSystem && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">rendszer</span>}
                <button
                  onClick={() => { setEditId(t.id); setEditData({ label: t.label, icon: t.icon, color: t.color }) }}
                  className="text-gray-300 hover:text-blue-500 transition-colors"
                >
                  <Edit2 size={13} />
                </button>
                {!t.isSystem && (
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Template Types Section ────────────────────────────────────────────────────

function TemplateTypesSection() {
  const [types, setTypes] = useState<TemplateType[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newType, setNewType] = useState({ label: '', icon: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ label: '', icon: '' })

  const fetchTypes = useCallback(async () => {
    const res = await fetch('/api/template-types')
    if (res.ok) setTypes(await res.json() as TemplateType[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTypes() }, [fetchTypes])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/template-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newType),
    })
    setNewType({ label: '', icon: '' })
    setShowAdd(false)
    fetchTypes()
  }

  async function handleEdit(id: string) {
    await fetch(`/api/template-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    })
    setEditId(null)
    fetchTypes()
  }

  async function handleDelete(id: string) {
    if (!confirm('Törli ezt a sablon típust?')) return
    const res = await fetch(`/api/template-types/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      alert(data.error ?? 'Hiba')
      return
    }
    fetchTypes()
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Betöltés...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Sablon típusok</h3>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} />Új típus
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="flex items-end gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ikon</label>
            <input
              type="text"
              required
              value={newType.icon}
              onChange={e => setNewType(n => ({ ...n, icon: e.target.value }))}
              placeholder="📧"
              className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Felirat</label>
            <input
              type="text"
              required
              value={newType.label}
              onChange={e => setNewType(n => ({ ...n, label: e.target.value }))}
              placeholder="Pl. LinkedIn"
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg">Hozzáad</button>
          <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-gray-500 text-sm">
            <X size={14} />
          </button>
        </form>
      )}

      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
        {types.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 bg-white">
            <span className="text-lg w-8 text-center">{t.icon}</span>
            {editId === t.id ? (
              <>
                <input
                  type="text"
                  value={editData.icon}
                  onChange={e => setEditData(d => ({ ...d, icon: e.target.value }))}
                  className="w-12 px-2 py-1 border border-gray-200 rounded text-sm"
                />
                <input
                  type="text"
                  value={editData.label}
                  onChange={e => setEditData(d => ({ ...d, label: e.target.value }))}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                />
                <button onClick={() => handleEdit(t.id)} className="text-green-600 hover:text-green-700">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-900">{t.label}</span>
                {t._count && <span className="text-xs text-gray-400">{t._count.templates} sablon</span>}
                {t.isSystem && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">rendszer</span>}
                <button
                  onClick={() => { setEditId(t.id); setEditData({ label: t.label, icon: t.icon }) }}
                  className="text-gray-300 hover:text-blue-500 transition-colors"
                >
                  <Edit2 size={13} />
                </button>
                {!t.isSystem && (
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Templates Section ─────────────────────────────────────────────────────────

function TemplatesSection() {
  const [templates, setTemplates] = useState<CommTemplate[]>([])
  const [types, setTypes] = useState<TemplateType[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', typeId: '', subject: '', bodyHu: '', description: '', isActive: true,
  })
  const [editForm, setEditForm] = useState({
    name: '', typeId: '', subject: '', bodyHu: '', description: '', isActive: true,
  })

  const fetchAll = useCallback(async () => {
    const [tRes, ttRes] = await Promise.all([
      fetch('/api/templates'),
      fetch('/api/template-types'),
    ])
    if (tRes.ok) setTemplates(await tRes.json() as CommTemplate[])
    if (ttRes.ok) {
      const data = await ttRes.json() as TemplateType[]
      setTypes(data)
      if (data.length > 0) setForm(f => ({ ...f, typeId: data[0].id }))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        typeId: form.typeId,
        subject: form.subject || null,
        bodyHu: form.bodyHu,
        description: form.description || null,
        isActive: form.isActive,
      }),
    })
    setForm({ name: '', typeId: types[0]?.id ?? '', subject: '', bodyHu: '', description: '', isActive: true })
    setShowAdd(false)
    fetchAll()
  }

  async function handleEdit(id: string) {
    await fetch(`/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        typeId: editForm.typeId,
        subject: editForm.subject || null,
        bodyHu: editForm.bodyHu,
        description: editForm.description || null,
        isActive: editForm.isActive,
      }),
    })
    setEditId(null)
    fetchAll()
  }

  async function handleDelete(id: string) {
    if (!confirm('Törli ezt a sablont?')) return
    await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  async function handleReorder(id: string, direction: 'up' | 'down') {
    const allTemplates = [...templates]
    const idx = allTemplates.findIndex(t => t.id === id)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= allTemplates.length) return
    const current = allTemplates[idx]
    const swap = allTemplates[swapIdx]
    await Promise.all([
      fetch(`/api/templates/${current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...current, order: swap.order }),
      }),
      fetch(`/api/templates/${swap.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...swap, order: current.order }),
      }),
    ])
    fetchAll()
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Betöltés...</div>

  // Group by type
  const grouped = templates.reduce<Record<string, CommTemplate[]>>((acc, tmpl) => {
    const key = tmpl.typeId
    if (!acc[key]) acc[key] = []
    acc[key].push(tmpl)
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Sablonok</h3>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} />Új sablon
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Név *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                placeholder="Sablon neve"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Típus *</label>
              <select
                value={form.typeId}
                onChange={e => setForm(f => ({ ...f, typeId: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
              >
                {types.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tárgy (email esetén)</label>
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
              placeholder="Email tárgy..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Magyar szöveg *</label>
            <textarea
              required
              rows={5}
              value={form.bodyHu}
              onChange={e => setForm(f => ({ ...f, bodyHu: e.target.value }))}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm resize-y"
              placeholder="Sablon szövege... Használd: {cegnev}, {kapcsolattarto_neve}, {varos}, {utolso_rendeles_datuma}"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Leírás</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
              placeholder="Rövid leírás..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg">Mégse</button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg">Mentés</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([typeId, group]) => {
          const typeInfo = group[0].type
          return (
            <div key={typeId}>
              <div className="flex items-center gap-2 mb-2">
                <span>{typeInfo.icon}</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{typeInfo.label}</span>
              </div>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {group.map((tmpl, idx) => (
                  <div key={tmpl.id} className="bg-white">
                    {editId === tmpl.id ? (
                      <div className="p-4 space-y-3 bg-blue-50">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                            placeholder="Név"
                          />
                          <select
                            value={editForm.typeId}
                            onChange={e => setEditForm(f => ({ ...f, typeId: e.target.value }))}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                          >
                            {types.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                          </select>
                        </div>
                        <input
                          type="text"
                          value={editForm.subject}
                          onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                          placeholder="Tárgy (email)"
                        />
                        <textarea
                          rows={5}
                          value={editForm.bodyHu}
                          onChange={e => setEditForm(f => ({ ...f, bodyHu: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm resize-y"
                        />
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                          placeholder="Leírás"
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditId(null)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600">Mégse</button>
                          <button onClick={() => handleEdit(tmpl.id)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg">Mentés</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 px-4 py-3 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{tmpl.name}</p>
                          {tmpl.subject && <p className="text-xs text-gray-500">Tárgy: {tmpl.subject}</p>}
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{tmpl.bodyHu.slice(0, 80)}...</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleReorder(tmpl.id, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20"
                          >
                            <ChevronUp size={13} />
                          </button>
                          <button
                            onClick={() => handleReorder(tmpl.id, 'down')}
                            disabled={idx === group.length - 1}
                            className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20"
                          >
                            <ChevronDown size={13} />
                          </button>
                          <button
                            onClick={() => {
                              setEditId(tmpl.id)
                              setEditForm({
                                name: tmpl.name,
                                typeId: tmpl.typeId,
                                subject: tmpl.subject ?? '',
                                bodyHu: tmpl.bodyHu,
                                description: tmpl.description ?? '',
                                isActive: tmpl.isActive,
                              })
                            }}
                            className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(tmpl.id)}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {templates.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Nincs sablon. Kattints az „Új sablon" gombra.</p>
        )}
      </div>
    </div>
  )
}

// ─── Kommunikáció Tab ──────────────────────────────────────────────────────────

function KommunikacioTab() {
  const [seeding, setSeeding] = useState(false)
  const [seeded, setSeeded] = useState(false)

  async function handleSeed() {
    setSeeding(true)
    await fetch('/api/seed/comm-defaults', { method: 'POST' })
    setSeeding(false)
    setSeeded(true)
    setTimeout(() => setSeeded(false), 3000)
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Kezeld a kommunikációs sablonokat és a memória típusokat.
        </p>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {seeded ? <Check size={12} className="text-green-500" /> : null}
          {seeding ? 'Inicializálás...' : seeded ? 'Kész!' : '⚡ Alapértelmezések betöltése'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-2">
        <TemplateTypesSection />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <TemplatesSection />
      </div>

      <div id="email-sorozat" className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <EmailSequenceTemplateSection />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-2">
        <MemoryTypesSection />
      </div>
    </div>
  )
}

// ─── Eszközök Tab ──────────────────────────────────────────────────────────────

function EszkozokTab() {
  return (
    <div className="max-w-3xl space-y-8">
      <p className="text-sm text-gray-500">
        A partnereknek kiadható kellékek és alkatrészeik katalógusa. Ezekből választasz átadáskor a partner oldalán.
      </p>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <AssetCatalogSection />
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <AssetContractTemplateSection />
      </div>
    </div>
  )
}

// ─── Main Settings Page ────────────────────────────────────────────────────────

type SettingsTab = 'password' | 'kommunikacio' | 'eszkozok'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('password')

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Beállítások</h1>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {([
          { key: 'password', label: '🔑 Fiók' },
          { key: 'kommunikacio', label: '✉️ Kommunikáció' },
          { key: 'eszkozok', label: '📦 Eszközök' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'password' && <PasswordTab />}
      {activeTab === 'kommunikacio' && <KommunikacioTab />}
      {activeTab === 'eszkozok' && <EszkozokTab />}
    </div>
  )
}
