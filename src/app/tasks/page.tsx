'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, CheckCircle, Circle, Clock, AlertCircle } from 'lucide-react'
import Modal from '@/components/Modal'
import TaskForm from '@/components/TaskForm'
import { format, isPast, isToday, isTomorrow } from 'date-fns'
import { hu } from 'date-fns/locale'

interface Task {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  status: string
  priority: string
  contactId: string | null
  dealId: string | null
  contact: { firstName: string; lastName: string } | null
  deal: { title: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle; color: string }> = {
  pending: { label: 'Várakozó', icon: Circle, color: 'text-gray-400' },
  in_progress: { label: 'Folyamatban', icon: Clock, color: 'text-blue-500' },
  completed: { label: 'Kész', icon: CheckCircle, color: 'text-green-500' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'Magas', color: 'text-red-600', bg: 'bg-red-50 text-red-700' },
  medium: { label: 'Közepes', color: 'text-amber-600', bg: 'bg-amber-50 text-amber-700' },
  low: { label: 'Alacsony', color: 'text-gray-400', bg: 'bg-gray-50 text-gray-500' },
}

function formatDueDate(dateStr: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isToday(date)) return { text: 'Ma', urgent: true }
  if (isTomorrow(date)) return { text: 'Holnap', urgent: false }
  if (isPast(date)) return { text: `Lejárt: ${format(date, 'MMM d.', { locale: hu })}`, urgent: true }
  return { text: format(date, 'MMM d.', { locale: hu }), urgent: false }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/tasks?status=${filterStatus}`)
    const data = await res.json()
    setTasks(data)
    setLoading(false)
  }, [filterStatus])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törölni szeretné ezt a feladatot?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    fetchTasks()
  }

  async function handleToggleStatus(task: Task) {
    const nextStatus =
      task.status === 'pending' ? 'in_progress' :
      task.status === 'in_progress' ? 'completed' : 'pending'

    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status: nextStatus }),
    })
    fetchTasks()
  }

  function handleEdit(task: Task) {
    setEditTask(task)
    setShowModal(true)
  }

  function handleAdd() {
    setEditTask(null)
    setShowModal(true)
  }

  function handleModalClose() {
    setShowModal(false)
    setEditTask(null)
  }

  function handleSave() {
    handleModalClose()
    fetchTasks()
  }

  const filtered = filterPriority === 'all'
    ? tasks
    : tasks.filter((t) => t.priority === filterPriority)

  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feladatok</h1>
          <p className="text-gray-500 mt-1">{filtered.length} feladat</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Új feladat
        </button>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
          {([
            ['all', 'Mind', counts.all],
            ['pending', 'Várakozó', counts.pending],
            ['in_progress', 'Folyamatban', counts.in_progress],
            ['completed', 'Kész', counts.completed],
          ] as const).map(([val, label, count]) => (
            <button
              key={val}
              onClick={() => setFilterStatus(val)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filterStatus === val
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label} <span className="ml-1 text-xs opacity-75">({count})</span>
            </button>
          ))}
        </div>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Minden prioritás</option>
          <option value="high">Magas</option>
          <option value="medium">Közepes</option>
          <option value="low">Alacsony</option>
        </select>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Betöltés...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400">Nem található feladat</div>
        ) : (
          filtered.map((task) => {
            const statusConfig = STATUS_CONFIG[task.status]
            const priorityConfig = PRIORITY_CONFIG[task.priority]
            const due = formatDueDate(task.dueDate)
            const StatusIcon = statusConfig.icon

            return (
              <div
                key={task.id}
                className={`bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow ${
                  task.status === 'completed' ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleStatus(task)}
                    className={`mt-0.5 shrink-0 ${statusConfig.color} hover:scale-110 transition-transform`}
                  >
                    <StatusIcon size={20} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`font-medium text-gray-900 ${task.status === 'completed' ? 'line-through' : ''}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityConfig.bg}`}>
                          {priorityConfig.label}
                        </span>
                        <button
                          onClick={() => handleEdit(task)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      {due && (
                        <div className={`flex items-center gap-1 text-xs ${due.urgent ? 'text-red-600' : 'text-gray-400'}`}>
                          {due.urgent && <AlertCircle size={11} />}
                          {!due.urgent && <Clock size={11} />}
                          {due.text}
                        </div>
                      )}
                      {task.contact && (
                        <span className="text-xs text-gray-400">
                          {task.contact.firstName} {task.contact.lastName}
                        </span>
                      )}
                      {task.deal && (
                        <span className="text-xs text-gray-400 truncate">
                          {task.deal.title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {showModal && (
        <Modal title={editTask ? 'Feladat szerkesztése' : 'Új feladat'} onClose={handleModalClose} size="lg">
          <TaskForm task={editTask} onSave={handleSave} onCancel={handleModalClose} />
        </Modal>
      )}
    </div>
  )
}
