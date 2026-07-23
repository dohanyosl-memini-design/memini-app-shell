'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, X, CheckSquare, Square } from 'lucide-react'
import { GOAL_LEVEL_LABELS, goalPeriodLabel } from '@/lib/goalConstants'
import { dueHasTime } from '@/lib/datetime'

const pad = (n: number) => String(n).padStart(2, '0')

interface Contact { id: string; firstName: string; lastName: string }
interface Company { id: string; name: string }
interface AppUser { id: string; name: string }
interface SubTask { id: string; title: string; completed: boolean }
interface GoalOption { id: string; title: string; level: string; year: number | null; quarter: number | null; month: number | null }

export const TASK_STATUSES = [
  { value: 'pending',     label: 'Várakozó' },
  { value: 'in_progress', label: 'Folyamatban' },
  { value: 'waiting',     label: 'Várakozik (külső félre)' },
  { value: 'completed',   label: 'Kész' },
]

export const TASK_TYPES = [
  { value: 'gyartas',     label: 'Gyártás',        icon: '🏭', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'email',       label: 'Email',           icon: '📧', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'minta',       label: 'Mintakészítés',   icon: '🎨', color: 'bg-pink-100 text-pink-700 border-pink-300' },
  { value: 'csomagolas',  label: 'Csomagolás',      icon: '📦', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'hivas',       label: 'Telefonhívás',    icon: '📞', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'admin',       label: 'Adminisztráció',  icon: '📋', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'szallitas',   label: 'Szállítás',       icon: '🚚', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'megbeszeles', label: 'Megbeszélés',     icon: '💬', color: 'bg-teal-100 text-teal-700 border-teal-300' },
  { value: 'szamlairas',  label: 'Számlaírás',      icon: '🧾', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
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
  goalId?: string | null
  waitingFor?: string | null
  followUpAt?: string | null
  assigneeId: string | null
  contactId: string | null
  companyId: string | null
  dealId: string | null
  subtasks?: SubTask[]
}

interface TaskFormProps {
  task: TaskData | null
  defaultStatus?: string
  defaultCompanyId?: string
  defaultContactId?: string
  defaultGoalId?: string
  onSave: () => void
  onCancel: () => void
}

export default function TaskForm({ task, defaultStatus = 'pending', defaultCompanyId, defaultContactId, defaultGoalId, onSave, onCancel }: TaskFormProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [goals, setGoals] = useState<GoalOption[]>([])
  const [loading, setLoading] = useState(false)

  // Existing subtasks (edit mode) — managed with immediate API calls
  const [existingSubtasks, setExistingSubtasks] = useState<SubTask[]>(task?.subtasks ?? [])
  // Pending subtasks (create mode) — batched on submit
  const [pendingSubtasks, setPendingSubtasks] = useState<string[]>([])
  const [subtaskInput, setSubtaskInput] = useState('')
  const subtaskRef = useRef<HTMLInputElement>(null)

  const initDue = task?.dueDate ? new Date(task.dueDate) : null
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    dueDate: initDue ? `${initDue.getFullYear()}-${pad(initDue.getMonth() + 1)}-${pad(initDue.getDate())}` : '',
    dueTime: initDue && dueHasTime(initDue) ? `${pad(initDue.getHours())}:${pad(initDue.getMinutes())}` : '',
    status: task?.status || defaultStatus,
    priority: task?.priority || 'medium',
    taskType: task?.taskType || '',
    goalId: task?.goalId || defaultGoalId || '',
    waitingFor: task?.waitingFor || '',
    followUpAt: task?.followUpAt ? task.followUpAt.slice(0, 10) : '',
    assigneeId: task?.assigneeId || '',
    contactId: task?.contactId || defaultContactId || '',
    companyId: task?.companyId || defaultCompanyId || '',
    dealId: task?.dealId || '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/contacts').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/goals?status=active').then(r => r.json()),
    ]).then(([c, co, u, g]) => { setContacts(c); setCompanies(co); setUsers(u); setGoals(g) })
  }, [])

  async function handleAddSubtask() {
    const title = subtaskInput.trim()
    if (!title) return

    if (task) {
      // Edit mode: save to API immediately so it gets an ID
      const res = await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (res.ok) {
        const created = await res.json()
        setExistingSubtasks(prev => [...prev, created])
      }
    } else {
      setPendingSubtasks(prev => [...prev, title])
    }
    setSubtaskInput('')
    subtaskRef.current?.focus()
  }

  async function toggleExistingSubtask(id: string) {
    const updated = existingSubtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s)
    setExistingSubtasks(updated)
    await fetch(`/api/subtasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: updated.find(s => s.id === id)?.completed }),
    })
  }

  async function deleteExistingSubtask(id: string) {
    setExistingSubtasks(prev => prev.filter(s => s.id !== id))
    await fetch(`/api/subtasks/${id}`, { method: 'DELETE' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const method = task ? 'PUT' : 'POST'
    const url = task ? `/api/tasks/${task.id}` : '/api/tasks'

    // Ha van időpont, teljes ISO-instant (helyi böngésző-időzóna); különben csak nap.
    const duePayload = form.dueDate
      ? (form.dueTime ? new Date(`${form.dueDate}T${form.dueTime}`).toISOString() : form.dueDate)
      : ''

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, dueDate: duePayload, subtasks: pendingSubtasks }),
    })

    setLoading(false)
    onSave()
  }

  const selectedType = TASK_TYPES.find(t => t.value === form.taskType)
  const allSubtasks = task ? existingSubtasks : pendingSubtasks.map((t, i) => ({ id: String(i), title: t, completed: false }))
  const doneCount = existingSubtasks.filter(s => s.completed).length

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Feladat típusa */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Feladat típusa</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {TASK_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm({ ...form, taskType: form.taskType === t.value ? '' : t.value })}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
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

      {/* Leírás — nagyobb mező */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Leírás / Részletek</label>
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Részletek, instrukciók, megjegyzések..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm leading-relaxed"
        />
      </div>

      {/* Cél + Státusz */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">🎯 Cél</label>
          <select
            value={form.goalId}
            onChange={(e) => setForm({ ...form, goalId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">— nincs célhoz kötve (operatív) —</option>
            {(['monthly', 'quarterly', 'yearly', 'vision'] as const).map(level => {
              const opts = goals.filter(g => g.level === level)
              if (opts.length === 0) return null
              return (
                <optgroup key={level} label={GOAL_LEVEL_LABELS[level]}>
                  {opts.map(g => (
                    <option key={g.id} value={g.id}>
                      {goalPeriodLabel(g) ? `[${goalPeriodLabel(g)}] ` : ''}{g.title}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Státusz</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            {task?.status === 'cancelled' && <option value="cancelled">Törölve</option>}
          </select>
        </div>
      </div>

      {/* Várakozás részletei */}
      {form.status === 'waiting' && (
        <div className="grid grid-cols-2 gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div>
            <label className="block text-sm font-medium text-amber-800 mb-1">Kire / mire várunk? *</label>
            <input
              required
              type="text"
              value={form.waitingFor}
              onChange={(e) => setForm({ ...form, waitingFor: e.target.value })}
              placeholder="pl. Nicole Hemmler válasza a mintacsomagra"
              className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-amber-800 mb-1">Mikor nézzük újra? *</label>
            <input
              required
              type="date"
              value={form.followUpAt}
              onChange={(e) => setForm({ ...form, followUpAt: e.target.value })}
              className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white"
            />
          </div>
        </div>
      )}

      {/* Alfeladatok */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Alfeladatok
            {task && existingSubtasks.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">{doneCount}/{existingSubtasks.length} kész</span>
            )}
          </label>
        </div>

        {/* Progress bar (edit mode only) */}
        {task && existingSubtasks.length > 0 && (
          <div className="w-full bg-gray-100 rounded-full h-1 mb-3">
            <div
              className="bg-green-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${(doneCount / existingSubtasks.length) * 100}%` }}
            />
          </div>
        )}

        {/* Existing subtasks (edit) or pending (create) */}
        {allSubtasks.length > 0 && (
          <div className="space-y-1 mb-2">
            {allSubtasks.map((s) => (
              <div key={s.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 group transition-colors ${
                s.completed ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'
              }`}>
                {task ? (
                  <button
                    type="button"
                    onClick={() => toggleExistingSubtask(s.id)}
                    className="shrink-0 text-gray-400 hover:text-green-600 transition-colors"
                  >
                    {s.completed
                      ? <CheckSquare size={15} className="text-green-500" />
                      : <Square size={15} />
                    }
                  </button>
                ) : (
                  <Square size={15} className="shrink-0 text-gray-300" />
                )}
                <span className={`flex-1 text-sm leading-snug ${s.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {s.title}
                </span>
                {task ? (
                  <button
                    type="button"
                    onClick={() => deleteExistingSubtask(s.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                  >
                    <X size={13} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingSubtasks(prev => prev.filter((_, i) => String(i) !== s.id))}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add input */}
        <div className="flex gap-2">
          <input
            ref={subtaskRef}
            type="text"
            value={subtaskInput}
            onChange={(e) => setSubtaskInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask() } }}
            placeholder="Alfeladat hozzáadása… (Enter)"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            type="button"
            onClick={handleAddSubtask}
            className="px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-gray-500 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Cég + Ügyfél */}
      <div className="grid grid-cols-2 gap-3">
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
      <div className="grid grid-cols-3 gap-3">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Határidő {form.dueTime && <span className="text-xs font-normal text-gray-400">(idővel)</span>}</label>
          <div className="flex gap-1.5">
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            <input type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
              disabled={!form.dueDate} title="Pontos időpont (opcionális)"
              className="w-[86px] shrink-0 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm">
          Mégse
        </button>
        <button type="submit" disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm">
          {loading ? 'Mentés...' : task ? 'Módosítás' : 'Feladat létrehozása'}
        </button>
      </div>
    </form>
  )
}
