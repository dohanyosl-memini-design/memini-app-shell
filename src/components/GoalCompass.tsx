'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Plus, Edit2, Trash2, Archive, ChevronRight, ChevronDown,
  Target, CheckSquare, TrendingUp, ListChecks,
} from 'lucide-react'
import Modal from '@/components/Modal'
import GoalForm from '@/components/GoalForm'
import TaskForm from '@/components/TaskForm'
import { GOAL_LEVEL_LABELS, GOAL_STATUS_LABELS, GOAL_METRICS, goalPeriodLabel } from '@/lib/goalConstants'

interface GoalProgress {
  percent: number | null
  source: 'metric' | 'children' | 'tasks' | 'manual'
  actualValue: number | null
  taskStats: { total: number; completed: number } | null
}

interface GoalNode {
  id: string
  title: string
  description: string | null
  level: string
  year: number | null
  quarter: number | null
  month: number | null
  status: string
  strategicArea: string | null
  metricKey: string | null
  targetValue: number | null
  parentId: string | null
  progress: GoalProgress
  children: GoalNode[]
  taskCount: number
  completedTaskCount: number
}

interface GoalTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  assignee: { id: string; name: string } | null
  subtasks: { id: string; completed: boolean }[]
}

const LEVEL_DOT: Record<string, string> = {
  vision:    'bg-purple-500',
  yearly:    'bg-indigo-500',
  quarterly: 'bg-blue-500',
  monthly:   'bg-teal-500',
}

const NEXT_LEVEL: Record<string, string | null> = {
  vision: 'yearly',
  yearly: 'quarterly',
  quarterly: 'monthly',
  monthly: null,
}

const TASK_STATUS_DOT: Record<string, string> = {
  pending: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  waiting: 'bg-amber-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-400',
}

function isCurrentPeriod(g: GoalNode): boolean {
  const now = new Date()
  const y = now.getFullYear()
  if (g.level === 'yearly') return g.year === y
  if (g.level === 'quarterly') return g.year === y && g.quarter === Math.floor(now.getMonth() / 3) + 1
  if (g.level === 'monthly') return g.year === y && g.month === now.getMonth() + 1
  return false
}

function ProgressBar({ percent, small }: { percent: number | null; small?: boolean }) {
  if (percent === null) return null
  const color = percent >= 100 ? 'bg-green-500' : percent >= 60 ? 'bg-blue-500' : percent >= 30 ? 'bg-amber-500' : 'bg-red-400'
  return (
    <div className={`w-full bg-gray-100 rounded-full ${small ? 'h-1' : 'h-2'}`}>
      <div className={`${color} ${small ? 'h-1' : 'h-2'} rounded-full transition-all duration-300`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  )
}

function TreeItem({
  node, depth, selectedId, expanded, onToggle, onSelect,
}: {
  node: GoalNode
  depth: number
  selectedId: string | null
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}) {
  const isOpen = expanded[node.id] ?? false
  const hasChildren = node.children.length > 0
  const current = isCurrentPeriod(node)
  const period = goalPeriodLabel(node)

  return (
    <div>
      <div
        onClick={() => onSelect(node.id)}
        className={`flex items-center gap-1.5 py-1.5 pr-2 rounded-lg cursor-pointer transition-colors group ${
          selectedId === node.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
      >
        {hasChildren ? (
          <button
            onClick={e => { e.stopPropagation(); onToggle(node.id) }}
            className="shrink-0 text-gray-400 hover:text-gray-600 p-0.5"
          >
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="w-[22px] shrink-0" />
        )}
        <span className={`w-2 h-2 rounded-full shrink-0 ${LEVEL_DOT[node.level] || 'bg-gray-400'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm truncate ${node.status !== 'active' ? 'text-gray-400 line-through' : 'text-gray-800'} ${current ? 'font-semibold' : ''}`}>
              {node.title}
            </span>
            {current && (
              <span className="shrink-0 text-[10px] px-1.5 py-0 rounded-full bg-teal-100 text-teal-700 font-medium">most</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {period && <span className="text-[10px] text-gray-400 shrink-0">{period}</span>}
            <div className="flex-1 max-w-[110px]"><ProgressBar percent={node.progress.percent} small /></div>
            {node.progress.percent !== null && (
              <span className="text-[10px] text-gray-400 shrink-0">{Math.round(node.progress.percent)}%</span>
            )}
          </div>
        </div>
      </div>
      {isOpen && node.children.map(c => (
        <TreeItem key={c.id} node={c} depth={depth + 1} selectedId={selectedId} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />
      ))}
    </div>
  )
}

function findNode(nodes: GoalNode[], id: string): GoalNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

function flatten(nodes: GoalNode[]): GoalNode[] {
  const out: GoalNode[] = []
  const walk = (ns: GoalNode[]) => { for (const n of ns) { out.push(n); walk(n.children) } }
  walk(nodes)
  return out
}

// Betöltéskor a legrelevánsabb célt választjuk ki, hogy a részletező soha ne
// legyen üres: az aktuális havi cél a legjobb, majd negyedéves, éves, végül vision.
function pickDefaultSelection(nodes: GoalNode[]): string | null {
  const flat = flatten(nodes)
  if (flat.length === 0) return null
  const now = new Date()
  const y = now.getFullYear(), q = Math.floor(now.getMonth() / 3) + 1, m = now.getMonth() + 1
  const rank = (n: GoalNode) => {
    if (n.level === 'monthly'   && n.year === y && n.month === m)   return 5
    if (n.level === 'quarterly' && n.year === y && n.quarter === q) return 4
    if (n.level === 'yearly'    && n.year === y)                    return 3
    if (n.level === 'vision')                                      return 2
    return 1
  }
  return flat.reduce((best, n) => (rank(n) > rank(best) ? n : best), flat[0]).id
}

export default function GoalCompass() {
  const [tree, setTree] = useState<GoalNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [tasks, setTasks] = useState<GoalTask[]>([])
  const [goalModal, setGoalModal] = useState<{ goal: GoalNode | null; defaultLevel?: string; defaultParentId?: string } | null>(null)
  const [taskModal, setTaskModal] = useState(false)
  const didInitSelect = useRef(false)

  const fetchTree = useCallback(async () => {
    const res = await fetch('/api/goals/tree')
    const data: GoalNode[] = await res.json()
    setTree(data)
    setLoading(false)

    // Alapból a "most" útvonal legyen kibontva (aktuális év + negyedév).
    setExpanded(prev => {
      if (Object.keys(prev).length > 0) return prev
      const open: Record<string, boolean> = {}
      const walk = (nodes: GoalNode[], parentChain: string[]) => {
        for (const n of nodes) {
          if (isCurrentPeriod(n) || n.level === 'vision') {
            for (const id of parentChain) open[id] = true
            open[n.id] = true
          }
          walk(n.children, [...parentChain, n.id])
        }
      }
      walk(data, [])
      return open
    })

    // Első betöltéskor kiválasztjuk az aktuális időszak célját.
    if (!didInitSelect.current) {
      didInitSelect.current = true
      const def = pickDefaultSelection(data)
      if (def) setSelectedId(def)
    }
  }, [])

  useEffect(() => { fetchTree() }, [fetchTree])

  useEffect(() => {
    if (!selectedId) { setTasks([]); return }
    fetch(`/api/goals/${selectedId}`)
      .then(r => r.json())
      .then(d => setTasks(d.tasks || []))
  }, [selectedId, tree])

  const selected = selectedId ? findNode(tree, selectedId) : null

  async function handleArchive(goal: GoalNode) {
    if (!confirm(`Archiválod a célt: „${goal.title}"? A cél eltűnik a fából, de nem törlődik.`)) return
    await fetch(`/api/goals/${goal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    })
    if (selectedId === goal.id) setSelectedId(null)
    fetchTree()
  }

  async function handleDelete(goal: GoalNode) {
    if (!confirm(`Véglegesen törlöd a célt: „${goal.title}"? A hozzákötött feladatok megmaradnak, csak a kapcsolat oldódik le.`)) return
    const res = await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      alert(data?.error || 'Törlés sikertelen.')
      return
    }
    if (selectedId === goal.id) setSelectedId(null)
    fetchTree()
  }

  function handleSaved() {
    setGoalModal(null)
    setTaskModal(false)
    fetchTree()
  }

  if (loading) return <div className="py-24 text-center text-gray-400">Betöltés...</div>

  const metric = selected?.metricKey ? GOAL_METRICS.find(m => m.key === selected.metricKey) : null
  const nextLevel = selected ? NEXT_LEVEL[selected.level] : null

  return (
    <div className="grid md:grid-cols-[minmax(300px,380px)_1fr] gap-4 items-start">
      {/* ── Fa ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 md:sticky md:top-4">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Target size={14} className="text-indigo-500" />
            Célhierarchia
          </span>
          <button
            onClick={() => setGoalModal({ goal: null, defaultLevel: 'vision' })}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            <Plus size={12} />
            Új cél
          </button>
        </div>

        {tree.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <p className="text-sm text-gray-400 mb-3">Még nincs cél felvéve.</p>
            <p className="text-xs text-gray-400">
              Kezdd a hosszú távú céllal (hová akartok eljutni 5 éven belül),
              majd bontsd le éves → negyedéves → havi célokra.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tree.map(n => (
              <TreeItem
                key={n.id}
                node={n}
                depth={0}
                selectedId={selectedId}
                expanded={expanded}
                onToggle={id => setExpanded(p => ({ ...p, [id]: !p[id] }))}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        )}

        {/* Jelmagyarázat */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-2 border-t border-gray-50 px-1">
          {Object.entries(GOAL_LEVEL_LABELS).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[k]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Részletek ── */}
      {!selected ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Target size={26} className="text-indigo-400" />
          </div>
          <p className="text-base font-semibold text-gray-700 mb-1">Kezdd a hosszú távú céllal</p>
          <p className="text-sm text-gray-400 max-w-sm mx-auto mb-5">
            Hová akartok eljutni 5 éven belül? Ebből bomlik le a rendszer éves →
            negyedéves → havi célokra, és ide köthetők a napi feladatok.
          </p>
          <button
            onClick={() => setGoalModal({ goal: null, defaultLevel: 'vision' })}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={15} />
            Hosszú távú cél létrehozása
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Fejléc kártya */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full text-white ${LEVEL_DOT[selected.level]}`}>
                  {GOAL_LEVEL_LABELS[selected.level]}
                  {goalPeriodLabel(selected) ? ` · ${goalPeriodLabel(selected)}` : ''}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${GOAL_STATUS_LABELS[selected.status]?.color || 'bg-gray-100 text-gray-500'}`}>
                  {GOAL_STATUS_LABELS[selected.status]?.label || selected.status}
                </span>
                {selected.strategicArea && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{selected.strategicArea}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setGoalModal({ goal: selected })} title="Szerkesztés"
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleArchive(selected)} title="Archiválás"
                  className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors">
                  <Archive size={14} />
                </button>
                <button onClick={() => handleDelete(selected)} title="Törlés"
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-900 leading-snug mb-2">{selected.title}</h2>
            {selected.description && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mb-4">{selected.description}</p>
            )}

            {/* Haladás */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <TrendingUp size={12} />
                  Haladás
                  {selected.progress.source === 'metric' && ' — automatikus (CRM-adatokból)'}
                  {selected.progress.source === 'children' && ' — az al-célok átlaga'}
                  {selected.progress.source === 'tasks' && ' — a feladatok kész-aránya'}
                  {selected.progress.source === 'manual' && ' — kézi státusz alapján'}
                </span>
                {selected.progress.percent !== null && (
                  <span className="text-sm font-bold text-gray-800">{selected.progress.percent}%</span>
                )}
              </div>
              <ProgressBar percent={selected.progress.percent} />
              {metric && selected.progress.source === 'metric' && (
                <p className="text-xs text-gray-500 mt-2">
                  {metric.label}: <span className="font-semibold text-gray-700">
                    {selected.progress.actualValue ?? 0}{metric.unit === '€' ? ' €' : ''} / {selected.targetValue}{metric.unit === '€' ? ' €' : ` ${metric.unit}`}
                  </span>
                </p>
              )}
              {selected.progress.percent === null && (
                <p className="text-xs text-gray-400 mt-1">
                  Még nincs mérhető adat — köss metrikát, adj hozzá al-célokat vagy feladatokat.
                </p>
              )}
            </div>
          </div>

          {/* Al-célok */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Target size={13} className="text-gray-400" />
                Al-célok ({selected.children.length})
              </h3>
              {nextLevel && (
                <button
                  onClick={() => setGoalModal({ goal: null, defaultLevel: nextLevel, defaultParentId: selected.id })}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  <Plus size={12} />
                  {GOAL_LEVEL_LABELS[nextLevel]} cél
                </button>
              )}
            </div>
            {selected.children.length === 0 ? (
              <p className="text-xs text-gray-400">
                {nextLevel
                  ? `Bontsd le ${GOAL_LEVEL_LABELS[nextLevel].toLowerCase()} célokra.`
                  : 'A havi cél alá már napi feladatok tartoznak.'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {selected.children.map(c => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 hover:bg-indigo-50 cursor-pointer transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${LEVEL_DOT[c.level]}`} />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${c.status !== 'active' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{c.title}</span>
                      {goalPeriodLabel(c) && <span className="ml-2 text-[10px] text-gray-400">{goalPeriodLabel(c)}</span>}
                    </div>
                    <div className="w-24 shrink-0"><ProgressBar percent={c.progress.percent} small /></div>
                    {c.progress.percent !== null && (
                      <span className="text-xs text-gray-500 w-9 text-right shrink-0">{Math.round(c.progress.percent)}%</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hozzákötött feladatok */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <ListChecks size={13} className="text-gray-400" />
                Feladatok ({tasks.length})
              </h3>
              <button
                onClick={() => setTaskModal(true)}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <Plus size={12} />
                Új feladat
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-xs text-gray-400">Ehhez a célhoz még nincs feladat kötve.</p>
            ) : (
              <div className="space-y-1">
                {tasks.map(t => {
                  const done = t.subtasks.filter(s => s.completed).length
                  return (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${TASK_STATUS_DOT[t.status] || 'bg-gray-300'}`} />
                      <span className={`flex-1 text-sm truncate ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {t.title}
                      </span>
                      {t.subtasks.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400 shrink-0">
                          <CheckSquare size={10} />
                          {done}/{t.subtasks.length}
                        </span>
                      )}
                      {t.dueDate && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {new Date(t.dueDate).toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' })}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modálok */}
      {goalModal && (
        <Modal
          title={goalModal.goal ? 'Cél szerkesztése' : 'Új cél'}
          onClose={() => setGoalModal(null)}
          size="lg"
        >
          <GoalForm
            goal={goalModal.goal}
            defaultLevel={goalModal.defaultLevel}
            defaultParentId={goalModal.defaultParentId}
            onSave={handleSaved}
            onCancel={() => setGoalModal(null)}
          />
        </Modal>
      )}

      {taskModal && selected && (
        <Modal title="Új feladat a célhoz" onClose={() => setTaskModal(false)} size="lg">
          <TaskForm
            task={null}
            defaultGoalId={selected.id}
            onSave={handleSaved}
            onCancel={() => setTaskModal(false)}
          />
        </Modal>
      )}
    </div>
  )
}
