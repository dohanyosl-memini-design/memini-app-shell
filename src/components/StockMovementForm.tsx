'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, RefreshCw } from 'lucide-react'

interface Product {
  id: string
  name: string
  sku: string
  stock: number
}

interface StockMovementFormProps {
  product: Product
  onSave: () => void
  onCancel: () => void
}

export default function StockMovementForm({ product, onSave, onCancel }: StockMovementFormProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'in',
    quantity: '',
    note: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.quantity || parseInt(form.quantity) <= 0) return
    setLoading(true)

    await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, productId: product.id }),
    })

    setLoading(false)
    onSave()
  }

  const newStock =
    form.quantity
      ? form.type === 'in'
        ? product.stock + parseInt(form.quantity || '0')
        : form.type === 'out'
        ? product.stock - parseInt(form.quantity || '0')
        : parseInt(form.quantity || '0')
      : product.stock

  const TYPES = [
    { value: 'in', label: 'Bevételezés', icon: ArrowDown, color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'out', label: 'Kiadás', icon: ArrowUp, color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 'adjustment', label: 'Korrekció', icon: RefreshCw, color: 'bg-amber-100 text-amber-700 border-amber-300' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700">{product.name}</p>
        <p className="text-xs text-gray-500 font-mono">{product.sku}</p>
        <p className="text-sm text-gray-600 mt-1">Jelenlegi készlet: <strong>{product.stock} db</strong></p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Mozgás típusa</label>
        <div className="flex gap-2">
          {TYPES.map(({ value, label, icon: Icon, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm({ ...form, type: value })}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                form.type === value ? color : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {form.type === 'adjustment' ? 'Új készlet (db)' : 'Mennyiség (db)'}
        </label>
        <input
          required
          type="number"
          min="1"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium"
          placeholder="0"
        />
        {form.quantity && (
          <p className={`text-sm mt-1 ${newStock < 0 ? 'text-red-600' : 'text-gray-500'}`}>
            Új készlet: <strong>{newStock} db</strong>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés</label>
        <input
          type="text"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="pl. Gyártótól bevételezve"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Mégse</button>
        <button type="submit" disabled={loading || newStock < 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Mentés...' : 'Rögzítés'}
        </button>
      </div>
    </form>
  )
}
