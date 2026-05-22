'use client'

import { useState } from 'react'

interface Supplier {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  zip: string | null
  country: string | null
  website: string | null
  vatId: string | null
  notes: string | null
}

interface Props {
  supplier?: Supplier | null
  onSave: () => void
  onCancel: () => void
}

const COUNTRIES = [
  { code: 'DE', label: 'Németország' },
  { code: 'AT', label: 'Ausztria' },
  { code: 'CH', label: 'Svájc' },
  { code: 'HU', label: 'Magyarország' },
  { code: 'IT', label: 'Olaszország' },
  { code: 'FR', label: 'Franciaország' },
  { code: 'PL', label: 'Lengyelország' },
  { code: 'CZ', label: 'Csehország' },
  { code: 'SK', label: 'Szlovákia' },
  { code: 'RO', label: 'Románia' },
  { code: 'CN', label: 'Kína' },
  { code: 'TR', label: 'Törökország' },
]

export default function SupplierForm({ supplier, onSave, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    city: supplier?.city ?? '',
    zip: supplier?.zip ?? '',
    country: supplier?.country ?? 'DE',
    website: supplier?.website ?? '',
    vatId: supplier?.vatId ?? '',
    notes: supplier?.notes ?? '',
  })

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const method = supplier ? 'PUT' : 'POST'
    const url = supplier ? `/api/suppliers/${supplier.id}` : '/api/suppliers'
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Cégnév *</label>
          <input required value={form.name} onChange={e => set('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kapcsolattartó neve</label>
          <input value={form.contactName} onChange={e => set('contactName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Weboldal</label>
          <input value={form.website} onChange={e => set('website', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Cím</label>
          <input value={form.address} onChange={e => set('address', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Város</label>
          <input value={form.city} onChange={e => set('city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Irányítószám</label>
          <input value={form.zip} onChange={e => set('zip', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ország</label>
          <select value={form.country} onChange={e => set('country', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Adószám</label>
          <input value={form.vatId} onChange={e => set('vatId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés</label>
          <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
          Mégse
        </button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
          {loading ? 'Mentés...' : supplier ? 'Módosítás' : 'Hozzáadás'}
        </button>
      </div>
    </form>
  )
}
