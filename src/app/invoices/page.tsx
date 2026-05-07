'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Eye, Trash2, CheckCircle, Clock, AlertCircle, FileText, Printer } from 'lucide-react'
import Modal from '@/components/Modal'
import InvoiceForm from '@/components/InvoiceForm'
import InvoicePreview from '@/components/InvoicePreview'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
}

interface Invoice {
  id: string
  number: string
  date: string
  dueDate: string
  deliveryInfo: string | null
  status: string
  currency: string
  subtotal: number
  vatAmount: number
  total: number
  paidAt: string | null
  notes: string | null
  contact: { firstName: string; lastName: string } | null
  company: {
    name: string
    address: string | null
    city: string | null
    vatId: string | null
    phone: string | null
    email: string | null
    customerNumber: string | null
  } | null
  items: InvoiceItem[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Nyitott', color: 'bg-blue-100 text-blue-700', icon: Clock },
  paid: { label: 'Fizetve', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  overdue: { label: 'Lejárt', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelled: { label: 'Törölve', color: 'bg-gray-100 text-gray-500', icon: FileText },
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    const res = await fetch(`/api/invoices?${params}`)
    const data = await res.json()
    setInvoices(data)
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  async function handleMarkPaid(id: string) {
    await fetch(`/api/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid' }),
    })
    fetchInvoices()
  }

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törölni szeretné ezt a számlát?')) return
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    fetchInvoices()
  }

  const filtered = invoices.filter((inv) => {
    if (!search) return true
    return (
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.company?.name.toLowerCase().includes(search.toLowerCase()) ||
      inv.contact?.lastName.toLowerCase().includes(search.toLowerCase())
    )
  })

  const now = new Date()
  const openTotal = invoices.filter((i) => i.status === 'open').reduce((s, i) => s + i.total, 0)
  const overdueCount = invoices.filter((i) => i.status === 'open' && new Date(i.dueDate) < now).length
  const paidTotal = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Számlák</h1>
          <p className="text-gray-500 mt-1">{invoices.length} számla összesen</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Új számla
        </button>
      </div>

      {/* KPI sáv */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Nyitott számlák összege</p>
          <p className="text-xl font-bold text-blue-600 mt-1">€{openTotal.toFixed(2)}</p>
        </div>
        <div className={`rounded-xl border p-4 shadow-sm ${overdueCount > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
          <p className="text-sm text-gray-500">Lejárt (nem fizetett)</p>
          <p className={`text-xl font-bold mt-1 ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{overdueCount} db</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Beérkezett bevétel (összes)</p>
          <p className="text-xl font-bold text-green-600 mt-1">€{paidTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Szűrők */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Keresés számlaszám, cég neve..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
          {[['all', 'Mind'], ['open', 'Nyitott'], ['paid', 'Fizetve']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${statusFilter === val ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Számla táblázat */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Számlaszám</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Ügyfél / Cég</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Kiállítás</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Határidő</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Összeg</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Státusz</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Műveletek</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Betöltés...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Nem található számla</td></tr>
            ) : filtered.map((invoice) => {
              const isOverdue = invoice.status === 'open' && new Date(invoice.dueDate) < now
              const statusKey = isOverdue ? 'overdue' : invoice.status
              const status = STATUS_CONFIG[statusKey] || STATUS_CONFIG.open
              const StatusIcon = status.icon

              return (
                <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-sm font-semibold text-gray-900">{invoice.number}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-gray-900">{invoice.company?.name || '-'}</p>
                    {invoice.contact && (
                      <p className="text-xs text-gray-500">{invoice.contact.firstName} {invoice.contact.lastName}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">
                    {format(new Date(invoice.date), 'yyyy.MM.dd')}
                  </td>
                  <td className={`px-5 py-3.5 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                    {format(new Date(invoice.dueDate), 'yyyy.MM.dd')}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <p className="text-sm font-bold text-gray-900">€{invoice.total.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">nettó €{invoice.subtotal.toFixed(2)}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                      <StatusIcon size={11} />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setPreviewInvoice(invoice)}
                        title="Megtekintés / Nyomtatás"
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Eye size={15} />
                      </button>
                      {invoice.status === 'open' && (
                        <button
                          onClick={() => handleMarkPaid(invoice.id)}
                          title="Fizetve jelölés"
                          className="text-gray-400 hover:text-green-600 transition-colors"
                        >
                          <CheckCircle size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(invoice.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <Modal title="Új számla kiállítása" onClose={() => setShowCreateModal(false)} size="lg">
          <InvoiceForm onSave={() => { setShowCreateModal(false); fetchInvoices() }} onCancel={() => setShowCreateModal(false)} />
        </Modal>
      )}

      {previewInvoice && (
        <Modal title={`${previewInvoice.number} – Előnézet`} onClose={() => setPreviewInvoice(null)} size="xl">
          <InvoicePreview invoice={previewInvoice} />
        </Modal>
      )}
    </div>
  )
}
