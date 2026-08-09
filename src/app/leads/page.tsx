'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, Search, X, Building2, Clock, ArrowRight, MapPin, User,
  CheckCircle, Skull, StickyNote,
} from 'lucide-react'
import Modal from '@/components/Modal'
import LostReasonModal from '@/components/LostReasonModal'

// ─────────────────────────────────────────────────────────────────────────
// Lead CRM — kanban a CÉGEK felett (nem a kapcsolatok felett). A lead-életciklus
// a cégen él: prospekt → hideg lead → érdeklődő. Partnerré az első rendelés
// (vagy a „Partnerré" gomb) tesz — az átteszi a Partner CRM-be, és itt eltűnik.
// ─────────────────────────────────────────────────────────────────────────

interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
}

interface Company {
  id: string
  name: string
  city: string | null
  region: string | null
  country: string | null
  partnerType: string | null
  notes: string | null
  lifecycle: string
  contacts?: Contact[]
  _count?: { contacts: number; deals: number; orders: number }
  createdAt: string
}

const STAGES = [
  {
    id: 'prospect',
    label: 'Prospekt',
    hint: 'Nem tud rólunk — érdemes megkeresni',
    color: 'border-slate-300 bg-slate-50',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600',
    next: 'cold_lead',
    nextLabel: 'Hideg lead',
  },
  {
    id: 'cold_lead',
    label: 'Hideg lead',
    hint: 'Megkerestük, válasz még nincs',
    color: 'border-blue-300 bg-blue-50',
    dot: 'bg-blue-400',
    badge: 'bg-blue-100 text-blue-700',
    next: 'interested',
    nextLabel: 'Érdeklődő',
  },
  {
    id: 'interested',
    label: 'Érdeklődő',
    hint: 'Visszajelzett, kéri a mintákat',
    color: 'border-amber-300 bg-amber-50',
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-700',
    next: null,
    nextLabel: null,
  },
] as const

type Stage = (typeof STAGES)[number]

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}
function daysLabel(d: number): string {
  if (d === 0) return 'Ma'
  if (d === 1) return '1 napja'
  return `${d} napja`
}
function primaryContact(c: Company): Contact | null {
  return c.contacts && c.contacts.length > 0 ? c.contacts[0] : null
}
function noteSnippet(notes: string | null): string | null {
  if (!notes) return null
  const t = notes.trim()
  return t.length > 80 ? t.slice(0, 78) + '…' : t
}

// ── Kártya ──
function CompanyCard({
  company, stage, onDragStart, onDragEnd, isDragging,
  onMoveNext, onPromote, onLost, onClick,
}: {
  company: Company
  stage: Stage
  onDragStart: (c: Company) => void
  onDragEnd: () => void
  isDragging: boolean
  onMoveNext: (c: Company) => void
  onPromote: (c: Company) => void
  onLost: (c: Company) => void
  onClick: (c: Company) => void
}) {
  const contact = primaryContact(company)
  const snippet = noteSnippet(company.notes)
  const days = daysSince(company.createdAt)

  return (
    <div
      draggable
      onDragStart={() => onDragStart(company)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(company)}
      className={`bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm cursor-pointer select-none group transition-all ${
        isDragging ? 'opacity-40 scale-95' : 'hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      <div className="flex items-start gap-2.5 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${stage.badge}`}>
          <Building2 size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{company.name}</p>
          {(company.city || company.partnerType) && (
            <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
              {company.city && <><MapPin size={10} className="shrink-0" />{company.city}</>}
              {company.partnerType && <span className="text-blue-500">· {company.partnerType}</span>}
            </p>
          )}
        </div>
      </div>

      {contact && (
        <p className="text-xs text-gray-500 flex items-center gap-1 mb-1 truncate">
          <User size={10} className="shrink-0 text-gray-400" />
          {contact.firstName} {contact.lastName}
        </p>
      )}
      {snippet && <p className="text-xs text-gray-400 italic mb-2 line-clamp-2 leading-relaxed">{snippet}</p>}

      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
          <Clock size={10} />{daysLabel(days)}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {stage.next && (
            <button
              onClick={() => onMoveNext(company)}
              title={`→ ${stage.nextLabel}`}
              className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <ArrowRight size={13} />
            </button>
          )}
          {stage.id === 'interested' && (
            <button
              onClick={() => onPromote(company)}
              title="Partnerré alakít (átkerül a Partner CRM-be)"
              className="p-1 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
            >
              <CheckCircle size={13} />
            </button>
          )}
          <button
            onClick={() => onLost(company)}
            title="Elvesztett (temetőbe, indokkal)"
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Skull size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Oszlop ──
function KanbanColumn({
  stage, companies, draggingId, onDragStart, onDragEnd, onDrop,
  onMoveNext, onPromote, onLost, onCardClick,
}: {
  stage: Stage
  companies: Company[]
  draggingId: string | null
  onDragStart: (c: Company) => void
  onDragEnd: () => void
  onDrop: (stageId: string) => void
  onMoveNext: (c: Company) => void
  onPromote: (c: Company) => void
  onLost: (c: Company) => void
  onCardClick: (c: Company) => void
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(stage.id) }}
      className={`rounded-2xl border-2 border-dashed p-3 transition-colors ${over ? stage.color : 'border-transparent bg-gray-50/60'}`}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
          <h3 className="text-sm font-semibold text-gray-700">{stage.label}</h3>
        </div>
        <span className="text-xs font-medium text-gray-400">{companies.length}</span>
      </div>
      <p className="text-[11px] text-gray-400 px-1 mb-3">{stage.hint}</p>
      <div className="space-y-2.5 min-h-[80px]">
        {companies.map((c) => (
          <CompanyCard
            key={c.id}
            company={c}
            stage={stage}
            isDragging={draggingId === c.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onMoveNext={onMoveNext}
            onPromote={onPromote}
            onLost={onLost}
            onClick={onCardClick}
          />
        ))}
      </div>
    </div>
  )
}

// ── Új lead form (céget hoz létre prospektként, opcionális kapcsolattal) ──
function NewLeadForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: '', city: '', partnerType: '', notes: '',
    firstName: '', lastName: '', email: '', phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          city: form.city.trim() || null,
          partnerType: form.partnerType.trim() || null,
          notes: form.notes.trim() || null,
          lifecycle: 'prospect',
        }),
      })
      if (!res.ok) throw new Error()
      const company = await res.json()
      // Opcionális kapcsolattartó — ha megadták a nevét, hozzákötjük a céghez.
      if (form.firstName.trim() || form.lastName.trim()) {
        await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: form.firstName.trim() || '—',
            lastName: form.lastName.trim() || '',
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            companyId: company.id,
            status: 'lead',
          }),
        })
      }
      onSave()
    } catch {
      setError('Hiba a mentés során. Próbáld újra.')
    } finally {
      setLoading(false)
    }
  }

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cég / helyszín neve <span className="text-red-500">*</span></label>
        <input required value={form.name} onChange={(e) => set('name', e.target.value)} className={input} placeholder="pl. Burg Hohenzollern Shop" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Város</label>
          <input value={form.city} onChange={(e) => set('city', e.target.value)} className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Típus</label>
          <input value={form.partnerType} onChange={(e) => set('partnerType', e.target.value)} className={input} placeholder="Múzeum, Vár, Bolt…" />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Kapcsolattartó (opcionális)</p>
        <div className="grid grid-cols-2 gap-4">
          <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className={input} placeholder="Keresztnév" />
          <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={input} placeholder="Vezetéknév" />
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={input} placeholder="Email" />
          <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={input} placeholder="Telefon" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés</label>
        <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={`${input} resize-none`} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium">Mégse</button>
        <button type="submit" disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
          {loading ? 'Mentés…' : 'Lead hozzáadása'}
        </button>
      </div>
    </form>
  )
}

export default function LeadsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [lostTarget, setLostTarget] = useState<Company | null>(null)
  const [lostBusy, setLostBusy] = useState(false)

  const dragging = useRef<Company | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ view: 'leads' })
    if (search) params.set('search', search)
    const res = await fetch(`/api/companies?${params}`)
    const data = await res.json()
    setCompanies(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  function onDragStart(c: Company) { dragging.current = c; setDraggingId(c.id) }
  function onDragEnd() { dragging.current = null; setDraggingId(null) }

  async function moveTo(company: Company, to: string) {
    // Optimista frissítés; hiba esetén visszatöltünk.
    setCompanies((prev) => prev.map((x) => x.id === company.id ? { ...x, lifecycle: to } : x))
    const res = await fetch(`/api/companies/${company.id}/lifecycle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    })
    if (!res.ok) fetchLeads()
  }

  async function onDrop(stageId: string) {
    const c = dragging.current
    dragging.current = null
    setDraggingId(null)
    if (!c || c.lifecycle === stageId) return
    await moveTo(c, stageId)
  }

  async function promote(company: Company) {
    // A cég partnerré válik és átkerül a Partner CRM-be → eltűnik a leadek közül.
    setCompanies((prev) => prev.filter((x) => x.id !== company.id))
    const res = await fetch(`/api/companies/${company.id}/lifecycle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'partner' }),
    })
    if (!res.ok) fetchLeads()
  }

  async function confirmLost(reason: string) {
    if (!lostTarget) return
    setLostBusy(true)
    await fetch(`/api/companies/${lostTarget.id}/lifecycle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'lost_lead', reason }),
    })
    setLostBusy(false)
    setLostTarget(null)
    fetchLeads()
  }

  function moveNext(c: Company) {
    const s = STAGES.find((st) => st.id === c.lifecycle)
    if (s?.next) moveTo(c, s.next)
  }

  const byStage = (id: string) => companies.filter((c) => c.lifecycle === id)
  const total = companies.length

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead CRM</h1>
          <p className="text-gray-500 mt-0.5 text-sm">{total} lead a tölcsérben — partnerré az első rendelés tesz</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/temeto" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50" title="Elvesztett leadek és partnerek">
            <Skull size={15} /><span className="hidden sm:inline">Temető</span>
          </Link>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm">
            <Plus size={16} /> Új lead
          </button>
        </div>
      </div>

      {/* Stat sáv */}
      <div className="flex flex-wrap gap-2 mb-5">
        {STAGES.map((s) => (
          <div key={s.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${s.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}: <strong>{byStage(s.id).length}</strong>
          </div>
        ))}
      </div>

      {/* Kereső */}
      <div className="mb-5 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Keresés cég, város alapján…"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
        )}
      </div>

      {loading ? (
        <div className="py-24 text-center text-gray-400">Betöltés…</div>
      ) : total === 0 ? (
        <div className="py-20 text-center">
          <Building2 className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500">Még nincs lead. Add hozzá az elsőt, vagy Arthur is felveheti őket.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              companies={byStage(stage.id)}
              draggingId={draggingId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              onMoveNext={moveNext}
              onPromote={promote}
              onLost={setLostTarget}
              onCardClick={(c) => { window.location.href = `/companies/${c.id}` }}
            />
          ))}
        </div>
      )}

      {showNew && (
        <Modal title="Új lead hozzáadása" onClose={() => setShowNew(false)} size="lg">
          <NewLeadForm onSave={() => { setShowNew(false); fetchLeads() }} onCancel={() => setShowNew(false)} />
        </Modal>
      )}

      {lostTarget && (
        <LostReasonModal
          entityName={lostTarget.name}
          busy={lostBusy}
          onCancel={() => setLostTarget(null)}
          onConfirm={confirmLost}
        />
      )}
    </div>
  )
}
