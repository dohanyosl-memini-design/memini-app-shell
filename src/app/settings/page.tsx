'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { KeyRound, CheckCircle2, AlertCircle } from 'lucide-react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)

    if (form.newPassword !== form.confirmPassword) {
      setResult({ ok: false, message: 'Az új jelszavak nem egyeznek' })
      return
    }
    if (form.newPassword.length < 8) {
      setResult({ ok: false, message: 'A jelszónak legalább 8 karakter kell' })
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setResult({ ok: true, message: 'Jelszó sikeresen megváltoztatva' })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } else {
      setResult({ ok: false, message: data.error || 'Hiba történt' })
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Beállítások</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
            {session?.user?.name?.[0] ?? '?'}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{session?.user?.name}</p>
            <p className="text-sm text-gray-500">{session?.user?.email}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={16} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800">Jelszó módosítása</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jelenlegi jelszó</label>
              <input
                type="password"
                required
                value={form.currentPassword}
                onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Új jelszó</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.newPassword}
                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Új jelszó megerősítése</label>
              <input
                type="password"
                required
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {result && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {result.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                {result.message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? 'Mentés...' : 'Jelszó módosítása'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
