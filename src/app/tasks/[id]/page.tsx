'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Trash2, Calendar, User, Building2,
  CheckSquare, Square, Clock, Flag, Tag, Plus, X,
  Target, Hourglass, History, ArrowUpRight, Bot,
} from 'lucide-react'
import Modal from '@/components/Modal'
import TaskForm, { TASK_TYPES } from '@/components/TaskForm'
import { GOAL_LEVEL_LABELS } from '@/lib/goalConstants'
import { format, isPast, isToday, isTomorrow } from 'date-fns'
import { hu } from 'date-fns/locale'
import { dueHasTime } from '@/lib/datetime'

interface SubTask { id: string; title: string; completed: boolean }

interface TaskEvent {
  id: string
  actor: string
  action: string
  field: string | null
  before: unknown
  after: unknown
  createdAt: string
}

interface Task {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  status: string
  priority: string
  taskType: string | null
  source: string
  waitingFor: string | null
  followUpAt: string | null
  goal: { id: string; title: string; level: string } | null
  assignee: { id: string; name: string } | null
  contact: { id: string; firstName: string; lastName: string; email: string | null } | null
  company: { id: string; name: string } | null
  deal: { id: string; title: string } | null
  subtasks: SubTask[]
  events: TaskEvent[]
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Várakozó',    color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'Folyamatban', color: 'bg-blue-100 text-blue-700' },
  waiting:     { label: 'Várakozik',   color: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'Kész',        color: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Törölve',     color: 'bg-red-100 text-red-600' },
}

const EVENT_FIELD_LABELS: Record<string, string> = {
  title: 'Cím',
  status: 'Státusz',
  priority: 'Prioritás',
  dueDate: 'Határidő',
  assigneeId: 'Felelős',
  goalId: 'Cél',
  waitingFor: 'Várakozás',
  followUpAt: 'Követési dátum',
  description: 'Leírás',
}

function formatEventValue(field: string | null, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const s = String(value)
  if (field === 'status') return STATUS_CONFIG[s]?.label ?? s
  if (field === 'priority') return { high: 'Magas', medium: 'Közepes', low: 'Alacsony' }[s] ?? s
  if ((field === 'dueDate' || field === 'followUpAt') && /^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return format(new Date(s), 'yyyy. MM. dd.')
  }
  return s.length > 60 ? s.slice(0, 57) + '…' : s
}

function eventText(e: TaskEvent): string {
  if (e.action === 'created') return 'létrehozta a feladatot'
  if (e.action === 'subtask_promoted') return `alfeladatot önálló feladattá léptetett elő: „${formatEventValue(null, e.before)}"`
  const fieldLabel = e.field ? (EVENT_FIELD_LABELS[e.field] ?? e.field) : 'mező'
  return `${fieldLabel}: ${formatEventValue(e.field, e.before)} → ${formatEventValue(e.field, e.after)}`
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  high:   { label: 'Magas',   color: 'text-red-600 bg-red-50 border-red-200',    icon: '🔴' },
  medium: { label: 'Közepes', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: '🟡' },
  low:    { label: 'Alacsony', color: 'text-gray-500 bg-gray-50 border-gray-200',  icon: '🟢' },
}

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [subtasks, setSubtasks] = useState<SubTask[]>([])
  const [newSubtaskInput, setNewSubtaskInput] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)

  useEffect(() => {
    fetch(`/api/tasks/${id}`)
      .then(r => r.json())
      .then(data => {
        setTask(data)
        setSubtasks(data.subtasks || [])
        setLoading(false)
      })
  }, [id])

  async function toggleSubtask(subtaskId: string) {
    const updated = subtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    )
    setSubtasks(updated)
    await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: updated.find(s => s.id === subtaskId)?.completed }),
    })
  }

  async function deleteSubtask(subtaskId: string) {
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId))
    await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' })
  }

  async function promoteSubtask(subtaskId: string, title: string) {
    if (!confirm(`Önálló feladattá alakítod: „${title}"? Az alfeladat átkerül a feladattáblára, örökli a cél- és cégkapcsolatot.`)) return
    const res = await fetch(`/api/subtasks/${subtaskId}/promote`, { method: 'POST' })
    if (res.ok) {
      const created = await res.json()
      setSubtasks(prev => prev.filter(s => s.id !== subtaskId))
      router.push(`/tasks/${created.id}`)
    }
  }

  async function addSubtask() {
    const title = newSubtaskInput.trim()
    if (!title) return
    setAddingSubtask(true)
    const res = await fetch(`/api/tasks/${id}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (res.ok) {
      const created = await res.json()
      setSubtasks(prev => [...prev, created])
      setNewSubtaskInput('')
    }
    setAddingSubtask(false)
  }

  async function handleDelete() {
    if (!confirm('Biztosan törli ezt a feladatot?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    router.push('/tasks')
  }

  function handleSave() {
    setShowModal(false)
    fetch(`/api/tasks/${id}`).then(r => r.json()).then(data => {
      setTask(data)
      setSubtasks(data.subtasks || [])
    })
  }

  if (loading) return <div className="p-6 text-center text-gray-400">Betöltés...</div>
  if (!task) return <div className="p-6 text-center text-gray-400">Feladat nem található.</div>

  const statusCfg = STATUS_CONFIG[task.status] ?? { label: task.status, color: 'bg-gray-100 text-gray-600' }
  const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
  const typeInfo = TASK_TYPES.find(t => t.value === task.taskType)
  const doneSubtasks = subtasks.filter(s => s.completed).length

  const dueLabel = (() => {
    if (!task.dueDate) return null
    const d = new Date(task.dueDate)
    const t = dueHasTime(d) ? ` ${format(d, 'HH:mm')}` : ''
    if (isPast(d) && !isToday(d)) return { text: `Lejárt: ${format(d, 'yyyy. MM. dd.')}${t}`, cls: 'text-red-600' }
    if (isToday(d)) return { text: dueHasTime(d) ? `Ma esedékes – ${format(d, 'HH:mm')}` : 'Ma esedékes', cls: 'text-red-600 font-semibold' }
    if (isTomorrow(d)) return { text: `Holnap (${format(d, 'MM. dd.')})${t}`, cls: 'text-amber-600' }
    return { text: `${format(d, 'yyyy. MMMM d.', { locale: hu })}${t}`, cls: 'text-gray-700' }
  })()

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Vissza
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Edit2 size={15} />
            Szerkesztés
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors text-sm"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Title + badges */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityCfg.color}`}>
            <Flag size={10} />
            {priorityCfg.label}
          </span>
          {typeInfo && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeInfo.color}`}>
              {typeInfo.icon} {typeInfo.label}
            </span>
          )}
          {task.source !== 'human' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
              <Bot size={10} />
              {task.source === 'agent' ? 'Agent hozta létre' : 'Automatizáció'}
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-gray-900 leading-snug mb-4 whitespace-pre-wrap">
          {task.title}
        </h1>

        {task.description && (
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
              {task.description}
            </p>
          </div>
        )}
      </div>

      {/* Várakozás-infó */}
      {task.status === 'waiting' && (task.waitingFor || task.followUpAt) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <Hourglass size={14} className="text-amber-600" />
          </div>
          <div className="text-sm">
            <p className="text-xs text-amber-600 font-medium mb-0.5">Várakozik</p>
            {task.waitingFor && <p className="text-amber-900">{task.waitingFor}</p>}
            {task.followUpAt && (
              <p className={`text-xs mt-1 ${isPast(new Date(task.followUpAt)) && !isToday(new Date(task.followUpAt)) ? 'text-red-600 font-semibold' : 'text-amber-700'}`}>
                Újranézés: {format(new Date(task.followUpAt), 'yyyy. MMMM d.', { locale: hu })}
                {isPast(new Date(task.followUpAt)) && !isToday(new Date(task.followUpAt)) ? ' — lejárt!' : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 space-y-3">
        {task.goal && (
          <div className="flex items-center gap-3 text-sm">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <Target size={14} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Cél ({GOAL_LEVEL_LABELS[task.goal.level] ?? task.goal.level})</p>
              <p className="font-medium text-gray-800">{task.goal.title}</p>
            </div>
          </div>
        )}

        {dueLabel && (
          <div className="flex items-center gap-3 text-sm">
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Calendar size={14} className="text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Határidő</p>
              <p className={`font-medium ${dueLabel.cls}`}>{dueLabel.text}</p>
            </div>
          </div>
        )}

        {task.assignee && (
          <div className="flex items-center gap-3 text-sm">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <User size={14} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Felelős</p>
              <p className="font-medium text-gray-800">{task.assignee.name}</p>
            </div>
          </div>
        )}

        {task.contact && (
          <div className="flex items-center gap-3 text-sm">
            <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
              <User size={14} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Kapcsolat</p>
              <Link href={`/contacts/${task.contact.id}`} className="font-medium text-blue-600 hover:underline">
                {task.contact.firstName} {task.contact.lastName}
              </Link>
              {task.contact.email && (
                <p className="text-xs text-gray-400">{task.contact.email}</p>
              )}
            </div>
          </div>
        )}

        {task.company && (
          <div className="flex items-center gap-3 text-sm">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Building2 size={14} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Cég</p>
              <Link href={`/companies/${task.company.id}`} className="font-medium text-blue-600 hover:underline">
                {task.company.name}
              </Link>
            </div>
          </div>
        )}

        {task.deal && (
          <div className="flex items-center gap-3 text-sm">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <Tag size={14} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Deal</p>
              <p className="font-medium text-gray-800">{task.deal.title}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-sm pt-1 border-t border-gray-50">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <Clock size={14} className="text-gray-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Létrehozva</p>
            <p className="text-gray-600">{format(new Date(task.createdAt), 'yyyy. MMMM d.', { locale: hu })}</p>
          </div>
        </div>
      </div>

      {/* Subtasks */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Részfeladatok</h2>
          {subtasks.length > 0 && (
            <span className="text-xs text-gray-400">{doneSubtasks}/{subtasks.length} kész</span>
          )}
        </div>

        {subtasks.length > 0 && (
          <div className="w-full bg-gray-100 rounded-full h-1 mb-4">
            <div
              className="bg-green-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${(doneSubtasks / subtasks.length) * 100}%` }}
            />
          </div>
        )}

        <div className="space-y-1.5 mb-3">
          {subtasks.map(s => (
            <div key={s.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 group transition-colors ${
              s.completed ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'
            }`}>
              <button
                onClick={() => toggleSubtask(s.id)}
                className="shrink-0 text-gray-400 hover:text-green-600 transition-colors"
              >
                {s.completed
                  ? <CheckSquare size={16} className="text-green-500" />
                  : <Square size={16} />
                }
              </button>
              <span className={`flex-1 text-sm leading-snug ${s.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                {s.title}
              </span>
              <button
                onClick={() => promoteSubtask(s.id, s.title)}
                title="Önálló feladattá alakítás"
                className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-indigo-600 transition-all"
              >
                <ArrowUpRight size={13} />
              </button>
              <button
                onClick={() => deleteSubtask(s.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
              >
                <X size={13} />
              </button>
            </div>
          ))}

          {subtasks.length === 0 && (
            <p className="text-xs text-gray-400 py-1">Még nincs alfeladat.</p>
          )}
        </div>

        {/* Quick-add */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newSubtaskInput}
            onChange={e => setNewSubtaskInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask() } }}
            placeholder="Alfeladat hozzáadása… (Enter)"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            onClick={addSubtask}
            disabled={addingSubtask || !newSubtaskInput.trim()}
            className="px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-gray-500 transition-colors disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Eseménytörténet */}
      {(task.events?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <History size={13} className="text-gray-400" />
            Előzmények
          </h2>
          <div className="space-y-2">
            {task.events.map(e => (
              <div key={e.id} className="flex items-start gap-2.5 text-xs">
                <span className="text-gray-400 shrink-0 w-[100px] font-mono">
                  {format(new Date(e.createdAt), 'MM.dd. HH:mm')}
                </span>
                <span className={`shrink-0 px-1.5 py-0 rounded-full font-medium ${
                  e.actor === 'agent' || e.actor === 'mcp' ? 'bg-violet-100 text-violet-700'
                  : e.actor === 'automation' ? 'bg-teal-100 text-teal-700'
                  : 'bg-gray-100 text-gray-500'
                }`}>
                  {e.actor}
                </span>
                <span className="text-gray-600 leading-snug">{eventText(e)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <Modal title="Feladat szerkesztése" onClose={() => setShowModal(false)} size="lg">
          <TaskForm task={task as never} defaultStatus={task.status} onSave={handleSave} onCancel={() => setShowModal(false)} />
        </Modal>
      )}
    </div>
  )
}
