'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Globe, MapPin, Edit2, Plus, Trash2,
  PhoneCall, Mail as MailIcon, Users, FileText, MessageSquare,
  Clock, Building2, ChevronRight, CheckCircle2, Circle, AlertCircle, Bell,
} from 'lucide-react'
import { format, formatDistanceToNow, isPast } from 'date-fns'
import { hu } from 'date-fns/locale'
import Modal from '@/components/Modal'
import CompanyForm from '@/components/CompanyForm'
import LostReasonModal from '@/components/LostReasonModal'
import EmailSequencePanel from '@/components/EmailSequencePanel'
import { parseSequence } from '@/lib/emailSequence'
import ContactForm from '@/components/ContactForm'
import TaskForm from '@/components/TaskForm'
import InvoicePreview from '@/components/InvoicePreview'
import MemoryTab from '@/components/MemoryTab'
import TemplatesTab from '@/components/TemplatesTab'
import CompanyEmails from '@/components/email/CompanyEmails'
import { DEAL_STAGE_LABELS } from '@/lib/dealStages'

interface Activity {
  id: string
  type: string
  subject: string | null
  description: string
  activityDate: string
  duration: number | null
  outcome: string | null
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  status: string
}

interface Deal {
  id: string
  title: string
  value: number
  stage: string
}

interface Invoice {
  id: string
  number: string
  total: number
  status: string
  date: string
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
  status: string
  priority: string
  contactId: string | null
}

interface Company {
  id: string
  name: string
  industry: string | null
  website: string | null
  phone: string | null
  address: string | null
  city: string | null
  country: string | null
  vatId: string | null
  contacts: Contact[]
  deals: Deal[]
  activities: Activity[]
  invoices: Invoice[]
  quotes: Quote[]
  orders: Order[]
  tasks: Task[]
  createdAt: string
  lifecycle?: string
  language?: string | null
  emailSequence?: unknown
  businessHours?: {
    regular: { day: number; open: string; close: string; closed: boolean }[]
    periods: { label: string; from: string; until: string; days: { day: number; open: string; close: string; closed: boolean }[] }[]
  } | null
}

const ACTIVITY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  call: { label: 'Telefonhívás', icon: PhoneCall, color: 'text-blue-600', bg: 'bg-blue-100' },
  email: { label: 'Email', icon: MailIcon, color: 'text-purple-600', bg: 'bg-purple-100' },
  meeting: { label: 'Találkozó', icon: Users, color: 'text-green-600', bg: 'bg-green-100' },
  note: { label: 'Feljegyzés', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-100' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-100' },
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

const CONTACT_STATUS: Record<string, { label: string; color: string }> = {
  lead: { label: 'Érdeklődő', color: 'bg-yellow-100 text-yellow-800' },
  active: { label: 'Aktív', color: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inaktív', color: 'bg-gray-100 text-gray-600' },
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface ActivityFormProps {
  companyId: string
  editActivity?: Activity | null
  onSave: () => void
  onCancel: () => void
}

function ActivityForm({ companyId, editActivity, onSave, onCancel }: ActivityFormProps) {
  const [loading, setLoading] = useState(false)
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  const toLocal = (iso: string) => {
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  const [form, setForm] = useState({
    type: editActivity?.type ?? 'call',
    subject: editActivity?.subject ?? '',
    description: editActivity?.description ?? '',
    activityDate: editActivity ? toLocal(editActivity.activityDate) : localNow,
    duration: editActivity?.duration ? String(editActivity.duration) : '',
    outcome: editActivity?.outcome ?? '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    if (editActivity) {
      await fetch(`/api/activities/${editActivity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, companyId }),
      })
    }
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
          {loading ? 'Mentés...' : editActivity ? 'Módosítás' : 'Mentés'}
        </button>
      </div>
    </form>
  )
}


export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [editActivity, setEditActivity] = useState<Activity | null>(null)
  const [showNewContactModal, setShowNewContactModal] = useState(false)
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'timeline' | 'levelezes' | 'contacts' | 'tasks' | 'memory' | 'templates' | 'deals' | 'quotes' | 'orders' | 'invoices'>('timeline')
  const [previewInvoiceFull, setPreviewInvoiceFull] = useState<null | Record<string, unknown>>(null)
  const [previewOrderData, setPreviewOrderData] = useState<null | Record<string, unknown>>(null)
  const [autoTaskCreated, setAutoTaskCreated] = useState(false)
  const [showCemetery, setShowCemetery] = useState(false)
  const [cemeteryBusy, setCemeteryBusy] = useState(false)

  const fetchCompany = useCallback(async () => {
    const res = await fetch(`/api/companies/${id}`)
    if (res.ok) {
      const data = await res.json()
      setCompany(data)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchCompany()
  }, [fetchCompany])

  // Auto-create follow-up task if 4+ weeks without activity
  useEffect(() => {
    if (!company || autoTaskCreated) return
    const lastAct = company.activities[0]?.activityDate
    const refDate = lastAct ? new Date(lastAct) : new Date(company.createdAt)
    const daysSince = Math.floor((Date.now() - refDate.getTime()) / 86400000)
    if (daysSince < 28) return
    const hasOpenFollowUp = company.tasks.some(
      t => t.status !== 'completed' && t.title.includes('[Auto] Kapcsolatfelvétel')
    )
    if (hasOpenFollowUp) return
    setAutoTaskCreated(true)
    const due = new Date()
    due.setDate(due.getDate() + 3)
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `[Auto] Kapcsolatfelvétel – ${company.name}`,
        description: `${daysSince} napja nincs aktivitás rögzítve ennél a partnernél.`,
        dueDate: due.toISOString().slice(0, 10),
        priority: 'high',
        status: 'pending',
        companyId: company.id,
      }),
    }).then(() => fetchCompany())
  }, [company, autoTaskCreated, fetchCompany])

  async function handleDeleteActivity(activityId: string) {
    if (!confirm('Törli ezt a bejegyzést?')) return
    await fetch(`/api/activities/${activityId}`, { method: 'DELETE' })
    fetchCompany()
  }

  // A cég nem törlődik — a temetőbe kerül, kötelező indokkal.
  async function moveToCemetery(reason: string) {
    setCemeteryBusy(true)
    await fetch(`/api/companies/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    setCemeteryBusy(false)
    setShowCemetery(false)
    router.push('/temeto')
  }

  async function handleToggleTask(task: Task) {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status: nextStatus, companyId: id }),
    })
    fetchCompany()
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Törli ezt a feladatot?')) return
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    fetchCompany()
  }

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64 text-gray-400">Betöltés...</div>
  }

  if (!company) {
    return (
      <div className="p-6">
        <p className="text-gray-500">A cég nem található.</p>
        <Link href="/companies" className="text-blue-600 hover:underline mt-2 inline-block">← Vissza</Link>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/companies')} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{company.name}</h1>
          {company.industry && <p className="text-sm text-gray-500 mt-0.5">{company.industry}</p>}
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
        {/* Left: company info */}
        <div className="space-y-4">
          {/* Email-sorozat — lead-állapotban vagy ha már van neki sorozata */}
          {(['prospect', 'cold_lead', 'warm_lead', 'interested'].includes(company.lifecycle ?? '') ||
            (parseSequence(company.emailSequence)?.steps.length ?? 0) > 0) && (
            <EmailSequencePanel companyId={company.id} initial={company.emailSequence} language={company.language} />
          )}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-lg mb-4">
              {company.name[0]}
            </div>

            <div className="space-y-3">
              {company.phone && (
                <a href={`tel:${company.phone}`} className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-green-600 transition-colors group">
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-green-50">
                    <Phone size={13} className="text-gray-500 group-hover:text-green-600" />
                  </div>
                  {company.phone}
                </a>
              )}
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-blue-600 transition-colors group">
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-blue-50">
                    <Globe size={13} className="text-gray-500 group-hover:text-blue-600" />
                  </div>
                  <span className="truncate">{company.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
              {(company.address || company.city) && (
                <div className="flex items-start gap-2.5 text-sm text-gray-600">
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin size={13} className="text-gray-500" />
                  </div>
                  <span>{[company.address, company.city, company.country].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {company.vatId && (
                <div className="text-xs text-gray-400 font-mono">MwSt-Nr.: {company.vatId}</div>
              )}
            </div>
          </div>

          {/* Business hours */}
          {company.businessHours && (() => {
            const DAYS_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
            const now = new Date()
            const todayIdx = (now.getDay() + 6) % 7
            const nowMin = now.getHours() * 60 + now.getMinutes()
            const bh = company.businessHours!

            const activePeriod = bh.periods.find(p => {
              if (!p.from || !p.until) return false
              const from = new Date(p.from)
              const until = new Date(p.until)
              until.setHours(23, 59, 59)
              return now >= from && now <= until
            })
            const schedule = activePeriod ? activePeriod.days : bh.regular
            const todaySchedule = schedule.find(d => d.day === todayIdx)

            const isOpenNow = todaySchedule && !todaySchedule.closed && (() => {
              const [oh, om] = todaySchedule.open.split(':').map(Number)
              const [ch, cm] = todaySchedule.close.split(':').map(Number)
              return nowMin >= oh * 60 + om && nowMin < ch * 60 + cm
            })()

            return (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Nyitvatartás</h3>
                  {todaySchedule && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOpenNow ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {isOpenNow ? 'Nyitva' : 'Zárva'}
                    </span>
                  )}
                </div>
                {activePeriod && (
                  <p className="text-xs text-blue-600 font-medium mb-2">{activePeriod.label}</p>
                )}
                <div className="space-y-1">
                  {schedule.map(d => (
                    <div key={d.day} className={`flex items-center justify-between text-xs ${d.day === todayIdx ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                      <span className="w-8">{DAYS_SHORT[d.day]}</span>
                      {d.closed
                        ? <span className="text-gray-300">Zárva</span>
                        : <span>{d.open} – {d.close}</span>
                      }
                    </div>
                  ))}
                </div>
                {bh.periods.length > 0 && !activePeriod && (
                  <p className="text-xs text-gray-400 mt-2">
                    {bh.periods.length} időszak beállítva
                  </p>
                )}
              </div>
            )
          })()}

          {/* Dormancy warning */}
          {(() => {
            const lastAct = company.activities[0]?.activityDate
            const refDate = lastAct ? new Date(lastAct) : new Date(company.createdAt)
            const days = Math.floor((Date.now() - refDate.getTime()) / 86400000)
            if (days >= 28) return (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5">
                <Bell size={15} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">{days} napja nincs aktivitás</p>
                  <p className="text-xs text-red-500 mt-0.5">Automatikus feladat létrehozva. Ideje felvenni a kapcsolatot!</p>
                </div>
              </div>
            )
            if (days >= 21) return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                <Bell size={15} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-700">{days} napja nincs aktivitás</p>
                  <p className="text-xs text-amber-500 mt-0.5">Érdemes hamarosan felvenni a kapcsolatot.</p>
                </div>
              </div>
            )
            return null
          })()}

          {/* Stats */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Összesítés</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Kapcsolattartók</span>
                <span className="font-medium">{company.contacts.length} fő</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Kommunikáció</span>
                <span className="font-medium">{company.activities.length} bejegyzés</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Feladatok</span>
                <span className="font-medium">{company.tasks.filter(t => t.status !== 'completed').length} nyitott</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dealek</span>
                <span className="font-medium">{company.deals.length} db</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ajánlatok</span>
                <span className="font-medium">{company.quotes.length} db</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Megrendelések</span>
                <span className="font-medium">{company.orders.length} db</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="text-gray-500">Számlázott</span>
                <span className="font-semibold">{fmtEur(company.invoices.reduce((s, i) => s + i.total, 0))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: tabs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
            {([
              { key: 'timeline', label: 'Kommunikáció', count: company.activities.length },
              { key: 'levelezes', label: 'Levelezés', count: 0 },
              { key: 'contacts', label: 'Kapcsolatok', count: company.contacts.length },
              { key: 'tasks', label: 'Feladatok', count: company.tasks.length },
              { key: 'memory', label: 'Memória', count: 0 },
              { key: 'templates', label: 'Sablonok', count: 0 },
              { key: 'deals', label: 'Dealek', count: company.deals.length },
              { key: 'quotes', label: 'Ajánlatok', count: company.quotes.length },
              { key: 'orders', label: 'Rendelések', count: company.orders.length },
              { key: 'invoices', label: 'Számlák', count: company.invoices.length },
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

          {/* Timeline */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Kommunikáció történet</h2>
                <button onClick={() => setShowActivityModal(true)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Plus size={14} />Új bejegyzés
                </button>
              </div>
              {company.activities.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <PhoneCall size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Még nincs kommunikációs bejegyzés.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {company.activities.map((activity) => {
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
                              {activity.subject && <p className="text-sm font-semibold text-gray-900 mt-0.5">{activity.subject}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock size={10} />
                                {format(new Date(activity.activityDate), 'MMM d. HH:mm', { locale: hu })}
                              </span>
                              <button
                                onClick={() => { setEditActivity(activity); setShowActivityModal(true) }}
                                className="text-gray-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Edit2 size={13} />
                              </button>
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
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">→ {activity.outcome}</span>
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

          {/* Levelezés */}
          {activeTab === 'levelezes' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <CompanyEmails companyId={id} />
            </div>
          )}

          {/* Contacts */}
          {activeTab === 'contacts' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Kapcsolattartók ({company.contacts.length})</h2>
                <button
                  onClick={() => setShowNewContactModal(true)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus size={14} />Új kapcsolat
                </button>
              </div>
              {company.contacts.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 text-sm">
                  <Users size={32} className="text-gray-200 mx-auto mb-3" />
                  Nincs kapcsolattartó ennél a cégnél.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {company.contacts.map((c) => {
                    const cs = CONTACT_STATUS[c.status]
                    return (
                      <Link key={c.id} href={`/contacts/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-gray-400">{c.email || c.phone || '-'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cs?.color || ''}`}>{cs?.label || c.status}</span>
                          <ChevronRight size={14} className="text-gray-300" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tasks */}
          {activeTab === 'tasks' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Feladatok ({company.tasks.length})</h2>
                <button
                  onClick={() => setShowNewTaskModal(true)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus size={14} />Új feladat
                </button>
              </div>
              {company.tasks.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 text-sm">
                  <CheckCircle2 size={32} className="text-gray-200 mx-auto mb-3" />
                  Nincs feladat ehhez a céghez.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {company.tasks.map((task) => {
                    const overdue = task.dueDate && task.status !== 'completed' && isPast(new Date(task.dueDate))
                    return (
                      <div key={task.id} className="px-5 py-3 flex items-start gap-3 group">
                        <button
                          onClick={() => handleToggleTask(task)}
                          className="mt-0.5 shrink-0 text-gray-300 hover:text-green-500 transition-colors"
                        >
                          {task.status === 'completed'
                            ? <CheckCircle2 size={18} className="text-green-500" />
                            : <Circle size={18} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {task.title}
                          </p>
                          {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {task.dueDate && (
                              <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                                {overdue && <AlertCircle size={10} />}
                                <Clock size={10} />
                                {format(new Date(task.dueDate), 'MMM d.', { locale: hu })}
                              </span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              task.priority === 'high' ? 'bg-red-100 text-red-600' :
                              task.priority === 'medium' ? 'bg-amber-100 text-amber-600' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {task.priority === 'high' ? 'Sürgős' : task.priority === 'medium' ? 'Közepes' : 'Alacsony'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Memory */}
          {activeTab === 'memory' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Memória</h2>
              <MemoryTab companyId={id} />
            </div>
          )}

          {/* Templates */}
          {activeTab === 'templates' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Kommunikációs sablonok</h2>
              <TemplatesTab companyId={id} />
            </div>
          )}

          {/* Deals */}
          {activeTab === 'deals' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Dealek ({company.deals.length})</h2>
              </div>
              {company.deals.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 text-sm">Nincs deal.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {company.deals.map((deal) => (
                    <div key={deal.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{deal.title}</p>
                        <p className="text-xs text-gray-400">{DEAL_STAGE_LABELS[deal.stage] || deal.stage}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{fmtEur(deal.value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quotes */}
          {activeTab === 'quotes' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Ajánlatok ({company.quotes.length})</h2>
                <Link href="/quotes" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  Összes <ChevronRight size={14} />
                </Link>
              </div>
              {company.quotes.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 text-sm">Nincs ajánlat.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {company.quotes.map((q) => {
                    const qs = QUOTE_STATUS[q.status]
                    return (
                      <div key={q.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium font-mono text-gray-900">{q.number}</p>
                          <p className="text-xs text-gray-400">{format(new Date(q.date), 'yyyy. MMM d.', { locale: hu })}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${qs?.color || ''}`}>{qs?.label || q.status}</span>
                          <p className="text-sm font-semibold">{fmtEur(q.total)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Orders */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Megrendelések ({company.orders.length})</h2>
                <Link href="/orders" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  Összes <ChevronRight size={14} />
                </Link>
              </div>
              {company.orders.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 text-sm">Nincs megrendelés.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {company.orders.map((o) => {
                    const os = ORDER_STATUS[o.status]
                    return (
                      <button
                        key={o.id}
                        onClick={async () => {
                          const res = await fetch(`/api/orders/${o.id}`)
                          if (res.ok) setPreviewOrderData(await res.json())
                        }}
                        className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-medium font-mono text-gray-900 hover:text-blue-600">{o.number}</p>
                          <p className="text-xs text-gray-400">{format(new Date(o.date), 'yyyy. MMM d.', { locale: hu })}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${os?.color || ''}`}>{os?.label || o.status}</span>
                          <p className="text-sm font-semibold">{fmtEur(o.total)}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Invoices */}
          {activeTab === 'invoices' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Számlák ({company.invoices.length})</h2>
              </div>
              {company.invoices.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 text-sm">Nincs számla.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {company.invoices.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={async () => {
                        const res = await fetch(`/api/invoices/${inv.id}`)
                        if (res.ok) setPreviewInvoiceFull(await res.json())
                      }}
                      className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium font-mono text-gray-900 hover:text-blue-600">{inv.number}</p>
                        <p className="text-xs text-gray-400">{format(new Date(inv.date), 'yyyy. MMM d.', { locale: hu })}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                          inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {inv.status === 'paid' ? 'Fizetve' : inv.status === 'overdue' ? 'Lejárt' : 'Nyitott'}
                        </span>
                        <p className="text-sm font-semibold">{fmtEur(inv.total)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
        <button
          onClick={() => setShowCemetery(true)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <Trash2 size={14} />
          Temetőbe helyezés
        </button>
      </div>

      {showCemetery && company && (
        <LostReasonModal
          entityName={company.name}
          busy={cemeteryBusy}
          onCancel={() => setShowCemetery(false)}
          onConfirm={moveToCemetery}
        />
      )}

      {showEditModal && (
        <Modal title="Cég szerkesztése" onClose={() => setShowEditModal(false)}>
          <CompanyForm
            company={company}
            onSave={() => { setShowEditModal(false); fetchCompany() }}
            onCancel={() => setShowEditModal(false)}
          />
        </Modal>
      )}

      {showActivityModal && (
        <Modal
          title={editActivity ? 'Aktivitás szerkesztése' : 'Kommunikáció rögzítése'}
          onClose={() => { setShowActivityModal(false); setEditActivity(null) }}
        >
          <ActivityForm
            companyId={id}
            editActivity={editActivity}
            onSave={() => { setShowActivityModal(false); setEditActivity(null); fetchCompany() }}
            onCancel={() => { setShowActivityModal(false); setEditActivity(null) }}
          />
        </Modal>
      )}

      {showNewContactModal && (
        <Modal title="Új kapcsolattartó" onClose={() => setShowNewContactModal(false)}>
          <ContactForm
            contact={null}
            defaultCompanyId={id}
            onSave={() => { setShowNewContactModal(false); fetchCompany() }}
            onCancel={() => setShowNewContactModal(false)}
          />
        </Modal>
      )}

      {showNewTaskModal && (
        <Modal title="Új feladat" onClose={() => setShowNewTaskModal(false)} size="lg">
          <TaskForm
            task={null}
            defaultCompanyId={id}
            onSave={() => { setShowNewTaskModal(false); fetchCompany() }}
            onCancel={() => setShowNewTaskModal(false)}
          />
        </Modal>
      )}

      {previewInvoiceFull && (
        <Modal title={`Számla: ${(previewInvoiceFull as {number: string}).number}`} onClose={() => setPreviewInvoiceFull(null)} size="xl">
          <InvoicePreview invoice={previewInvoiceFull as unknown as Parameters<typeof InvoicePreview>[0]['invoice']} />
        </Modal>
      )}

      {previewOrderData && (
        <Modal title={`Megrendelés: ${(previewOrderData as {number: string}).number}`} onClose={() => setPreviewOrderData(null)} size="lg">
          {(() => {
            const o = previewOrderData as { number: string; date: string; total: number; status: string; items: {id: string; description: string; quantity: number; unitPrice: number; total: number}[]; notes: string | null; company: {name: string} | null; contact: {firstName: string; lastName: string} | null }
            return (
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-gray-600">
                  {o.company && <span className="font-semibold text-gray-900">{o.company.name}</span>}
                  <span>{format(new Date(o.date), 'yyyy. MMM d.', { locale: hu })}</span>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-xs text-gray-500"><th className="text-left py-1.5">Termék</th><th className="text-right py-1.5 px-2">Menny.</th><th className="text-right py-1.5 px-2">Egységár</th><th className="text-right py-1.5">Összesen</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {o.items.map(item => (
                      <tr key={item.id}><td className="py-1.5 pr-4">{item.description}</td><td className="py-1.5 px-2 text-right">{item.quantity} db</td><td className="py-1.5 px-2 text-right">€{item.unitPrice.toFixed(2)}</td><td className="py-1.5 text-right font-semibold">€{item.total.toFixed(2)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-right font-bold text-gray-900 border-t pt-2">Összesen: €{o.total.toFixed(2)}</div>
                {o.notes && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{o.notes}</p>}
                <div className="flex justify-end">
                  <a href={`/orders/${(previewOrderData as {id: string}).id}/print`} target="_blank" className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">🖨️ Nyomtatás</a>
                </div>
              </div>
            )
          })()}
        </Modal>
      )}
    </div>
  )
}
