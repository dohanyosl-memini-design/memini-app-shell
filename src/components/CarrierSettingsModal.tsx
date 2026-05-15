'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react'

interface Carrier {
  id: string
  code: string
  name: string
  nameDE: string | null
  group: string | null
  sortOrder: number
}

interface EditRow {
  code: string
  name: string
  nameDE: string
  group: string
}

export default function CarrierSettingsModal({ onClose }: { onClose: () => void }) {
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<EditRow>({ code: '', name: '', nameDE: '', group: '' })
  const [addingNew, setAddingNew] = useState(false)
  const [newRow, setNewRow] = useState<EditRow>({ code: '', name: '', nameDE: '', group: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/carriers')
    setCarriers(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(c: Carrier) {
    setEditId(c.id)
    setEditRow({ code: c.code, name: c.name, nameDE: c.nameDE || '', group: c.group || '' })
    setAddingNew(false)
  }

  function cancelEdit() {
    setEditId(null)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await fetch(`/api/carriers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editRow),
    })
    setSaving(false)
    setEditId(null)
    load()
  }

  async function saveNew() {
    if (!newRow.code.trim() || !newRow.name.trim()) return
    setSaving(true)
    await fetch('/api/carriers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRow),
    })
    setSaving(false)
    setAddingNew(false)
    setNewRow({ code: '', name: '', nameDE: '', group: '' })
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Biztosan törölni szeretné: „${name}"?`)) return
    await fetch(`/api/carriers/${id}`, { method: 'DELETE' })
    load()
  }

  const groups = Array.from(new Set(carriers.map(c => c.group).filter(Boolean) as string[]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          A hordozók megjelennek a termékeken, megrendelőn, raktárban és árajánlatokban.
        </p>
        <button
          onClick={() => { setAddingNew(true); setEditId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} />
          Új hordozó
        </button>
      </div>

      {loading ? (
        <p className="text-center py-8 text-gray-400">Betöltés...</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase w-24">ID / Kód</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Magyar név</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Német név</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase w-32">Csoport</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {carriers.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${editId === c.id ? 'bg-blue-50' : ''}`}>
                  {editId === c.id ? (
                    <>
                      <td className="px-3 py-2">
                        <input
                          value={editRow.code}
                          onChange={e => setEditRow({ ...editRow, code: e.target.value })}
                          className="w-full px-2 py-1 border border-blue-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editRow.name}
                          onChange={e => setEditRow({ ...editRow, name: e.target.value })}
                          className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editRow.nameDE}
                          onChange={e => setEditRow({ ...editRow, nameDE: e.target.value })}
                          placeholder="Deutsch"
                          className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          list="group-list"
                          value={editRow.group}
                          onChange={e => setEditRow({ ...editRow, group: e.target.value })}
                          placeholder="pl. Kő"
                          className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <datalist id="group-list">
                          {groups.map(g => <option key={g} value={g} />)}
                        </datalist>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveEdit(c.id)} disabled={saving}
                            className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors">
                            <Check size={14} />
                          </button>
                          <button onClick={cancelEdit}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{c.code}</span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{c.nameDE || <span className="text-gray-300 italic">—</span>}</td>
                      <td className="px-4 py-2.5">
                        {c.group ? (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{c.group}</span>
                        ) : (
                          <span className="text-gray-300 italic text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(c)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDelete(c.id, c.name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {/* Új sor hozzáadása */}
              {addingNew && (
                <tr className="bg-green-50 border-t-2 border-green-200">
                  <td className="px-3 py-2">
                    <input
                      autoFocus
                      value={newRow.code}
                      onChange={e => setNewRow({ ...newRow, code: e.target.value })}
                      placeholder="pl. 1 vagy ko_uj"
                      className="w-full px-2 py-1 border border-green-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={newRow.name}
                      onChange={e => setNewRow({ ...newRow, name: e.target.value })}
                      placeholder="Magyar megnevezés *"
                      className="w-full px-2 py-1 border border-green-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={newRow.nameDE}
                      onChange={e => setNewRow({ ...newRow, nameDE: e.target.value })}
                      placeholder="Deutsch Bezeichnung"
                      className="w-full px-2 py-1 border border-green-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      list="group-list-new"
                      value={newRow.group}
                      onChange={e => setNewRow({ ...newRow, group: e.target.value })}
                      placeholder="Csoport"
                      className="w-full px-2 py-1 border border-green-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <datalist id="group-list-new">
                      {groups.map(g => <option key={g} value={g} />)}
                    </datalist>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={saveNew} disabled={saving || !newRow.code.trim() || !newRow.name.trim()}
                        className="p-1.5 text-green-600 hover:bg-green-200 rounded transition-colors disabled:opacity-40">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setAddingNew(false)}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">
          Bezárás
        </button>
      </div>
    </div>
  )
}
