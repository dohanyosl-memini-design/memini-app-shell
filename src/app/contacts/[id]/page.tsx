'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Mail, Building2, Edit2, Plus, Trash2,
  PhoneCall, Mail as MailIcon, Users, FileText, MessageSquare,
  Calendar, Clock, CheckSquare, ChevronRight, Package,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { hu } from 'date-fns/locale'
import Modal from '@/components/Modal'
import ContactForm from '@/components/ContactForm'
import TaskForm from '@/components/TaskForm'
import { TASK_TYPES } from '@/components/TaskForm'
import { DEAL_STAGE_LABELS } from '@/lib/dealStages'

interface Activity {
  id: string
  type: string
  subject: string | null
  description: string
  activityDate: string
  duration: number | null
  outcome: string | null
  createdAt: string
}

interface Deal {
  id: string
  title: string
  value: number
  stage: string
  closeDate: string | null
}

interface Invoice {
  id: string
  number: string
  total: number
  status: string
  date: string
  dueDate: string
}

interface Quote {
  id: string
  number: string
  total: number
  status: string
  date: string
}

interface Order {
  id: string
  number: string
  total: number
  status: string
  date: string
}

interface Task {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  priority: string
  status: string
  taskType: string | null
  assigneeId: string | null
  contactId: string | null
  companyId: string | null
  dealId: string | null
  assignee: { id: string; name: string } | null
  company: { name: string } | null
}

interface Contact {
  id: string
  salutation: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  status: string
  notes: string | null
  companyId: string | null
  company: { id: string; name: string } | null
  activities: Activity[]
  deals: Deal[]
  invoices: Invoice[]
  quotes: Quote[]
  orders: Order[]
  tasks: Task[]
  createdAt: string
}

const ACTIVITY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  call: { label: 'Telefonhívás', icon: PhoneCall, color: 'text-blue-600', bg: 'bg-blue-100' },
  email: { label: 'Email', icon: MailIcon, color: 'text-purple-600', bg: 'bg-purple-100' },
  meeting: { label: 'Találkozó', icon: Users, color: 'text-green-600', bg: 'bg-green-100' },
  note: { label: 'Feljegyzés', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-100' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-100' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  lead: { label: 'Érdeklődő', color: 'bg-yellow-100 text-yellow-800' },
  contacted: { label: 'Kapcsolatban', color: 'bg-blue-100 text-blue-700' },
  prospect: { label: 'Potenciális', color: 'bg-purple-100 text-purple-700' },
  qualified: { label: 'Minősített', color: 'bg-indigo-100 text-indigo-700' },
  active: { label: 'Aktív', color: 'bg-green-100 text-green-800' },
  customer: { label: 'Ügyfél', color: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Inaktív', color: 'bg-gray-100 text-gray-600' },
}

const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Tervezet', color: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Kiküldve', color: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Elutasítva', color: 'bg-red-100 text-red-700' },
  expired: { label: 'Lejárt', color: 'bg-amber-100 text-amber-700' },
}

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:       { label: 'Függőben',      color: 'bg-amber-100 text-amber-700' },
  confirmed:     { label: 'Visszaigazolva',color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'Gyártásban',    color: 'bg-purple-100 text-purple-700' },
  packing:       { label: 'Összekészítés', color: 'bg-orange-100 text-orange-700' },
  shipped:       { label: 'Kiszállítva',   color: 'bg-indigo-100 text-indigo-700' },
  delivered:     { label: 'Átadva',        color: 'bg-green-100 text-green-700' },
  cancelled:     { label: 'Lemondva',      color: 'bg-red-100 text-red-700' },
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface ActivityFormProps {
  contactId: string
  onSave: () => void
  onCancel: () => void
}

function ActivityForm({ contactId, onSave, onCancel }: ActivityFormProps) {
  const [loading, setLoading] = useState(false)
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  const [form, setForm] = useState({
    type: 'call',
    subject: '',
    description: '',
    activityDate: localNow,
    duration: '',
    outcome: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, contactId }),
    })
    setLoading(false)
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Típus *</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="call">Telefonhívás</option>
            <option value="email">Email</option>
            <option value="meeting">Találkozó</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="note">Feljegyzés</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dátum *</label>
          <input
            type="datetime-local"
            value={form.activityDate}
            onChange={(e) => setForm({ ...form, activityDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tárgy</label>
        <input
          type="text"
          placeholder="pl. Ajánlat megbeszélése"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Leírás *</label>
        <textarea
          required
          rows={3}
          placeholder="Mi hangzott el? Mi történt?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {(form.type === 'call' || form.type === 'meeting') && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Időtartam (perc)</label>
            <input
              type="number"
              min="1"
              placeholder="pl. 15"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Eredmény</label>
            <input
              type="text"
              placeholder="pl. Ajánlatot kér"
              value={form.outcome}
              onChange={(e) => setForm({ ...form, outcome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          Mégse
        </button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Mentés...' : 'Mentés'}
        </button>
      </div>
    </form>
  )
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [companyTasks, setCompanyTasks] = useState<Task[]>([])
  const [activeTab, setActiveTab] = useState<'timeline' | 'deals' | 'quotes' | 'orders' | 'invoices' | 'tasks'>('timeline')

  const fetchContact = useCallback(async () => {
    const res = await fetch(`/api/contacts/${id}`)
    if (res.ok) {
      const data = await res.json()
      setContact(data)
      if (data.companyId) {
        const tr = await fetch(`/api/tasks?companyId=${data.companyId}`)
        if (tr.ok) setCompanyTasks(await tr.json())
      }
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchContact()
  }, [fetchContact])

  async function handleDeleteActivity(activityId: string) {
    if (!confirm('Törli ezt a bejegyzést?')) return
    await fetch(`/api/activities/${activityId}`, { method: 'DELETE' })
    fetchContact()
  }

  async function handleDeleteContact() {
    if (!confirm(`Biztosan törli ${contact?.firstName} ${contact?.lastName} ügyfelet?`)) return
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    router.push('/contacts')
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-gray-400">
        Betöltés...
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Az ügyfél nem található.</p>
        <Link href="/contacts" className="text-blue-600 hover:underline mt-2 inline-block">← Vissza</Link>
      </div>
    )
  }

  const status = STATUS_CONFIG[contact.status] ?? { label: contact.status, color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/contacts')} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
            {contact.firstName} {contact.lastName}
          </h1>
          {contact.company && (
            <Link href={`/companies/${contact.company.id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
              <Building2 size={13} />
              {contact.company.name}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit2 size={14} />
            <span className="hidden sm:inline">Szerkesztés</span>
          </button>
          <button
            onClick={() => setShowActivityModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Bejegyzés</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: contact info */}
        <div className="space-y-4">
          {/* Info card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
                <p className="text-xs text-gray-400 mt-1">
                  Létrehozva: {format(new Date(contact.createdAt), 'yyyy. MMM d.', { locale: hu })}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-blue-600 transition-colors group">
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                    <Mail size={13} className="text-gray-500 group-hover:text-blue-600" />
                  </div>
                  <span className="truncate">{contact.email}</span>
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-green-600 transition-colors group">
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-green-50 transition-colors">
                    <Phone size={13} className="text-gray-500 group-hover:text-green-600" />
                  </div>
                  {contact.phone}
                </a>
              )}
              {!contact.email && !contact.phone && (
                <p className="text-sm text-gray-400">Nincs elérhetőség megadva</p>
              )}
            </div>

            {contact.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Megjegyzés</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{contact.notes}</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Összesítés</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Kommunikáció</span>
                <span className="font-medium text-gray-900">{contact.activities.length} bejegyzés</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dealek</span>
                <span className="font-medium text-gray-900">{contact.deals.length} db</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ajánlatok</span>
                <span className="font-medium text-gray-900">{contact.quotes.length} db</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Megrendelések</span>
                <span className="font-medium text-gray-900">{contact.orders.length} db</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Számlák</span>
                <span className="font-medium text-gray-900">{contact.invoices.length} db</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="text-gray-500">Számlázott összeg</span>
                <span className="font-semibold text-gray-900">
                  {fmtEur(contact.invoices.reduce((s, i) => s + i.total, 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Pending tasks */}
          {contact.tasks.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CheckSquare size={14} />
                Nyitott feladatok ({contact.tasks.length})
              </h3>
              <div className="space-y-2">
                {contact.tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2 text-sm">
                    <span className="text-xs mt-0.5">{task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '⚪'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 font-medium truncate">{task.title}</p>
                      {task.dueDate && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar size={10} />
                          {format(new Date(task.dueDate), 'MMM d.', { locale: hu })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
            {([
              { key: 'timeline', label: 'Kommunikáció', count: contact.activities.length },
              { key: 'tasks', label: 'Feladatok', count: [...contact.tasks, ...companyTasks.filter(ct => !contact.tasks.find(t => t.id === ct.id))].length },
              { key: 'deals', label: 'Dealek', count: contact.deals.length },
              { key: 'quotes', label: 'Ajánlatok', count: contact.quotes.length },
              { key: 'orders', label: 'Rendelések', count: contact.orders.length },
              { key: 'invoices', label: 'Számlák', count: contact.invoices.length },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 min-w-max px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label} {count > 0 && <span className="text-xs opacity-60">({count})</span>}
              </button>
            ))}
          </div>

          {/* Timeline tab */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Kommunikáció történet</h2>
                <button
                  onClick={() => setShowActivityModal(true)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus size={14} />
                  Új bejegyzés
                </button>
              </div>

              {contact.activities.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <PhoneCall size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Még nincs kommunikációs bejegyzés.</p>
                  <button
                    onClick={() => setShowActivityModal(true)}
                    className="mt-3 text-sm text-blue-600 hover:underline"
                  >
                    Add hozzá az első bejegyzést
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {contact.activities.map((activity) => {
                    const cfg = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.note
                    const Icon = cfg.icon
                    return (
                      <div key={activity.id} className="px-5 py-4 flex gap-4 group">
                        <div className={`w-8 h-8 ${cfg.bg} rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
                          <Icon size={14} className={cfg.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                              {activity.subject && (
                                <p className="text-sm font-semibold text-gray-900 mt-0.5">{activity.subject}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock size={10} />
                                {format(new Date(activity.activityDate), 'yyyy. MMM d. HH:mm', { locale: hu })}
                              </span>
                              <button
                                onClick={() => handleDeleteActivity(activity.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{activity.description}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            {activity.duration && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock size={10} />{activity.duration} perc
                              </span>
                            )}
                            {activity.outcome && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                → {activity.outcome}
                              </span>
                            )}
                            <span className="text-xs text-gray-300">
                              {formatDistanceToNow(new Date(activity.activityDate), { locale: hu, addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Deals tab */}
          {activeTab === 'deals' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Dealek ({contact.deals.length})</h2>
              </div>
              {contact.deals.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 text-sm">Nincs deal ehhez az ügyfélhez.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {contact.deals.map((deal) => (
                    <div key={deal.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{deal.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{DEAL_STAGE_LABELS[deal.stage] || deal.stage}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{fmtEur(deal.value)}</p>
                        {deal.closeDate && (
                          <p className="text-xs text-gray-400">{format(new Date(deal.closeDate), 'MMM d.', { locale: hu })}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quotes tab */}
          {activeTab === 'quotes' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Ajánlatok ({contact.quotes.length})</h2>
                <Link href="/quotes" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  Összes <ChevronRight size={14} />
                </Link>
              </div>
              {contact.quotes.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 text-sm">
                  <Package size={32} className="text-gray-200 mx-auto mb-3" />
                  Nincs ajánlat ehhez az ügyfélhez.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {contact.quotes.map((q) => {
                    const qs = QUOTE_STATUS[q.status]
                    return (
                      <div key={q.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 font-mono">{q.number}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{format(new Date(q.date), 'yyyy. MMM d.', { locale: hu })}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${qs?.color || 'bg-gray-100 text-gray-600'}`}>
                            {qs?.label || q.status}
                          </span>
                          <p className="text-sm font-semibold text-gray-900">{fmtEur(q.total)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Orders tab */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Megrendelések ({contact.orders.length})</h2>
                <Link href="/orders" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  Összes <ChevronRight size={14} />
                </Link>
              </div>
              {contact.orders.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 text-sm">
                  Nincs megrendelés ehhez az ügyfélhez.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {contact.orders.map((o) => {
                    const os = ORDER_STATUS[o.status]
                    return (
                      <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 font-mono">{o.number}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{format(new Date(o.date), 'yyyy. MMM d.', { locale: hu })}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${os?.color || 'bg-gray-100 text-gray-600'}`}>
                            {os?.label || o.status}
                          </span>
                          <p className="text-sm font-semibold text-gray-900">{fmtEur(o.total)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Invoices tab */}
          {activeTab === 'invoices' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Számlák ({contact.invoices.length})</h2>
              </div>
              {contact.invoices.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 text-sm">Nincs számla ehhez az ügyfélhez.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {contact.invoices.map((inv) => (
                    <div key={inv.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 font-mono">{inv.number}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{format(new Date(inv.date), 'yyyy. MMM d.', { locale: hu })}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                          inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {inv.status === 'paid' ? 'Fizetve' : inv.status === 'overdue' ? 'Lejárt' : 'Nyitott'}
                        </span>
                        <p className="text-sm font-semibold text-gray-900">{fmtEur(inv.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Tasks tab */}
          {activeTab === 'tasks' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h2 className="font-semibold text-gray-900">Feladatok</h2>
                  {contact.company && (
                    <p className="text-xs text-gray-400 mt-0.5">Saját + {contact.company.name} feladatai</p>
                  )}
                </div>
                <button
                  onClick={() => { setEditTask(null); setShowNewTaskModal(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={14} /> Új feladat
                </button>
              </div>
              {(() => {
                const allTasks = [
                  ...contact.tasks.map(t => ({ ...t, _source: 'contact' as const })),
                  ...companyTasks
                    .filter(ct => !contact.tasks.find(t => t.id === ct.id))
                    .map(t => ({ ...t, _source: 'company' as const })),
                ].sort((a, b) => {
                  if (!a.dueDate && !b.dueDate) return 0
                  if (!a.dueDate) return 1
                  if (!b.dueDate) return -1
                  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
                })
                if (allTasks.length === 0) return (
                  <div className="px-5 py-12 text-center text-gray-400 text-sm">Nincs feladat.</div>
                )
                return (
                  <div className="divide-y divide-gray-50">
                    {allTasks.map((task) => {
                      const typeInfo = TASK_TYPES.find(t => t.value === task.taskType)
                      const PRIORITY: Record<string, string> = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-500' }
                      const STATUS_DOT: Record<string, string> = { pending: 'bg-gray-300', in_progress: 'bg-blue-400', completed: 'bg-green-400' }
                      return (
                        <div key={task.id} className={`px-5 py-3 flex items-start gap-3 group ${task.status === 'completed' ? 'opacity-50' : ''}`}>
                          <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${STATUS_DOT[task.status] || 'bg-gray-300'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-medium text-gray-900 ${task.status === 'completed' ? 'line-through' : ''}`}>{task.title}</p>
                              {typeInfo && <span className={`text-xs px-1.5 py-0.5 rounded-full border ${typeInfo.color}`}>{typeInfo.icon} {typeInfo.label}</span>}
                              {task._source === 'company' && contact.company && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{contact.company.name}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                              {task.dueDate && <span>{format(new Date(task.dueDate), 'MM.dd.', { locale: hu })}</span>}
                              {task.assignee && <span>{task.assignee.name}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY[task.priority]}`}>
                              {task.priority === 'high' ? 'Magas' : task.priority === 'medium' ? 'Közepes' : 'Alacsony'}
                            </span>
                            <button
                              onClick={() => { setEditTask(task); setShowNewTaskModal(true) }}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-all"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Delete button at bottom */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
        <button
          onClick={handleDeleteContact}
          className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          <Trash2 size={14} />
          Ügyfél törlése
        </button>
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <Modal title="Ügyfél szerkesztése" onClose={() => setShowEditModal(false)}>
          <ContactForm
            contact={contact}
            onSave={() => { setShowEditModal(false); fetchContact() }}
            onCancel={() => setShowEditModal(false)}
          />
        </Modal>
      )}

      {/* Activity modal */}
      {showActivityModal && (
        <Modal title="Kommunikáció rögzítése" onClose={() => setShowActivityModal(false)}>
          <ActivityForm
            contactId={id}
            onSave={() => { setShowActivityModal(false); fetchContact() }}
            onCancel={() => setShowActivityModal(false)}
          />
        </Modal>
      )}

      {/* Task modal */}
      {showNewTaskModal && (
        <Modal title={editTask ? 'Feladat szerkesztése' : 'Új feladat'} onClose={() => { setShowNewTaskModal(false); setEditTask(null) }} size="lg">
          <TaskForm
            task={editTask}
            defaultContactId={id}
            defaultCompanyId={contact.companyId || undefined}
            onSave={() => { setShowNewTaskModal(false); setEditTask(null); fetchContact() }}
            onCancel={() => { setShowNewTaskModal(false); setEditTask(null) }}
          />
        </Modal>
      )}
    </div>
  )
}
