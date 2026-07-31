'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, FileText, Building2, User, Printer, Send, ArrowRightCircle, Eye, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import Modal from '@/components/Modal'
import QuoteForm from '@/components/QuoteForm'
import QuotePreview from '@/components/QuotePreview'

interface QuoteItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
  isDiscount: boolean
  productId?: string | null
}

interface Quote {
  id: string
  number: string
  date: string
  validUntil: string | null
  status: string
  currency: string
  subtotal: number
  vatAmount: number
  total: number
  notes: string | null
  sentAt: string | null
  billingName: string | null
  billingAddress: string | null
  billingZip: string | null
  billingCity: string | null
  billingCountry: string | null
  contact: { id: string; firstName: string; lastName: string } | null
  company: {
    id: string; name: string; address: string | null; zip: string | null; city: string | null
    vatId: string | null; phone: string | null; email: string | null; customerNumber: string | null
  } | null
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

type SortCol = 'number' | 'company' | 'date' | 'validUntil' | 'total' | 'status'

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const [showCreate, setShowCreate] = useState(false)
  const [editQuote, setEditQuote] = useState<Quote | null>(null)
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null)

  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }

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
    if (confirm(`Megrendelés létrehozva: ${data.order.number}\n\nMegnyitja a megrendeléseket?`)) {
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

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortCol) {
      case 'number': return a.number.localeCompare(b.number) * dir
      case 'company': return (a.company?.name ?? '').localeCompare(b.company?.name ?? '') * dir
      case 'validUntil': return ((a.validUntil ?? '') > (b.validUntil ?? '') ? 1 : -1) * dir
      case 'total': return (a.total - b.total) * dir
      case 'status': return a.status.localeCompare(b.status) * dir
      default: return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir
    }
  })

  const totalValue = filtered.reduce((s, q) => s + q.total, 0)
  const openValue = filtered.filter(q => q.status === 'sent').reduce((s, q) => s + q.total, 0)
  const acceptedValue = filtered.filter(q => q.status === 'accepted').reduce((s, q) => s + q.total, 0)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ajánlatok</h1>
          <p className="text-gray-500 mt-1">{filtered.length} ajánlat · {fmtEur(totalValue)} összesen</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Új ajánlat
        </button>
      </div>

      {/* Összesítők */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Ajánlatok összesen</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{fmtEur(totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Kiküldve, válaszra vár</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{fmtEur(openValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Elfogadott ajánlatok</p>
          <p className="text-xl font-bold text-green-600 mt-1">{fmtEur(acceptedValue)}</p>
        </div>
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
        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
          {[['all', 'Mind'], ['draft', 'Tervezet'], ['sent', 'Kiküldve'], ['accepted', 'Elfogadva']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterStatus(val)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${filterStatus === val ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
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
                  { col: 'number',     label: 'Ajánlatszám',  align: 'text-left'  },
                  { col: 'company',    label: 'Ügyfél / Cég', align: 'text-left'  },
                  { col: 'date',       label: 'Dátum',        align: 'text-left'  },
                  { col: 'validUntil', label: 'Érvényes',     align: 'text-left'  },
                  { col: 'total',      label: 'Összeg',       align: 'text-right' },
                  { col: 'status',     label: 'Státusz',      align: 'text-left'  },
                ] as const).map(({ col, label, align }) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`${align} px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700`}
                  >
                    {label}
                    {sortCol === col && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                ))}
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400">Betöltés...</td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                    <FileText size={32} className="text-gray-200 mx-auto mb-3" />
                    Nincs ajánlat
                  </td>
                </tr>
              ) : (
                sorted.map((q) => {
                  const qs = QUOTE_STATUS[q.status]
                  const editable = q.status === 'draft' || q.status === 'sent'
                  return (
                    <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                      <td
                        onClick={() => setPreviewQuote(q)}
                        className="px-5 py-3 font-mono text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                      >
                        {q.number}
                      </td>
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
                      <td className="px-5 py-3 text-right font-semibold text-gray-900 text-sm">{fmtEur(q.total)}</td>
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
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setPreviewQuote(q)} title="Előnézet"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Eye size={15} />
                          </button>
                          {editable && (
                            <button onClick={() => setEditQuote(q)} title="Szerkesztés"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Pencil size={15} />
                            </button>
                          )}
                          <button onClick={() => window.open(`/quotes/${q.id}/print`, '_blank')} title="Nyomtatás / PDF"
                            className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                            <Printer size={15} />
                          </button>
                          {q.status === 'draft' && (
                            <button onClick={() => handleMarkSent(q.id, q.number)} title="Kiküldöttre jelölés (+ utánkövető feladat)"
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                              <Send size={15} />
                            </button>
                          )}
                          {(q.status === 'sent' || q.status === 'accepted') && (
                            <button onClick={() => handleConvert(q.id, q.number)} title="Átgörgetés megrendelésre"
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                              <ArrowRightCircle size={15} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(q.id)} title="Törlés"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={15} />
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

      {showCreate && (
        <Modal title="Új ajánlat" onClose={() => setShowCreate(false)} size="lg">
          <QuoteForm onSave={() => { setShowCreate(false); fetchQuotes() }} onCancel={() => setShowCreate(false)} />
        </Modal>
      )}
      {editQuote && (
        <Modal title={`Ajánlat szerkesztése: ${editQuote.number}`} onClose={() => setEditQuote(null)} size="lg">
          <QuoteForm quote={editQuote} onSave={() => { setEditQuote(null); fetchQuotes() }} onCancel={() => setEditQuote(null)} />
        </Modal>
      )}
      {previewQuote && (
        <Modal title={`${previewQuote.number} – Előnézet`} onClose={() => setPreviewQuote(null)} size="xl">
          <QuotePreview quote={previewQuote} />
        </Modal>
      )}
    </div>
  )
}
