'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, ChevronRight, FileText, Building2, User, Printer, Send, ArrowRightCircle } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import Modal from '@/components/Modal'

interface QuoteItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
  productId: string | null
}

interface Quote {
  id: string
  number: string
  date: string
  validUntil: string | null
  status: string
  total: number
  subtotal: number
  vatAmount: number
  notes: string | null
  contact: { id: string; firstName: string; lastName: string } | null
  company: { id: string; name: string } | null
  items: QuoteItem[]
}

const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Tervezet', color: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Kiküldve', color: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Elutasítva', color: 'bg-red-100 text-red-700' },
  expired: { label: 'Lejárt', color: 'bg-amber-100 text-amber-700' },
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface QuoteFormProps {
  onSave: () => void
  onCancel: () => void
}

function QuoteForm({ onSave, onCancel }: QuoteFormProps) {
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<{ id: string; firstName: string; lastName: string }[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; salesPrice: number; vatRate: number }[]>([])

  const today = new Date().toISOString().split('T')[0]
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 30)

  const [form, setForm] = useState({
    contactId: '',
    companyId: '',
    date: today,
    validUntil: validUntil.toISOString().split('T')[0],
    status: 'draft',
    notes: '',
  })

  const [items, setItems] = useState([
    { description: '', quantity: 1, unitPrice: 0, vatRate: 19, productId: '' }
  ])

  useEffect(() => {
    Promise.all([
      fetch('/api/contacts').then((r) => r.json()),
      fetch('/api/companies').then((r) => r.json()),
      fetch('/api/products').then((r) => r.json()),
    ]).then(([c, co, p]) => {
      setContacts(c)
      setCompanies(co)
      setProducts(p)
    })
  }, [])

  function addItem() {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, vatRate: 19, productId: '' }])
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, field: string, value: string | number) {
    const updated = [...items]
    updated[i] = { ...updated[i], [field]: value }
    setItems(updated)
  }

  function selectProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    const updated = [...items]
    updated[i] = {
      ...updated[i],
      productId,
      description: p.name,
      unitPrice: p.salesPrice,
      vatRate: p.vatRate,
    }
    setItems(updated)
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
  const total = subtotal + vatAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items }),
    })
    setLoading(false)
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ügyfél</label>
          <select
            value={form.contactId}
            onChange={(e) => setForm({ ...form, contactId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Nincs megadva</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
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

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dátum</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Érvényesség</label>
          <input
            type="date"
            value={form.validUntil}
            onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Státusz</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(QUOTE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Tételek</label>
          <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            + Tétel hozzáadása
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                {products.length > 0 ? (
                  <select
                    value={item.productId}
                    onChange={(e) => {
                      if (e.target.value) selectProduct(i, e.target.value)
                      else updateItem(i, 'productId', '')
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Egyedi tétel...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Megnevezés"
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {item.productId && (
                  <input
                    type="text"
                    placeholder="Megnevezés"
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  />
                )}
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Menny."
                  value={item.quantity}
                  onChange={(e) => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Egységár"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <select
                  value={item.vatRate}
                  onChange={(e) => updateItem(i, 'vatRate', parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>0%</option>
                  <option value={7}>7%</option>
                  <option value={19}>19%</option>
                </select>
              </div>
              <div className="col-span-1 flex justify-end">
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 text-right space-y-1">
          <div className="text-sm text-gray-500">Nettó: {fmtEur(subtotal)}</div>
          <div className="text-sm text-gray-500">ÁFA: {fmtEur(vatAmount)}</div>
          <div className="text-base font-bold text-gray-900">Összesen: {fmtEur(total)}</div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          Mégse
        </button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Mentés...' : 'Mentés'}
        </button>
      </div>
    </form>
  )
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus !== 'all') params.set('status', filterStatus)
    const res = await fetch(`/api/quotes?${params}`)
    const data = await res.json()
    setQuotes(data)
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { fetchQuotes() }, [fetchQuotes])

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/quotes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchQuotes()
  }

  async function handleDelete(id: string) {
    if (!confirm('Törli ezt az ajánlatot?')) return
    await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
    fetchQuotes()
  }

  // Kiküldöttre jelölés: a státuszt a kiküldés ténye lépteti, és felkerül egy
  // utánkövető feladat — így nem hal el csendben az ajánlat.
  async function handleMarkSent(id: string, number: string) {
    if (!confirm(`A(z) ${number} ajánlatot kiküldöttre jelöli?\n\nA státusz "Kiküldve" lesz, és felkerül egy utánkövető feladat.`)) return
    const res = await fetch(`/api/quotes/${id}/mark-sent`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? 'Nem sikerült a jelölés.'); return }
    if (data.alreadySent) alert(data.message)
    fetchQuotes()
  }

  async function handleConvert(id: string, number: string) {
    if (!confirm(`A(z) ${number} ajánlatból megrendelés készül.\n\nAz ajánlat "Elfogadva" státuszba kerül. Folytatja?`)) return
    const res = await fetch(`/api/quotes/${id}/convert`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? 'Nem sikerült az átgörgetés.'); return }
    if (data.alreadyConverted) { alert(data.message); return }
    fetchQuotes()
    if (confirm(`Megrendelés létrehozva: ${data.order.number}\n\nMegnyitja a megrendelést?`)) {
      window.location.href = '/orders'
    }
  }

  const filtered = quotes.filter((q) => {
    const term = search.toLowerCase()
    return (
      !term ||
      q.number.toLowerCase().includes(term) ||
      q.contact?.firstName.toLowerCase().includes(term) ||
      q.contact?.lastName.toLowerCase().includes(term) ||
      q.company?.name.toLowerCase().includes(term)
    )
  })

  const totalValue = filtered.reduce((s, q) => s + q.total, 0)
  const acceptedValue = filtered.filter((q) => q.status === 'accepted').reduce((s, q) => s + q.total, 0)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ajánlatok</h1>
          <p className="text-gray-500 mt-1">{filtered.length} ajánlat · {fmtEur(totalValue)} összesen</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Új ajánlat
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(QUOTE_STATUS).map(([status, cfg]) => {
          const count = quotes.filter((q) => q.status === status).length
          const val = quotes.filter((q) => q.status === status).reduce((s, q) => s + q.total, 0)
          if (count === 0) return null
          return (
            <div key={status} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm ${cfg.color} border-current border-opacity-20`}>
              <span className="font-medium">{cfg.label}</span>
              <span className="opacity-70">{count} db · {fmtEur(val)}</span>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Keresés szám, ügyfél, cég alapján..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
        >
          <option value="all">Minden státusz</option>
          {Object.entries(QUOTE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Szám</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ügyfél / Cég</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dátum</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Érvényes</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Státusz</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Összeg</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400">Betöltés...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                    <FileText size={32} className="text-gray-200 mx-auto mb-3" />
                    Nincs ajánlat
                  </td>
                </tr>
              ) : (
                filtered.map((q) => {
                  const qs = QUOTE_STATUS[q.status]
                  return (
                    <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-mono text-sm font-medium text-gray-900">{q.number}</td>
                      <td className="px-5 py-3">
                        <div className="space-y-0.5">
                          {q.contact && (
                            <Link href={`/contacts/${q.contact.id}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                              <User size={11} />
                              {q.contact.firstName} {q.contact.lastName}
                            </Link>
                          )}
                          {q.company && (
                            <Link href={`/companies/${q.company.id}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600">
                              <Building2 size={11} />
                              {q.company.name}
                            </Link>
                          )}
                          {!q.contact && !q.company && <span className="text-gray-400 text-sm">-</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {format(new Date(q.date), 'yyyy. MMM d.', { locale: hu })}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {q.validUntil ? format(new Date(q.validUntil), 'MMM d.', { locale: hu }) : '-'}
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={q.status}
                          onChange={(e) => handleStatusChange(q.id, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${qs?.color || 'bg-gray-100 text-gray-600'}`}
                        >
                          {Object.entries(QUOTE_STATUS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900 text-sm">{fmtEur(q.total)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => window.open(`/quotes/${q.id}/print`, '_blank')}
                            title="Nyomtatás / PDF"
                            className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Printer size={15} />
                          </button>
                          {q.status === 'draft' && (
                            <button
                              onClick={() => handleMarkSent(q.id, q.number)}
                              title="Kiküldöttre jelölés (+ utánkövető feladat)"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Send size={15} />
                            </button>
                          )}
                          {(q.status === 'sent' || q.status === 'accepted') && (
                            <button
                              onClick={() => handleConvert(q.id, q.number)}
                              title="Átgörgetés megrendelésre"
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            >
                              <ArrowRightCircle size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(q.id)}
                            title="Törlés"
                            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {acceptedValue > 0 && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-green-700 font-medium">Elfogadott ajánlatok értéke</span>
          <span className="text-base font-bold text-green-800">{fmtEur(acceptedValue)}</span>
        </div>
      )}

      {showModal && (
        <Modal title="Új ajánlat" onClose={() => setShowModal(false)}>
          <QuoteForm onSave={() => { setShowModal(false); fetchQuotes() }} onCancel={() => setShowModal(false)} />
        </Modal>
      )}
    </div>
  )
}
