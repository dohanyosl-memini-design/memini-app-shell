'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus, Search, X, ChevronDown, ChevronUp, Mail, Phone,
  Building2, Clock, ArrowRight, UserX, CheckCircle, Edit2,
  User, StickyNote,
} from 'lucide-react'
import Modal from '@/components/Modal'

interface Company {
  id: string
  name: string
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  status: string
  notes: string | null
  companyId: string | null
  company: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

const STAGES = [
  {
    id: 'lead',
    label: 'Hideg lead',
    color: 'border-blue-300 bg-blue-50',
    dot: 'bg-blue-400',
    badge: 'bg-blue-100 text-blue-700',
    ring: 'ring-blue-400',
    nextStage: 'contacted',
    nextLabel: 'Megkeresve',
  },
  {
    id: 'contacted',
    label: 'Megkeresve',
    color: 'border-purple-300 bg-purple-50',
    dot: 'bg-purple-400',
    badge: 'bg-purple-100 text-purple-700',
    ring: 'ring-purple-400',
    nextStage: 'meeting',
    nextLabel: 'Egyeztetés',
  },
  {
    id: 'meeting',
    label: 'Egyeztetés',
    color: 'border-amber-300 bg-amber-50',
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-700',
    ring: 'ring-amber-400',
    nextStage: 'proposal',
    nextLabel: 'Ajánlat küldve',
  },
  {
    id: 'proposal',
    label: 'Ajánlat küldve',
    color: 'border-orange-300 bg-orange-50',
    dot: 'bg-orange-400',
    badge: 'bg-orange-100 text-orange-700',
    ring: 'ring-orange-400',
    nextStage: 'active',
    nextLabel: 'Aktív partner',
  },
  {
    id: 'active',
    label: 'Aktív partner',
    color: 'border-green-300 bg-green-50',
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-700',
    ring: 'ring-green-400',
    nextStage: null,
    nextLabel: null,
  },
]

const STAGE_ORDER = STAGES.map((s) => s.id)

function daysSince(dateStr: string): number {
  const then = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
}

function daysLabel(days: number): string {
  if (days === 0) return 'Ma'
  if (days === 1) return '1 napja'
  return `${days} napja`
}

function initials(c: Contact): string {
  return (c.firstName[0] || '') + (c.lastName[0] || '')
}

function fullName(c: Contact): string {
  return `${c.firstName} ${c.lastName}`
}

function noteSnippet(notes: string | null): string | null {
  if (!notes) return null
  const trimmed = notes.trim()
  return trimmed.length > 70 ? trimmed.slice(0, 68) + '…' : trimmed
}

// ── Conversion rate: lead → active, out of all non-lost contacts
function conversionRate(contacts: Contact[]): number {
  const relevant = contacts.filter((c) => c.status !== 'lost')
  if (relevant.length === 0) return 0
  const active = relevant.filter((c) => c.status === 'active').length
  return Math.round((active / relevant.length) * 100)
}

// ─────────────────────────────────────────────
// Contact Card
// ─────────────────────────────────────────────
function ContactCard({
  contact,
  stage,
  onDragStart,
  onDragEnd,
  isDragging,
  onClick,
  onMoveNext,
  onMarkLost,
  onMarkActive,
}: {
  contact: Contact
  stage: typeof STAGES[0]
  onDragStart: (c: Contact) => void
  onDragEnd: () => void
  isDragging: boolean
  onClick: (c: Contact) => void
  onMoveNext: (c: Contact) => void
  onMarkLost: (c: Contact) => void
  onMarkActive: (c: Contact) => void
}) {
  const days = daysSince(contact.createdAt)
  const snippet = noteSnippet(contact.notes)

  return (
    <div
      draggable
      onDragStart={() => onDragStart(contact)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(contact)}
      className={`bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm cursor-pointer select-none group transition-all ${
        isDragging ? 'opacity-40 scale-95 cursor-grabbing' : 'hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {/* Header: avatar + name + company */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${stage.badge}`}>
          {initials(contact)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{fullName(contact)}</p>
          {contact.company && (
            <p className="text-xs text-gray-400 flex items-center gap-0.5 truncate">
              <Building2 size={10} className="shrink-0" />
              {contact.company.name}
            </p>
          )}
        </div>
      </div>

      {/* Contact info */}
      <div className="space-y-0.5 mb-2">
        {contact.email && (
          <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
            <Mail size={10} className="shrink-0 text-gray-400" />
            {contact.email}
          </p>
        )}
        {contact.phone && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Phone size={10} className="shrink-0 text-gray-400" />
            {contact.phone}
          </p>
        )}
      </div>

      {/* Note snippet */}
      {snippet && (
        <p className="text-xs text-gray-400 italic mb-2 line-clamp-2 leading-relaxed">{snippet}</p>
      )}

      {/* Footer: days + action buttons */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
          <Clock size={10} />
          {daysLabel(days)}
        </span>
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {stage.nextStage && stage.nextStage !== 'active' && (
            <button
              onClick={() => onMoveNext(contact)}
              title={`→ ${stage.nextLabel}`}
              className="p-1 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
            >
              <ArrowRight size={13} />
            </button>
          )}
          {stage.id !== 'active' && (
            <button
              onClick={() => onMarkActive(contact)}
              title="Aktív partner"
              className="p-1 text-gray-400 hover:text-green-600 rounded-md hover:bg-green-50 transition-colors"
            >
              <CheckCircle size={13} />
            </button>
          )}
          <button
            onClick={() => onMarkLost(contact)}
            title="Elveszített"
            className="p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
          >
            <UserX size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Kanban Column
// ─────────────────────────────────────────────
function KanbanColumn({
  stage,
  contacts,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop,
  onCardClick,
  onMoveNext,
  onMarkLost,
  onMarkActive,
}: {
  stage: typeof STAGES[0]
  contacts: Contact[]
  draggingId: string | null
  onDragStart: (c: Contact) => void
  onDragEnd: () => void
  onDrop: (stageId: string) => void
  onCardClick: (c: Contact) => void
  onMoveNext: (c: Contact) => void
  onMarkLost: (c: Contact) => void
  onMarkActive: (c: Contact) => void
}) {
  const [over, setOver] = useState(false)

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 ${stage.color} min-h-[580px] transition-colors ${
        over && draggingId ? `ring-2 ${stage.ring} ring-offset-1` : ''
      }`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(stage.id) }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${stage.dot}`} />
        <span className="text-sm font-semibold text-gray-700">{stage.label}</span>
        <span className="ml-auto text-xs font-medium text-gray-400 bg-white rounded-full px-2 py-0.5">
          {contacts.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
        {contacts.map((c) => (
          <ContactCard
            key={c.id}
            contact={c}
            stage={stage}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggingId === c.id}
            onClick={onCardClick}
            onMoveNext={onMoveNext}
            onMarkLost={onMarkLost}
            onMarkActive={onMarkActive}
          />
        ))}

        {over && draggingId && (
          <div className="h-16 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/60 opacity-60" />
        )}

        {contacts.length === 0 && !over && (
          <div className="flex items-center justify-center h-20 text-xs text-gray-300">
            Nincs lead
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Detail Side Panel (rendered as modal)
// ─────────────────────────────────────────────
function DetailPanel({
  contact,
  onClose,
  onStatusChange,
  onEdit,
}: {
  contact: Contact
  onClose: () => void
  onStatusChange: (c: Contact, status: string) => void
  onEdit: (c: Contact) => void
}) {
  const stage = STAGES.find((s) => s.id === contact.status)
  const days = daysSince(contact.createdAt)

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${stage?.badge ?? 'bg-gray-100 text-gray-600'}`}>
          {initials(contact)}
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">{fullName(contact)}</h3>
          {contact.company && (
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Building2 size={13} />
              {contact.company.name}
            </p>
          )}
        </div>
      </div>

      {/* Stage badge */}
      {stage && (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${stage.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
            {stage.label}
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-0.5">
            <Clock size={11} />
            {daysLabel(days)}
          </span>
        </div>
      )}

      {/* Contact details */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        {contact.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail size={14} className="text-gray-400 shrink-0" />
            <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline truncate">
              {contact.email}
            </a>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone size={14} className="text-gray-400 shrink-0" />
            <a href={`tel:${contact.phone}`} className="text-gray-700 hover:underline">
              {contact.phone}
            </a>
          </div>
        )}
        {!contact.email && !contact.phone && (
          <p className="text-sm text-gray-400">Nincs elérhetőség megadva</p>
        )}
      </div>

      {/* Notes */}
      {contact.notes && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <StickyNote size={12} />
            Megjegyzések
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-amber-50 border border-amber-100 rounded-xl p-3">
            {contact.notes}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={() => onEdit(contact)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          <Edit2 size={14} />
          Szerkesztés
        </button>

        {contact.status !== 'active' && (
          <button
            onClick={() => onStatusChange(contact, 'active')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <CheckCircle size={14} />
            Aktív partnerré alakít
          </button>
        )}

        {/* Move to next stage */}
        {(() => {
          const currentStage = STAGES.find((s) => s.id === contact.status)
          if (currentStage?.nextStage && currentStage.nextStage !== 'active') {
            return (
              <button
                onClick={() => onStatusChange(contact, currentStage.nextStage!)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <ArrowRight size={14} />
                Következő fázis: {currentStage.nextLabel}
              </button>
            )
          }
          return null
        })()}

        {contact.status !== 'lost' && (
          <button
            onClick={() => onStatusChange(contact, 'lost')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors text-sm font-medium"
          >
            <UserX size={14} />
            Elveszített
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// New Lead Form
// ─────────────────────────────────────────────
interface NewLeadForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  companyId: string
  notes: string
}

function NewLeadFormPanel({
  companies,
  onSave,
  onCancel,
}: {
  companies: Company[]
  onSave: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<NewLeadForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyId: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof NewLeadForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          companyId: form.companyId || null,
          notes: form.notes.trim() || null,
          status: 'lead',
        }),
      })
      if (!res.ok) throw new Error('Mentési hiba')
      onSave()
    } catch {
      setError('Hiba történt a mentés során. Próbáld újra.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Keresztnév <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="text"
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="pl. Anna"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vezetéknév <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="text"
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="pl. Kovács"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cég</label>
        <select
          value={form.companyId}
          onChange={(e) => set('companyId', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">— Nincs megadva —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+36 30 …"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Honnan érkezett, mi érdekli..."
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          Mégse
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Mentés...' : 'Lead hozzáadása'}
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────
// Edit Contact Form (inline in modal)
// ─────────────────────────────────────────────
function EditContactForm({
  contact,
  companies,
  onSave,
  onCancel,
}: {
  contact: Contact
  companies: Company[]
  onSave: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email || '',
    phone: contact.phone || '',
    companyId: contact.companyId || '',
    notes: contact.notes || '',
    status: contact.status,
  })
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch(`/api/contacts/${contact.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        companyId: form.companyId || null,
        notes: form.notes.trim() || null,
      }),
    })
    setLoading(false)
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Keresztnév *</label>
          <input
            required
            type="text"
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vezetéknév *</label>
          <input
            required
            type="text"
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cég</label>
        <select
          value={form.companyId}
          onChange={(e) => set('companyId', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">— Nincs megadva —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Státusz</label>
        <select
          value={form.status}
          onChange={(e) => set('status', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
          <option value="lost">Elveszített</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
          Mégse
        </button>
        <button type="submit" disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50">
          {loading ? 'Mentés...' : 'Mentés'}
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────
// Stats Bar
// ─────────────────────────────────────────────
function StatsBar({ contacts }: { contacts: Contact[] }) {
  const total = contacts.filter((c) => c.status !== 'lost').length
  const rate = conversionRate(contacts)

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {STAGES.map((s) => {
        const count = contacts.filter((c) => c.status === s.id).length
        return (
          <div key={s.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${s.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}: <strong>{count}</strong>
          </div>
        )
      })}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        <User size={11} />
        Összes: <strong>{total}</strong>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
        Konverzió: <strong>{rate}%</strong>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
type ModalMode = 'new' | 'detail' | 'edit' | null

export default function LeadsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [lostExpanded, setLostExpanded] = useState(false)

  const dragging = useRef<Contact | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/contacts')
    const data = await res.json()
    setContacts(data)
    setLoading(false)
  }, [])

  const fetchCompanies = useCallback(async () => {
    const res = await fetch('/api/companies')
    const data = await res.json()
    setCompanies(data)
  }, [])

  useEffect(() => {
    fetchContacts()
    fetchCompanies()
  }, [fetchContacts, fetchCompanies])

  // ── Drag & Drop ──
  function onDragStart(c: Contact) {
    dragging.current = c
    setDraggingId(c.id)
  }

  function onDragEnd() {
    dragging.current = null
    setDraggingId(null)
  }

  async function onDrop(stageId: string) {
    const c = dragging.current
    if (!c || c.status === stageId) return
    dragging.current = null
    setDraggingId(null)
    // Optimistic update
    setContacts((prev) => prev.map((x) => x.id === c.id ? { ...x, status: stageId } : x))
    await fetch(`/api/contacts/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...c, status: stageId }),
    })
  }

  // ── Status change ──
  async function changeStatus(c: Contact, status: string) {
    setContacts((prev) => prev.map((x) => x.id === c.id ? { ...x, status } : x))
    await fetch(`/api/contacts/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...c, status }),
    })
    if (selectedContact?.id === c.id) {
      setSelectedContact((prev) => prev ? { ...prev, status } : prev)
    }
  }

  async function handleStatusChange(c: Contact, status: string) {
    await changeStatus(c, status)
    if (status === 'lost' || status === 'active') closeModal()
  }

  // ── Card click → detail panel ──
  function openDetail(c: Contact) {
    setSelectedContact(c)
    setModalMode('detail')
  }

  function openEdit(c: Contact) {
    setSelectedContact(c)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setSelectedContact(null)
  }

  function handleNewLeadSave() {
    closeModal()
    fetchContacts()
  }

  function handleEditSave() {
    closeModal()
    fetchContacts()
  }

  // ── Filter ──
  const pipelineStatuses = STAGE_ORDER
  const searchLower = search.toLowerCase()

  function matchesSearch(c: Contact): boolean {
    if (!search) return true
    return (
      fullName(c).toLowerCase().includes(searchLower) ||
      (c.email?.toLowerCase().includes(searchLower) ?? false) ||
      (c.phone?.includes(search) ?? false) ||
      (c.company?.name.toLowerCase().includes(searchLower) ?? false)
    )
  }

  const filtered = contacts.filter(matchesSearch)
  const byStage = (id: string) => filtered.filter((c) => c.status === id)
  const lostContacts = filtered.filter((c) => c.status === 'lost')

  return (
    <div className="p-4 md:p-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Pipeline</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {contacts.filter((c) => c.status !== 'lost').length} aktív lead a tölcsérben
          </p>
        </div>
        <button
          onClick={() => setModalMode('new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
        >
          <Plus size={16} />
          Új lead
        </button>
      </div>

      {/* ── Stats Bar ── */}
      <StatsBar contacts={contacts} />

      {/* ── Search ── */}
      <div className="mb-5">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="Keresés név, cég, email alapján..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Kanban Board ── */}
      {loading ? (
        <div className="py-24 text-center text-gray-400">Betöltés...</div>
      ) : (
        <>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => (
              <div key={stage.id} className="min-w-[260px] flex-shrink-0 xl:flex-1">
                <KanbanColumn
                  stage={stage}
                  contacts={byStage(stage.id)}
                  draggingId={draggingId}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDrop={onDrop}
                  onCardClick={openDetail}
                  onMoveNext={(c) => {
                    const s = STAGES.find((st) => st.id === c.status)
                    if (s?.nextStage) changeStatus(c, s.nextStage)
                  }}
                  onMarkLost={(c) => changeStatus(c, 'lost')}
                  onMarkActive={(c) => changeStatus(c, 'active')}
                />
              </div>
            ))}
          </div>

          {/* ── Lost Leads Collapsible ── */}
          {lostContacts.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setLostExpanded((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors mb-3"
              >
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Elveszített leadek ({lostContacts.length})
                {lostExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {lostExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {lostContacts.map((c) => {
                    const days = daysSince(c.createdAt)
                    return (
                      <div
                        key={c.id}
                        onClick={() => openDetail(c)}
                        className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm opacity-60 hover:opacity-90 cursor-pointer transition-all hover:shadow-md group"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-7 h-7 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xs font-bold shrink-0">
                            {initials(c)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{fullName(c)}</p>
                            {c.company && (
                              <p className="text-xs text-gray-400 truncate">{c.company.name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                            <Clock size={10} />
                            {daysLabel(days)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); changeStatus(c, 'lead') }}
                            className="text-[11px] text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity font-medium"
                          >
                            Visszaállít
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {modalMode === 'new' && (
        <Modal title="Új lead hozzáadása" onClose={closeModal} size="lg">
          <NewLeadFormPanel
            companies={companies}
            onSave={handleNewLeadSave}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {modalMode === 'detail' && selectedContact && (
        <Modal
          title={fullName(selectedContact)}
          onClose={closeModal}
          size="md"
        >
          <DetailPanel
            contact={selectedContact}
            onClose={closeModal}
            onStatusChange={handleStatusChange}
            onEdit={(c) => { closeModal(); setTimeout(() => openEdit(c), 50) }}
          />
        </Modal>
      )}

      {modalMode === 'edit' && selectedContact && (
        <Modal title="Lead szerkesztése" onClose={closeModal} size="lg">
          <EditContactForm
            contact={selectedContact}
            companies={companies}
            onSave={handleEditSave}
            onCancel={closeModal}
          />
        </Modal>
      )}
    </div>
  )
}
