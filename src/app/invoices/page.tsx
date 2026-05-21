'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Eye, Trash2, CheckCircle, Clock, AlertCircle, FileText, Ban, Edit2, Send, Truck, Receipt, Loader2 } from 'lucide-react'
import Modal from '@/components/Modal'
import InvoiceForm from '@/components/InvoiceForm'
import InvoicePreview from '@/components/InvoicePreview'
import DeliveryNoteForm from '@/components/DeliveryNoteForm'
import DeliveryNotePreview from '@/components/DeliveryNotePreview'
import { format } from 'date-fns'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
  isDiscount: boolean
}

interface Invoice {
  id: string
  number: string
  date: string
  dueDate: string
  deliveryInfo: string | null
  status: string
  stornoOf: string | null
  currency: string
  subtotal: number
  vatAmount: number
  total: number
  paidAt: string | null
  notes: string | null
  contactId: string | null
  companyId: string | null
  contact: { id: string; firstName: string; lastName: string } | null
  company: {
    id: string
    name: string
    address: string | null
    zip: string | null
    city: string | null
    vatId: string | null
    phone: string | null
    email: string | null
    customerNumber: string | null
  } | null
  items: InvoiceItem[]
}

interface DeliveryNoteItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
  isDiscount: boolean
}

interface DeliveryNote {
  id: string
  number: string
  date: string
  deliveryInfo: string | null
  status: string
  currency: string
  subtotal: number
  vatAmount: number
  total: number
  notes: string | null
  billingName: string | null
  billingAddress: string | null
  billingZip: string | null
  billingCity: string | null
  billingCountry: string | null
  contactId: string | null
  companyId: string | null
  contact: { id: string; firstName: string; lastName: string } | null
  company: {
    id: string
    name: string
    address: string | null
    zip: string | null
    city: string | null
    vatId: string | null
    phone: string | null
    email: string | null
    customerNumber: string | null
  } | null
  items: DeliveryNoteItem[]
}

const INVOICE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open:      { label: 'Nyitott',    color: 'bg-blue-100 text-blue-700',    icon: Clock },
  sent:      { label: 'Kiküldve',   color: 'bg-purple-100 text-purple-700', icon: Send },
  paid:      { label: 'Fizetve',    color: 'bg-green-100 text-green-700',   icon: CheckCircle },
  overdue:   { label: 'Lejárt',     color: 'bg-red-100 text-red-700',       icon: AlertCircle },
  cancelled: { label: 'Stornózva',  color: 'bg-gray-100 text-gray-500',     icon: Ban },
  storno:    { label: 'Storno',     color: 'bg-orange-100 text-orange-600',  icon: FileText },
}

const DN_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Vázlat',     color: 'bg-gray-100 text-gray-600' },
  sent:      { label: 'Kiküldve',   color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Kiszállítva', color: 'bg-green-100 text-green-700' },
}

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'delivery-notes'>('invoices')

  // Invoice state
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all')
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)

  // Delivery note state
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [dnLoading, setDnLoading] = useState(true)
  const [dnSearch, setDnSearch] = useState('')
  const [showCreateDN, setShowCreateDN] = useState(false)
  const [previewDN, setPreviewDN] = useState<DeliveryNote | null>(null)
  const [editDN, setEditDN] = useState<DeliveryNote | null>(null)
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null)

  // Sorting — invoices
  type InvCol = 'number' | 'company' | 'date' | 'dueDate' | 'total' | 'status'
  const [invSortCol, setInvSortCol] = useState<InvCol>('date')
  const [invSortDir, setInvSortDir] = useState<'asc' | 'desc'>('desc')

  function handleInvSort(col: InvCol) {
    if (col === invSortCol) setInvSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setInvSortCol(col); setInvSortDir('asc') }
  }

  // Sorting — delivery notes
  type DnCol = 'number' | 'company' | 'date' | 'total' | 'status'
  const [dnSortCol, setDnSortCol] = useState<DnCol>('date')
  const [dnSortDir, setDnSortDir] = useState<'asc' | 'desc'>('desc')

  function handleDnSort(col: DnCol) {
    if (col === dnSortCol) setDnSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setDnSortCol(col); setDnSortDir('asc') }
  }

  const fetchInvoices = useCallback(async () => {
    setInvoicesLoading(true)
    const params = new URLSearchParams()
    if (invoiceStatusFilter !== 'all') params.set('status', invoiceStatusFilter)
    const res = await fetch(`/api/invoices?${params}`)
    const data = await res.json()
    setInvoices(data)
    setInvoicesLoading(false)
  }, [invoiceStatusFilter])

  const fetchDeliveryNotes = useCallback(async () => {
    setDnLoading(true)
    const res = await fetch('/api/delivery-notes')
    const data = await res.json()
    setDeliveryNotes(data)
    setDnLoading(false)
  }, [])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])
  useEffect(() => { fetchDeliveryNotes() }, [fetchDeliveryNotes])

  async function handleMarkSent(id: string) {
    await fetch(`/api/invoices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'sent' }) })
    fetchInvoices()
  }

  async function handleMarkPaid(id: string) {
    await fetch(`/api/invoices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'paid' }) })
    fetchInvoices()
  }

  async function handleDeleteInvoice(id: string) {
    if (!confirm('Biztosan törölni szeretné ezt a számlát?')) return
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    fetchInvoices()
  }

  async function handleStorno(invoice: Invoice) {
    if (!confirm(`Biztosan stornózni szeretné a(z) ${invoice.number} számot?\n\nEgy új K-${invoice.number} stornószámla kerül kiállításra, az eredeti számla "Stornózva" állapotba kerül.`)) return
    const res = await fetch(`/api/invoices/${invoice.id}/storno`, { method: 'POST' })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error || 'Hiba történt a stornózás során.')
      return
    }
    fetchInvoices()
  }

  async function handleDNStatusChange(id: string, status: string) {
    await fetch(`/api/delivery-notes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    fetchDeliveryNotes()
  }

  async function handleGenerateInvoice(dn: DeliveryNote) {
    setGeneratingInvoiceId(dn.id)
    const today = new Date()
    const due = new Date(today)
    due.setDate(due.getDate() + 30)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: '',
        companyId: dn.companyId,
        contactId: dn.contactId,
        date: fmt(today),
        dueDate: fmt(due),
        deliveryInfo: dn.deliveryInfo || '',
        currency: dn.currency,
        notes: dn.notes || '',
        billingName: dn.billingName || '',
        billingAddress: dn.billingAddress || '',
        billingZip: dn.billingZip || '',
        billingCity: dn.billingCity || '',
        billingCountry: dn.billingCountry || '',
        items: dn.items.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          isDiscount: i.isDiscount,
          productId: null,
        })),
      }),
    })

    setGeneratingInvoiceId(null)
    if (res.ok) {
      await fetchInvoices()
      setActiveTab('invoices')
    } else {
      const err = await res.json()
      alert(err.error || 'Hiba a számlagenerálás során.')
    }
  }

  async function handleDeleteDN(id: string) {
    if (!confirm('Biztosan törölni szeretné ezt a szállítólevelet?')) return
    await fetch(`/api/delivery-notes/${id}`, { method: 'DELETE' })
    fetchDeliveryNotes()
  }

  const filteredInvoices = invoices.filter((inv) => {
    if (!invoiceSearch) return true
    return (
      inv.number.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.company?.name.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.contact?.lastName.toLowerCase().includes(invoiceSearch.toLowerCase())
    )
  })

  const filteredDNs = deliveryNotes.filter((dn) => {
    if (!dnSearch) return true
    return (
      dn.number.toLowerCase().includes(dnSearch.toLowerCase()) ||
      dn.company?.name.toLowerCase().includes(dnSearch.toLowerCase()) ||
      (dn.contact?.lastName || '').toLowerCase().includes(dnSearch.toLowerCase())
    )
  })

  function parseInvNumber(num: string) {
    const clean = num.replace(/^K-/i, '')
    const yearMatch = clean.match(/(\d{4})/)
    const year = yearMatch ? parseInt(yearMatch[1]) : 0
    const seqMatch = clean.replace(/\d{4}/, '').match(/(\d+)/)
    const seq = seqMatch ? parseInt(seqMatch[1]) : 0
    return { year, seq }
  }

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let cmp = 0
    if (invSortCol === 'number') {
      const pa = parseInvNumber(a.number)
      const pb = parseInvNumber(b.number)
      cmp = pa.year !== pb.year ? pa.year - pb.year : pa.seq - pb.seq
    }
    else if (invSortCol === 'company') cmp = (a.company?.name || '').localeCompare(b.company?.name || '')
    else if (invSortCol === 'date')    cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
    else if (invSortCol === 'dueDate') cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    else if (invSortCol === 'total')   cmp = a.total - b.total
    else if (invSortCol === 'status')  cmp = a.status.localeCompare(b.status)
    return invSortDir === 'asc' ? cmp : -cmp
  })

  const sortedDNs = [...filteredDNs].sort((a, b) => {
    let cmp = 0
    if (dnSortCol === 'number')  cmp = a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' })
    else if (dnSortCol === 'company') cmp = (a.company?.name || '').localeCompare(b.company?.name || '')
    else if (dnSortCol === 'date')    cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
    else if (dnSortCol === 'total')   cmp = a.total - b.total
    else if (dnSortCol === 'status')  cmp = a.status.localeCompare(b.status)
    return dnSortDir === 'asc' ? cmp : -cmp
  })

  const now = new Date()
  const openTotal = invoices.filter((i) => i.status === 'open').reduce((s, i) => s + i.total, 0)
  const overdueCount = invoices.filter((i) => i.status === 'open' && new Date(i.dueDate) < now).length
  const paidTotal = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)

  return (
    <div className="p-4 md:p-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'invoices' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FileText size={15} />
          Számlák
        </button>
        <button
          onClick={() => setActiveTab('delivery-notes')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'delivery-notes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Truck size={15} />
          Szállítólevelek
        </button>
      </div>

      {/* ── SZÁMLÁK ── */}
      {activeTab === 'invoices' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Számlák</h1>
              <p className="text-gray-500 mt-1">{invoices.length} számla összesen</p>
            </div>
            <button
              onClick={() => setShowCreateInvoice(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Új számla
            </button>
          </div>

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

          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Keresés számlaszám, cég neve..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
              {[['all', 'Mind'], ['open', 'Nyitott'], ['paid', 'Fizetve']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setInvoiceStatusFilter(val)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${invoiceStatusFilter === val ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {([
                      { col: 'number',  label: 'Számlaszám',   align: 'text-left'  },
                      { col: 'company', label: 'Ügyfél / Cég', align: 'text-left'  },
                      { col: 'date',    label: 'Kiállítás',    align: 'text-left'  },
                      { col: 'dueDate', label: 'Határidő',     align: 'text-left'  },
                      { col: 'total',   label: 'Összeg',       align: 'text-right' },
                      { col: 'status',  label: 'Státusz',      align: 'text-left'  },
                    ] as { col: InvCol; label: string; align: string }[]).map(({ col, label, align }) => (
                      <th key={col} className={`${align} px-5 py-3 text-xs font-semibold text-gray-500 uppercase`}>
                        <button
                          type="button"
                          onClick={() => handleInvSort(col)}
                          className="hover:text-gray-800 transition-colors cursor-pointer select-none"
                        >
                          {label}{invSortCol === col ? (invSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                    ))}
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Műveletek</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoicesLoading ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Betöltés...</td></tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Nem található számla</td></tr>
                  ) : sortedInvoices.map((invoice) => {
                    const isOverdue = invoice.status === 'open' && new Date(invoice.dueDate) < now
                    const isStornoDoc = !!invoice.stornoOf
                    const statusKey = isStornoDoc ? 'storno' : isOverdue ? 'overdue' : invoice.status
                    const status = INVOICE_STATUS_CONFIG[statusKey] || INVOICE_STATUS_CONFIG.open
                    const StatusIcon = status.icon
                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => setPreviewInvoice(invoice)}
                            className={`font-mono text-sm font-semibold hover:text-blue-600 hover:underline transition-colors text-left ${isStornoDoc ? 'text-orange-600' : invoice.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                          >
                            {invoice.number}
                          </button>
                          {invoice.status === 'cancelled' && !isStornoDoc && (
                            <span className="ml-1.5 text-xs text-gray-400">(K-{invoice.number})</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-gray-900">{invoice.company?.name || '-'}</p>
                          {invoice.contact && (
                            <p className="text-xs text-gray-500">{invoice.contact.firstName} {invoice.contact.lastName}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{format(new Date(invoice.date), 'yyyy.MM.dd')}</td>
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
                            <button onClick={() => setPreviewInvoice(invoice)} title="Előnézet" className="text-gray-400 hover:text-blue-600 transition-colors">
                              <Eye size={15} />
                            </button>
                            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && !isStornoDoc && (
                              <button onClick={() => setEditInvoice(invoice)} title="Szerkesztés" className="text-gray-400 hover:text-blue-600 transition-colors">
                                <Edit2 size={15} />
                              </button>
                            )}
                            {invoice.status === 'open' && (
                              <button onClick={() => handleMarkSent(invoice.id)} title="Kiküldve" className="text-gray-400 hover:text-purple-600 transition-colors">
                                <Send size={15} />
                              </button>
                            )}
                            {(invoice.status === 'open' || invoice.status === 'sent') && (
                              <button onClick={() => handleMarkPaid(invoice.id)} title="Fizetve" className="text-gray-400 hover:text-green-600 transition-colors">
                                <CheckCircle size={15} />
                              </button>
                            )}
                            {(invoice.status === 'open' || invoice.status === 'sent' || invoice.status === 'paid') && !isStornoDoc && (
                              <button onClick={() => handleStorno(invoice)} title="Stornózás" className="text-gray-400 hover:text-orange-500 transition-colors">
                                <Ban size={15} />
                              </button>
                            )}
                            <button onClick={() => handleDeleteInvoice(invoice.id)} className="text-gray-400 hover:text-red-600 transition-colors">
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
          </div>
        </>
      )}

      {/* ── SZÁLLÍTÓLEVELEK ── */}
      {activeTab === 'delivery-notes' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Szállítólevelek</h1>
              <p className="text-gray-500 mt-1">{deliveryNotes.length} szállítólevél összesen</p>
            </div>
            <button
              onClick={() => setShowCreateDN(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={18} />
              Új szállítólevél
            </button>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Keresés szám, cég neve..."
                value={dnSearch}
                onChange={(e) => setDnSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {([
                      { col: 'number',  label: 'Szállítólevél szám', align: 'text-left'  },
                      { col: 'company', label: 'Ügyfél / Cég',       align: 'text-left'  },
                      { col: 'date',    label: 'Kiállítás',           align: 'text-left'  },
                      { col: 'total',   label: 'Összeg',              align: 'text-right' },
                      { col: 'status',  label: 'Státusz',             align: 'text-left'  },
                    ] as { col: DnCol; label: string; align: string }[]).map(({ col, label, align }) => (
                      <th key={col} className={`${align} px-5 py-3 text-xs font-semibold text-gray-500 uppercase`}>
                        <button
                          type="button"
                          onClick={() => handleDnSort(col)}
                          className="hover:text-gray-800 transition-colors cursor-pointer select-none"
                        >
                          {label}{dnSortCol === col ? (dnSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                    ))}
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Lieferdatum</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Műveletek</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dnLoading ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Betöltés...</td></tr>
                  ) : filteredDNs.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Nem található szállítólevél</td></tr>
                  ) : sortedDNs.map((dn) => {
                    const status = DN_STATUS_CONFIG[dn.status] || DN_STATUS_CONFIG.draft
                    return (
                      <tr key={dn.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => setPreviewDN(dn)}
                            className="font-mono text-sm font-semibold text-green-700 hover:text-green-600 hover:underline transition-colors text-left"
                          >
                            {dn.number}
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-gray-900">{dn.company?.name || '-'}</p>
                          {dn.contact && (
                            <p className="text-xs text-gray-500">{dn.contact.firstName} {dn.contact.lastName}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{format(new Date(dn.date), 'yyyy.MM.dd')}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{dn.deliveryInfo || '—'}</td>
                        <td className="px-5 py-3.5 text-right">
                          <p className="text-sm font-bold text-gray-900">€{dn.total.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">nettó €{dn.subtotal.toFixed(2)}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setPreviewDN(dn)} title="Előnézet" className="text-gray-400 hover:text-blue-600 transition-colors">
                              <Eye size={15} />
                            </button>
                            {dn.status === 'draft' && (
                              <button onClick={() => setEditDN(dn)} title="Szerkesztés" className="text-gray-400 hover:text-blue-600 transition-colors">
                                <Edit2 size={15} />
                              </button>
                            )}
                            {dn.status === 'draft' && (
                              <button onClick={() => handleDNStatusChange(dn.id, 'sent')} title="Kiküldve" className="text-gray-400 hover:text-purple-600 transition-colors">
                                <Send size={15} />
                              </button>
                            )}
                            {(dn.status === 'draft' || dn.status === 'sent') && (
                              <button onClick={() => handleDNStatusChange(dn.id, 'delivered')} title="Kiszállítva" className="text-gray-400 hover:text-green-600 transition-colors">
                                <CheckCircle size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => handleGenerateInvoice(dn)}
                              disabled={generatingInvoiceId === dn.id}
                              title="Számla generálása"
                              className="text-gray-400 hover:text-blue-700 transition-colors disabled:opacity-50"
                            >
                              {generatingInvoiceId === dn.id
                                ? <Loader2 size={15} className="animate-spin" />
                                : <Receipt size={15} />
                              }
                            </button>
                            <button onClick={() => handleDeleteDN(dn.id)} className="text-gray-400 hover:text-red-600 transition-colors">
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
          </div>
        </>
      )}

      {/* Invoice modals */}
      {showCreateInvoice && (
        <Modal title="Új számla kiállítása" onClose={() => setShowCreateInvoice(false)} size="lg">
          <InvoiceForm onSave={() => { setShowCreateInvoice(false); fetchInvoices() }} onCancel={() => setShowCreateInvoice(false)} />
        </Modal>
      )}
      {editInvoice && (
        <Modal title={`Számla szerkesztése: ${editInvoice.number}`} onClose={() => setEditInvoice(null)} size="lg">
          <InvoiceForm invoice={editInvoice} onSave={() => { setEditInvoice(null); fetchInvoices() }} onCancel={() => setEditInvoice(null)} />
        </Modal>
      )}
      {previewInvoice && (
        <Modal title={`${previewInvoice.number} – Előnézet`} onClose={() => setPreviewInvoice(null)} size="xl">
          <InvoicePreview invoice={previewInvoice} />
        </Modal>
      )}

      {/* Delivery note modals */}
      {showCreateDN && (
        <Modal title="Új szállítólevél kiállítása" onClose={() => setShowCreateDN(false)} size="lg">
          <DeliveryNoteForm onSave={() => { setShowCreateDN(false); fetchDeliveryNotes() }} onCancel={() => setShowCreateDN(false)} />
        </Modal>
      )}
      {editDN && (
        <Modal title={`Szállítólevél szerkesztése: ${editDN.number}`} onClose={() => setEditDN(null)} size="lg">
          <DeliveryNoteForm deliveryNote={editDN} onSave={() => { setEditDN(null); fetchDeliveryNotes() }} onCancel={() => setEditDN(null)} />
        </Modal>
      )}
      {previewDN && (
        <Modal title={`${previewDN.number} – Előnézet`} onClose={() => setPreviewDN(null)} size="xl">
          <DeliveryNotePreview deliveryNote={previewDN} />
        </Modal>
      )}
    </div>
  )
}
