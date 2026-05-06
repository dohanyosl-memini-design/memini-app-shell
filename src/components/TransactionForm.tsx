'use client'

import { useState } from 'react'
import { format } from 'date-fns'

interface Transaction {
  id: string
  type: string
  amount: number
  currency: string
  date: string
  description: string
  category: string | null
  reference: string | null
}

interface TransactionFormProps {
  transaction: Transaction | null
  defaultType?: string
  onSave: () => void
  onCancel: () => void
}

const EXPENSE_CATEGORIES = ['Gyártás', 'Alapanyag', 'Szállítás', 'Marketing', 'Szoftver', 'Iroda', 'Egyéb']
const INCOME_CATEGORIES = ['Értékesítés', 'Előleg', 'Visszatérítés', 'Egyéb']

export default function TransactionForm({ transaction, defaultType, onSave, onCancel }: TransactionFormProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: transaction?.type || defaultType || 'income',
    amount: transaction?.amount?.toString() || '',
    currency: transaction?.currency || 'EUR',
    date: transaction?.date ? transaction.date.slice(0, 10) : format(new Date(), 'yyyy-MM-dd'),
    description: transaction?.description || '',
    category: transaction?.category || '',
    reference: transaction?.reference || '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const method = transaction ? 'PUT' : 'POST'
    const url = transaction ? `/api/transactions/${transaction.id}` : '/api/transactions'

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setLoading(false)
    onSave()
  }

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        {[
          { value: 'income', label: 'Bevétel', color: 'bg-green-100 text-green-700 border-green-300' },
          { value: 'expense', label: 'Kiadás', color: 'bg-red-100 text-red-700 border-red-300' },
        ].map(({ value, label, color }) => (
          <button
            key={value}
            type="button"
            onClick={() => setForm({ ...form, type: value, category: '' })}
            className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-colors ${
              form.type === value ? color : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Összeg *</label>
          <div className="flex">
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="px-2 py-2 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-sm"
            >
              <option>EUR</option>
              <option>HUF</option>
              <option>USD</option>
            </select>
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dátum *</label>
          <input
            required
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Leírás *</label>
        <input
          required
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="pl. Gyártási költség – kő mágnesek"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kategória</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Válassz kategóriát</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Referencia (pl. számlaszám)</label>
          <input
            type="text"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder="RE-2026-001"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Mégse</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Mentés...' : 'Mentés'}
        </button>
      </div>
    </form>
  )
}
