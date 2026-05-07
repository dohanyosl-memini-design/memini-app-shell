'use client'

import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'

interface Contact { id: string; firstName: string; lastName: string }
interface Company { id: string; name: string }
interface AppUser { id: string; name: string }

export const TASK_TYPES = [
  { value: 'gyartas',     label: 'Gyártás',        icon: '🏭', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'email',       label: 'Email',           icon: '📧', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'minta',       label: 'Mintakészítés',   icon: '🎨', color: 'bg-pink-100 text-pink-700 border-pink-300' },
  { value: 'csomagolas',  label: 'Csomagolás',      icon: '📦', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'hivas',       label: 'Telefonhívás',    icon: '📞', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'admin',       label: 'Adminisztráció',  icon: '📋', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'szallitas',   label: 'Szállítás',       icon: '🚚', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'megbeszeles', label: 'Megbeszélés',     icon: '💬', color: 'bg-teal-100 text-teal-700 border-teal-300' },
  { value: 'egyeb',       label: 'Egyéb',           icon: '⭐', color: 'bg-gray-100 text-gray-600 border-gray-200' },
]

interface TaskData {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  status: string
  priority: string
  taskType: string | null
  assigneeId: string | null
  contactId: string | null
  companyId: string | null
  dealId: string | null
}

interface TaskFormProps {
  task: TaskData | null
  defaultStatus?: string
  onSave: () => void
  onCancel: () => void
}

export default function TaskForm({ task, defaultStatus = 'pending', onSave, onCancel }: TaskFormProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')
  const [subtasks, setSubtasks] = useState<string[]>([])

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : '',
    status: task?.status || defaultStatus,
    priority: task?.priority || 'medium',
    taskType: task?.taskType || '',
    assigneeId: task?.assigneeId || '',
    contactId: task?.contactId || '',
    companyId: task?.companyId || '',
    dealId: task?.dealId || '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/contacts').then((r) => r.json()),
      fetch('/api/companies').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
    ]).then(([c, co, u]) => { setContacts(c); setCompanies(co); setUsers(u) })
  }, [])

  function addSubtask() {
    if (!newSubtask.trim()) return
    setSubtasks([...subtasks, newSubtask.trim()])
    setNewSubtask('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const method = task ? 'PUT' : 'POST'
    const url = task ? `/api/tasks/${task.id}` : '/api/tasks'

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, subtasks }),
    })

    setLoading(false)
    onSave()
  }

  const selectedType = TASK_TYPES.find(t => t.value === form.taskType)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Feladat típusa */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Feladat típusa</label>
        <div className="grid grid-cols-3 gap-2">
          {TASK_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm({ ...form, taskType: form.taskType === t.value ? '' : t.value })}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                form.taskType === t.value
                  ? t.color + ' ring-2 ring-offset-1 ring-current'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span>{t.icon}</span>
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cím */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Feladat neve *</label>
        <input
          required
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={selectedType ? `${selectedType.icon} ${selectedType.label}...` : 'pl. Ulmi Münster – 200 db gyártás'}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Cég + Ügyfél */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cég</label>
          <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="">—</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kapcsolattartó</label>
          <select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="">—</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
      </div>

      {/* Felelős + Prioritás + Határidő */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Felelős</label>
          <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="">—</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prioritás</label>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="low">🟢 Alacsony</option>
            <option value="medium">🟡 Közepes</option>
            <option value="high">🔴 Magas</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Határidő</label>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </div>

      {/* Leírás */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Leírás / Részletek</label>
        <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Részletek, instrukciók..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm" />
      </div>

      {/* Alfeladatok — csak új feladatnál */}
      {!task && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Alfeladatok</label>
          <div className="space-y-1.5 mb-2">
            {subtasks.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                <span className="flex-1 text-gray-700">{s}</span>
                <button type="button" onClick={() => setSubtasks(subtasks.filter((_, j) => j !== i))}
                  className="text-gray-400 hover:text-red-500"><X size={13} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask() } }}
              placeholder="Alfeladat hozzáadása..."
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            <button type="button" onClick={addSubtask}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Mégse</button>
        <button type="submit" disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Mentés...' : task ? 'Módosítás' : 'Feladat létrehozása'}
        </button>
      </div>
    </form>
  )
}
