'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Trash2, Calendar, User, Building2,
  CheckSquare, Square, Clock, Flag, Tag,
} from 'lucide-react'
import Modal from '@/components/Modal'
import TaskForm, { TASK_TYPES } from '@/components/TaskForm'
import { format, isPast, isToday, isTomorrow } from 'date-fns'
import { hu } from 'date-fns/locale'

interface SubTask { id: string; title: string; completed: boolean }

interface Task {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  status: string
  priority: string
  taskType: string | null
  assignee: { id: string; name: string } | null
  contact: { id: string; firstName: string; lastName: string; email: string | null } | null
  company: { id: string; name: string } | null
  deal: { id: string; title: string } | null
  subtasks: SubTask[]
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Várakozó',    color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'Folyamatban', color: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Kész',        color: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Törölve',     color: 'bg-red-100 text-red-600' },
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
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: updated.find(s => s.id === subtaskId)?.completed }),
    })
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
    if (isPast(d) && !isToday(d)) return { text: `Lejárt: ${format(d, 'yyyy. MM. dd.')}`, cls: 'text-red-600' }
    if (isToday(d)) return { text: 'Ma esedékes', cls: 'text-red-600 font-semibold' }
    if (isTomorrow(d)) return { text: `Holnap (${format(d, 'MM. dd.')})`, cls: 'text-amber-600' }
    return { text: format(d, 'yyyy. MMMM d.', { locale: hu }), cls: 'text-gray-700' }
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

      {/* Meta */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 space-y-3">
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
      {subtasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Részfeladatok</h2>
            <span className="text-xs text-gray-400">{doneSubtasks}/{subtasks.length} kész</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1 mb-4">
            <div
              className="bg-green-500 h-1 rounded-full transition-all"
              style={{ width: `${subtasks.length > 0 ? (doneSubtasks / subtasks.length) * 100 : 0}%` }}
            />
          </div>
          <div className="space-y-2">
            {subtasks.map(s => (
              <button
                key={s.id}
                onClick={() => toggleSubtask(s.id)}
                className="w-full flex items-start gap-3 text-left group"
              >
                <span className="mt-0.5 shrink-0 text-gray-400 group-hover:text-blue-500 transition-colors">
                  {s.completed
                    ? <CheckSquare size={16} className="text-green-500" />
                    : <Square size={16} />
                  }
                </span>
                <span className={`text-sm leading-snug ${s.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {s.title}
                </span>
              </button>
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
