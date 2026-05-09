'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Background } from '@/components/Background'
import { useTheme } from '@/contexts/ThemeContext'

const COUNTRIES = ['DE', 'AT', 'CH', 'HU', 'PL', 'CZ', 'SK', 'NL', 'FR', 'IT']

export default function NewPartnerPage() {
  const { theme } = useTheme()
  const [form, setForm] = useState({
    companyName: '', firstName: '', lastName: '',
    email: '', phone: '', city: '', country: 'DE', notes: '',
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
      setError(data.error || 'Hiba történt.')
    }
  }

  if (success) {
    return (
      <>
        <Background />
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
          <div
            className="rounded-full w-20 h-20 flex items-center justify-center"
            style={{ background: theme.cardBg, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${theme.cardBorder}` }}
          >
            <UserPlus size={36} style={{ color: theme.textPrimary }} />
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: theme.textPrimary }}>Partner mentve!</h2>
            <p className="mt-1" style={{ color: theme.textSecondary }}>Az adatok bekerültek a CRM-be.</p>
          </div>
          <button
            onClick={() => setSuccess(false)}
            className="px-8 py-3.5 rounded-2xl font-semibold text-base"
            style={{ background: theme.buttonBg, color: theme.buttonText }}
          >
            Új partner
          </button>
        </div>
      </>
    )
  }

  const inputStyle = {
    background: theme.inputBg,
    border: `1px solid ${theme.inputBorder}`,
    color: theme.textPrimary,
  }

  return (
    <>
      <Background />
      <div
        className="px-6 pb-10 md:px-10 lg:px-16"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <h1 className="text-2xl md:text-3xl font-bold mb-6 mt-2" style={{ color: theme.textPrimary }}>
          Új partner
        </h1>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
          {/* Two-col on large landscape */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Section title="Cég adatok" textSecondary={theme.textSecondary}>
              <GlassInput label="Cégnév" value={form.companyName} onChange={(v) => update('companyName', v)} placeholder="Mustermann GmbH" style={inputStyle} textSecondary={theme.textSecondary} />
              <div className="grid grid-cols-2 gap-3">
                <GlassInput label="Város" value={form.city} onChange={(v) => update('city', v)} placeholder="München" style={inputStyle} textSecondary={theme.textSecondary} />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>Ország</p>
                  <select
                    value={form.country}
                    onChange={(e) => update('country', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-base focus:outline-none min-h-[50px]"
                    style={inputStyle}
                  >
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </Section>

            <Section title="Kapcsolattartó" textSecondary={theme.textSecondary}>
              <div className="grid grid-cols-2 gap-3">
                <GlassInput label="Keresztnév" value={form.firstName} onChange={(v) => update('firstName', v)} placeholder="Hans" style={inputStyle} textSecondary={theme.textSecondary} />
                <GlassInput label="Vezetéknév" value={form.lastName} onChange={(v) => update('lastName', v)} placeholder="Mustermann" style={inputStyle} textSecondary={theme.textSecondary} />
              </div>
              <GlassInput label="Email" value={form.email} onChange={(v) => update('email', v)} placeholder="hans@firma.de" type="email" style={inputStyle} textSecondary={theme.textSecondary} />
              <GlassInput label="Telefon" value={form.phone} onChange={(v) => update('phone', v)} placeholder="+49 170 1234567" type="tel" style={inputStyle} textSecondary={theme.textSecondary} />
            </Section>
          </div>

          <Section title="Megjegyzés" textSecondary={theme.textSecondary}>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              placeholder="Érdeklődési terület, megjegyzések..."
              className="w-full px-4 py-3 rounded-xl text-base focus:outline-none resize-none"
              style={{ ...inputStyle, caretColor: theme.textPrimary }}
            />
          </Section>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-base transition disabled:opacity-50"
            style={{ background: theme.buttonBg, color: theme.buttonText }}
          >
            {loading ? 'Mentés...' : 'Partner mentése a CRM-be'}
          </button>
        </form>
      </div>
    </>
  )
}

function Section({ title, children, textSecondary }: { title: string; children: React.ReactNode; textSecondary: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: textSecondary }}>{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function GlassInput({ label, value, onChange, placeholder, type = 'text', style, textSecondary }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
  style: React.CSSProperties; textSecondary: string
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: textSecondary }}>{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl text-base focus:outline-none min-h-[50px]"
        style={style}
      />
    </div>
  )
}
