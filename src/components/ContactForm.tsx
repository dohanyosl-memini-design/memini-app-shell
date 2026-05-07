'use client'

import { useState, useEffect } from 'react'

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
}

interface ContactFormProps {
  contact: Contact | null
  defaultCompanyId?: string
  onSave: () => void
  onCancel: () => void
}

export default function ContactForm({ contact, defaultCompanyId, onSave, onCancel }: ContactFormProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    status: contact?.status || 'lead',
    notes: contact?.notes || '',
    companyId: contact?.companyId || defaultCompanyId || '',
  })

  useEffect(() => {
    fetch('/api/companies').then((r) => r.json()).then(setCompanies)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const method = contact ? 'PUT' : 'POST'
    const url = contact ? `/api/contacts/${contact.id}` : '/api/contacts'

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
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
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vezetéknév *</label>
          <input
            required
            type="text"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Státusz</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="lead">Érdeklődő</option>
            <option value="active">Aktív</option>
            <option value="inactive">Inaktív</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cég</label>
          <select
            value={form.companyId}
            onChange={(e) => setForm({ ...form, companyId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Nincs megadva</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Mégse
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Mentés...' : 'Mentés'}
        </button>
      </div>
    </form>
  )
}
