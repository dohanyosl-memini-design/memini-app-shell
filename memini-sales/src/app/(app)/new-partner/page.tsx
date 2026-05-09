'use client'

import { useState } from 'react'

const COUNTRIES = ['DE', 'AT', 'CH', 'HU', 'PL', 'CZ', 'SK', 'NL', 'FR', 'IT']

export default function NewPartnerPage() {
  const [form, setForm] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    country: 'DE',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.companyName && !form.lastName) {
      setError('Cégnév vagy kontaktnév kötelező.')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setLoading(false)

    if (res.ok) {
      setSuccess(true)
      setForm({ companyName: '', firstName: '', lastName: '', email: '', phone: '', city: '', country: 'DE', notes: '' })
    } else {
      const data = await res.json()
      setError(data.error || 'Hiba történt, próbáld újra.')
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
        <div className="text-6xl">✅</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Partner mentve!</h2>
          <p className="text-gray-500 mt-1">Az adatok bekerültek a CRM-be.</p>
        </div>
        <button
          onClick={() => setSuccess(false)}
          className="px-6 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition"
        >
          Új partner
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Új partner</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Section title="Cég adatok">
          <Field label="Cégnév" value={form.companyName} onChange={(v) => update('companyName', v)} placeholder="Mustermann GmbH" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Város" value={form.city} onChange={(v) => update('city', v)} placeholder="München" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ország</label>
              <select
                value={form.country}
                onChange={(e) => update('country', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        <Section title="Kapcsolattartó">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Keresztnév" value={form.firstName} onChange={(v) => update('firstName', v)} placeholder="Hans" />
            <Field label="Vezetéknév" value={form.lastName} onChange={(v) => update('lastName', v)} placeholder="Mustermann" />
          </div>
          <Field label="Email" value={form.email} onChange={(v) => update('email', v)} placeholder="hans@firma.de" type="email" />
          <Field label="Telefon" value={form.phone} onChange={(v) => update('phone', v)} placeholder="+49 170 1234567" type="tel" />
        </Section>

        <Section title="Megjegyzés">
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={3}
            placeholder="Érdeklődési terület, megjegyzések..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </Section>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition disabled:opacity-60 text-base"
        >
          {loading ? 'Mentés...' : 'Partner mentése a CRM-be'}
        </button>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  )
}
