'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { format, addDays } from 'date-fns'

interface Contact { id: string; firstName: string; lastName: string }
interface Company { id: string; name: string }
interface Product { id: string; name: string; nameDE: string | null; sku: string; salesPrice: number; vatRate: number }

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  productId: string
}

interface InvoiceFormProps {
  onSave: () => void
  onCancel: () => void
}

export default function InvoiceForm({ onSave, onCancel }: InvoiceFormProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const due30 = format(addDays(new Date(), 30), 'yyyy-MM-dd')

  const [form, setForm] = useState({
    contactId: '',
    companyId: '',
    date: today,
    dueDate: due30,
    deliveryInfo: '',
    currency: 'EUR',
    notes: '',
  })

  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, vatRate: 19, productId: '' },
  ])

  useEffect(() => {
    Promise.all([
      fetch('/api/contacts').then((r) => r.json()),
      fetch('/api/companies').then((r) => r.json()),
      fetch('/api/products').then((r) => r.json()),
    ]).then(([c, co, p]) => { setContacts(c); setCompanies(co); setProducts(p) })
  }, [])

  function addItem() {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, vatRate: 19, productId: '' }])
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    const updated = [...items]
    updated[idx] = { ...updated[idx], [field]: value }

    if (field === 'productId' && value) {
      const product = products.find((p) => p.id === value)
      if (product) {
        updated[idx].description = product.nameDE || product.name
        updated[idx].unitPrice = product.salesPrice
        updated[idx].vatRate = product.vatRate
      }
    }
    setItems(updated)
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const vatAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (item.vatRate / 100), 0
  )
  const total = subtotal + vatAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.every((i) => !i.description)) return
    setLoading(true)

    await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items }),
    })

    setLoading(false)
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ügyfél</label>
          <select
            value={form.contactId}
            onChange={(e) => setForm({ ...form, contactId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Válassz ügyfelet</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cég</label>
          <select
            value={form.companyId}
            onChange={(e) => setForm({ ...form, companyId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Válassz céget</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kiállítás dátuma</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fizetési határidő</label>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Lieferdatum (szállítás dátuma)</label>
          <input type="text" value={form.deliveryInfo} onChange={(e) => setForm({ ...form, deliveryInfo: e.target.value })}
            placeholder="pl. 15.03.2026 vagy 10.01.2026 &amp; 15.03.2026"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </div>

      {/* Tételek */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Tételek *</label>
          <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <Plus size={14} />Tétel hozzáadása
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Leírás / Termék</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 w-16">Menny.</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">Egységár (€)</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 w-20">MwSt</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">Összesen</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2">
                    <select
                      value={item.productId}
                      onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 mb-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">— Termék választása —</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      placeholder="Tétel leírása"
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="1" value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                      className="w-full text-sm text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={item.unitPrice}
                      onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value))}
                      className="w-full text-sm text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="px-3 py-2">
                    <select value={item.vatRate}
                      onChange={(e) => updateItem(idx, 'vatRate', parseFloat(e.target.value))}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value={19}>19%</option>
                      <option value={7}>7%</option>
                      <option value={0}>0%</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">
                    €{(item.quantity * item.unitPrice * (1 + item.vatRate / 100)).toFixed(2)}
                  </td>
                  <td className="px-2 py-2">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Összegzés */}
        <div className="flex justify-end mt-3">
          <div className="text-sm space-y-1 w-56">
            <div className="flex justify-between text-gray-600">
              <span>Nettó:</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>MwSt:</span>
              <span>€{vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-1">
              <span>Bruttó összesen:</span>
              <span>€{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés</label>
        <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="pl. Bankátutalás: 30 napon belül"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm" />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Mégse</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Kiállítás...' : 'Számla kiállítása'}
        </button>
      </div>
    </form>
  )
}
