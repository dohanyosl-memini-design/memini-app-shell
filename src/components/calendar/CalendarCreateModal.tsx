'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import { CheckSquare, Clock } from 'lucide-react'

interface Company { id: string; name: string }
interface Contact { id: string; firstName: string; lastName: string }
interface Deal { id: string; title: string }

export interface CreateInitial {
  date: string          // YYYY-MM-DD
  time: string          // '' vagy HH:mm
  kind: 'task' | 'appointment'
}

interface Props {
  initial: CreateInitial
  onClose: () => void
  onSaved: () => void
}

const DURATIONS = [15, 30, 45, 60, 90, 120]

export default function CalendarCreateModal({ initial, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<'task' | 'appointment'>(initial.kind)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [durationMin, setDurationMin] = useState(60)
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [notes, setNotes] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [contactId, setContactId] = useState('')
  const [dealId, setDealId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/companies').then((r) => r.json()).catch(() => []),
      fetch('/api/contacts').then((r) => r.json()).catch(() => []),
      fetch('/api/deals').then((r) => r.json()).catch(() => []),
    ]).then(([co, c, d]) => {
      setCompanies(Array.isArray(co) ? co : [])
      setContacts(Array.isArray(c) ? c : [])
      setDeals(Array.isArray(d) ? d : [])
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!title.trim()) { setError('A cím kötelező.'); return }
    if (kind === 'appointment' && !time) { setError('Időponthoz add meg a kezdést.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          title: title.trim(),
          date,
          time: time || undefined,
          durationMin: kind === 'appointment' ? durationMin : undefined,
          priority: kind === 'task' ? priority : undefined,
          notes: notes.trim() || undefined,
          companyId: companyId || undefined,
          contactId: contactId || undefined,
          dealId: dealId || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Nem sikerült menteni.')
        setSaving(false)
        return
      }
      onSaved()
    } catch {
      setError('Hálózati hiba.')
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'

  return (
    <Modal title="Új naptárbejegyzés" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Típusváltó */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button type="button" onClick={() => setKind('task')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium ${kind === 'task' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            <CheckSquare size={15} /> Feladat
          </button>
          <button type="button" onClick={() => setKind('appointment')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-gray-200 ${kind === 'appointment' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            <Clock size={15} /> Időpont
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cím *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder={kind === 'task' ? 'Pl. Alpha Kft felhívása' : 'Pl. Egyeztetés – Beta GmbH'} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dátum *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kezdés {kind === 'appointment' ? '*' : <span className="text-gray-400 font-normal">(üres = egész napos)</span>}
            </label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
          </div>
        </div>

        {kind === 'appointment' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hossz</label>
            <select value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value))} className={inputCls}>
              {DURATIONS.map((d) => <option key={d} value={d}>{d} perc</option>)}
            </select>
          </div>
        )}

        {kind === 'task' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prioritás</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')} className={inputCls}>
              <option value="low">Alacsony</option>
              <option value="medium">Közepes</option>
              <option value="high">Magas</option>
            </select>
          </div>
        )}

        {/* Kapcsolódás (opcionális) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cég</label>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Kapcsolat</label>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Deal</label>
            <select value={dealId} onChange={(e) => setDealId(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jegyzet</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Mégse</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Mentés...' : 'Létrehozás'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
