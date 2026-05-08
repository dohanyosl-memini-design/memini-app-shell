'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Edit2, Trash2, LayoutGrid, List, User, Building2, AlertCircle, Calendar, CheckSquare } from 'lucide-react'
import Link from 'next/link'
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
  assigneeId: string | null
  assignee: { id: string; name: string } | null
  contactId: string | null
  contact: { firstName: string; lastName: string } | null
  companyId: string | null
  company: { name: string } | null
  dealId: string | null
  deal: { title: string } | null
  subtasks: SubTask[]
}

const COLUMNS = [
  { id: 'pending',     label: 'Várakozó',    color: 'border-gray-300',  bg: 'bg-gray-50',   dot: 'bg-gray-400' },
  { id: 'in_progress', label: 'Folyamatban', color: 'border-blue-300',  bg: 'bg-blue-50',   dot: 'bg-blue-500' },
  { id: 'completed',   label: 'Kész',        color: 'border-green-300', bg: 'bg-green-50',  dot: 'bg-green-500' },
]

const PRIORITY_BADGE: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-500',
}
const PRIORITY_LABEL: Record<string, string> = {
  high: 'Magas', medium: 'Közepes', low: 'Alacsony',
}

function dueBadge(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isPast(d) && !isToday(d)) return { text: `Lejárt: ${format(d, 'MM.dd.')}`, cls: 'text-red-600 bg-red-50' }
  if (isToday(d))     return { text: 'Ma', cls: 'text-red-600 bg-red-50 font-semibold' }
  if (isTomorrow(d))  return { text: 'Holnap', cls: 'text-amber-600 bg-amber-50' }
  return { text: format(d, 'MM.dd.', { locale: hu }), cls: 'text-gray-400 bg-gray-50' }
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  task: Task
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onDragStart: (t: Task) => void
  onDragEnd: () => void
  isDragging: boolean
}) {
  const typeInfo = TASK_TYPES.find((t) => t.value === task.taskType)
  const due = dueBadge(task.dueDate)
  const doneSubtasks = task.subtasks.filter((s) => s.completed).length
  const totalSubtasks = task.subtasks.length

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task)}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm cursor-grab active:cursor-grabbing transition-all select-none group ${
        isDragging ? 'opacity-40 scale-95' : 'hover:shadow-md hover:-translate-y-0.5'
      } ${task.status === 'completed' ? 'opacity-60' : ''}`}
    >
      {/* Type + priority row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {typeInfo && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeInfo.color}`}>
              {typeInfo.icon} {typeInfo.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(task)} className="p-1 text-gray-400 hover:text-blue-600 rounded">
            <Edit2 size={12} />
          </button>
          <button onClick={() => onDelete(task.id)} className="p-1 text-gray-400 hover:text-red-600 rounded">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Title */}
      <p className={`text-sm font-semibold text-gray-900 leading-snug mb-2 ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
        {task.title}
      </p>

      {task.description && (
        <p className="text-xs text-gray-400 mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {due && (
          <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${due.cls}`}>
            <Calendar size={9} />
            {due.text}
          </span>
        )}
        {task.assignee && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
            <User size={9} />
            {task.assignee.name.split(' ').pop()}
          </span>
        )}
        {task.company && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
            <Building2 size={9} />
            {task.company.name.length > 16 ? task.company.name.slice(0, 14) + '…' : task.company.name}
          </span>
        )}
        {totalSubtasks > 0 && (
          <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${doneSubtasks === totalSubtasks ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
            <CheckSquare size={9} />
            {doneSubtasks}/{totalSubtasks}
          </span>
        )}
        <span className={`px-1.5 py-0.5 rounded-full ${PRIORITY_BADGE[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
      </div>
    </div>
  )
}

function KanbanColumn({
  col,
  tasks,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  onDrop,
  draggingId,
}: {
  col: typeof COLUMNS[0]
  tasks: Task[]
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onDragStart: (t: Task) => void
  onDragEnd: () => void
  onDrop: (status: string) => void
  draggingId: string | null
}) {
  const [over, setOver] = useState(false)

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 ${col.color} ${col.bg} min-h-[600px] transition-colors ${over && draggingId ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(col.id) }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-current border-opacity-20">
        <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
        <span className="text-sm font-semibold text-gray-700">{col.label}</span>
        <span className="ml-auto text-xs font-medium text-gray-400 bg-white rounded-full px-2 py-0.5">{tasks.length}</span>
      </div>

      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onEdit={onEdit}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggingId === t.id}
          />
        ))}

        {over && draggingId && (
          <div className="h-16 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 opacity-60" />
        )}

        {tasks.length === 0 && !over && (
          <div className="flex items-center justify-center h-24 text-xs text-gray-300">Nincs feladat</div>
        )}
      </div>
    </div>
  )
}

interface OverdueInvoice {
  id: string
  number: string
  dueDate: string
  total: number
  company: { id: string; name: string } | null
  contact: { id: string; firstName: string; lastName: string } | null
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState('pending')
  const dragging = useRef<Task | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const [tasksRes, invoicesRes] = await Promise.all([
      fetch('/api/tasks'),
      fetch('/api/invoices?overdue=true'),
    ])
    const [tasksData, invoicesData] = await Promise.all([
      tasksRes.json(),
      invoicesRes.json(),
    ])
    setTasks(tasksData)
    setOverdueInvoices(invoicesData)
    setLoading(false)
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törölni szeretné ezt a feladatot?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    fetchTasks()
  }

  function handleEdit(task: Task) {
    setEditTask(task)
    setShowModal(true)
  }

  function handleAdd(status = 'pending') {
    setEditTask(null)
    setDefaultStatus(status)
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

  function onDragStart(task: Task) {
    dragging.current = task
    setDraggingId(task.id)
  }

  function onDragEnd() {
    dragging.current = null
    setDraggingId(null)
  }

  async function onDrop(status: string) {
    const task = dragging.current
    if (!task || task.status === status) return
    dragging.current = null
    setDraggingId(null)
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status } : t))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status }),
    })
  }

  const filtered = tasks.filter((t) => {
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false
    if (filterType !== 'all' && t.taskType !== filterType) return false
    return true
  })

  const byStatus = (status: string) => filtered.filter((t) => t.status === status)

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feladatok</h1>
          <p className="text-gray-500 mt-0.5">{filtered.length} feladat</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('kanban')}
              className={`p-1.5 rounded-md transition-colors ${view === 'kanban' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Kanban nézet"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Lista nézet"
            >
              <List size={16} />
            </button>
          </div>
          <button
            onClick={() => handleAdd()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Új feladat
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">Minden prioritás</option>
          <option value="high">🔴 Magas</option>
          <option value="medium">🟡 Közepes</option>
          <option value="low">🟢 Alacsony</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">Minden típus</option>
          {TASK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
          ))}
        </select>
      </div>

      {/* Lejárt számlák figyelmeztetés */}
      {overdueInvoices.length > 0 && (
        <div className="mb-5 border border-red-200 bg-red-50 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-100 border-b border-red-200">
            <AlertCircle size={15} className="text-red-600" />
            <span className="text-sm font-semibold text-red-700">
              {overdueInvoices.length} lejárt számla azonnali figyelmet igényel
            </span>
          </div>
          <div className="divide-y divide-red-100">
            {overdueInvoices.map(inv => {
              const overdueDays = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000)
              return (
                <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white hover:bg-red-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-sm font-semibold text-gray-800">{inv.number}</span>
                    {inv.company && (
                      <Link href={`/companies/${inv.company.id}`} className="text-sm text-gray-600 hover:text-blue-600 truncate">
                        {inv.company.name}
                      </Link>
                    )}
                    <span className="text-xs text-red-600 font-medium bg-red-100 px-1.5 py-0.5 rounded">
                      {overdueDays} napja lejárt
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-gray-900">€{inv.total.toFixed(2)}</span>
                    <Link
                      href="/invoices"
                      className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Megtekintés →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-gray-400">Betöltés...</div>
      ) : view === 'kanban' ? (
        /* ── KANBAN ── */
        <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto pb-2 md:overflow-visible">
          {COLUMNS.map((col) => (
            <div key={col.id} className="min-w-[280px] md:min-w-0 flex-shrink-0 md:flex-shrink">
            <KanbanColumn
              col={col}
              tasks={byStatus(col.id)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              draggingId={draggingId}
            />
            </div>
          ))}
        </div>
      ) : (
        /* ── LISTA ── */
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">Nincs feladat</div>
          ) : (
            filtered.map((task) => {
              const typeInfo = TASK_TYPES.find((t) => t.value === task.taskType)
              const due = dueBadge(task.dueDate)
              const col = COLUMNS.find((c) => c.id === task.status)
              return (
                <div key={task.id} className={`bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-sm transition-shadow flex items-center gap-3 ${task.status === 'completed' ? 'opacity-60' : ''}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${col?.dot || 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-sm font-medium text-gray-900 ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                        {task.title}
                      </span>
                      {typeInfo && <span className="text-xs text-gray-400">{typeInfo.icon} {typeInfo.label}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      {due && <span className={due.cls}>{due.text}</span>}
                      {task.assignee && <span>{task.assignee.name}</span>}
                      {task.company && <span>{task.company.name}</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_BADGE[task.priority]}`}>
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                  <button onClick={() => handleEdit(task)} className="text-gray-400 hover:text-blue-600 transition-colors shrink-0">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="text-gray-400 hover:text-red-600 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      {showModal && (
        <Modal title={editTask ? 'Feladat szerkesztése' : 'Új feladat'} onClose={handleModalClose} size="lg">
          <TaskForm task={editTask} defaultStatus={defaultStatus} onSave={handleSave} onCancel={handleModalClose} />
        </Modal>
      )}
    </div>
  )
}
