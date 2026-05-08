'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Search, Package, Building2, User, Plus, FileText, Copy, Edit2, Trash2, ChevronRight, Printer, X } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import Modal from '@/components/Modal'
import OrderForm from '@/components/OrderForm'

interface Order {
  id: string
  number: string
  date: string
  deliveryDate: string | null
  status: string
  total: number
  customerRef: string | null
  shippingMethod: string | null
  notes: string | null
  internalNotes: string | null
  deliveryAddress: string | null
  contact: { id: string; firstName: string; lastName: string } | null
  company: { id: string; name: string } | null
  items: { id: string; description: string; quantity: number; unitPrice: number; total: number }[]
}

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:       { label: 'Függőben',       color: 'bg-amber-100 text-amber-700' },
  confirmed:     { label: 'Visszaigazolva', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'Gyártásban',     color: 'bg-purple-100 text-purple-700' },
  shipped:       { label: 'Kiszállítva',    color: 'bg-indigo-100 text-indigo-700' },
  delivered:     { label: 'Átadva',         color: 'bg-green-100 text-green-700' },
  cancelled:     { label: 'Lemondva',       color: 'bg-red-100 text-red-700' },
}
const STATUS_FLOW = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered']

function fmtEur(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [viewOrder, setViewOrder] = useState<Order | null>(null)
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus !== 'all') params.set('status', filterStatus)
    const res = await fetch(`/api/orders?${params}`)
    const data = await res.json()
    setOrders(data)
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchOrders()
  }

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törlöd ezt a megrendelést?')) return
    await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    fetchOrders()
  }

  async function handleGenerateInvoice(id: string) {
    setGeneratingInvoice(id)
    const res = await fetch(`/api/orders/${id}/invoice`, { method: 'POST' })
    setGeneratingInvoice(null)
    if (res.ok) {
      alert('Számla sikeresen létrehozva! A Számlák menüben találod.')
      fetchOrders()
    } else {
      alert('Hiba a számla létrehozásakor.')
    }
  }

  async function handleDuplicate(id: string) {
    setDuplicating(id)
    const res = await fetch(`/api/orders/${id}/duplicate`, { method: 'POST' })
    setDuplicating(null)
    if (res.ok) {
      fetchOrders()
    }
  }

  const filtered = orders.filter(o => {
    const term = search.toLowerCase()
    return (
      !term ||
      o.number.toLowerCase().includes(term) ||
      o.contact?.firstName.toLowerCase().includes(term) ||
      o.contact?.lastName.toLowerCase().includes(term) ||
      o.company?.name.toLowerCase().includes(term) ||
      (o.customerRef?.toLowerCase().includes(term) ?? false)
    )
  })

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Megrendelések</h1>
          <p className="text-gray-500 mt-0.5">{filtered.length} megrendelés</p>
        </div>
        <button
          onClick={() => { setEditOrder(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Új megrendelés
        </button>
      </div>

      {/* Státusz összesítő */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        {Object.entries(ORDER_STATUS).map(([status, cfg]) => {
          const count = orders.filter(o => o.status === status).length
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
              className={`rounded-xl p-3 text-left border-2 transition-all ${
                filterStatus === status ? 'border-current shadow-sm scale-[1.02]' : 'border-transparent'
              } ${cfg.color}`}
            >
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs font-medium mt-0.5 opacity-80 leading-tight">{cfg.label}</p>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Szám, ügyfél, cég, vevői ref..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Minden státusz</option>
          {Object.entries(ORDER_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Betöltés...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Package size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nincs megrendelés</p>
          </div>
        ) : (
          filtered.map(order => {
            const os = ORDER_STATUS[order.status]
            const currentIdx = STATUS_FLOW.indexOf(order.status)
            return (
              <div key={order.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Fejléc */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setViewOrder(order)} className="font-mono font-semibold text-gray-900 hover:text-blue-600 hover:underline transition-colors">{order.number}</button>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${os?.color}`}>{os?.label}</span>
                        {order.customerRef && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Ref: {order.customerRef}</span>
                        )}
                        <span className="text-xs text-gray-400">{format(new Date(order.date), 'yyyy. MMM d.', { locale: hu })}</span>
                        {order.deliveryDate && (
                          <span className="text-xs text-gray-400">→ {format(new Date(order.deliveryDate), 'MMM d.', { locale: hu })}</span>
                        )}
                      </div>

                      {/* Cég / kontakt */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {order.company && (
                          <Link href={`/companies/${order.company.id}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                            <Building2 size={12} /> {order.company.name}
                          </Link>
                        )}
                        {order.contact && (
                          <Link href={`/contacts/${order.contact.id}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
                            <User size={12} /> {order.contact.firstName} {order.contact.lastName}
                          </Link>
                        )}
                      </div>

                      {/* Tételek preview */}
                      {order.items.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {order.items.slice(0, 4).map(item => (
                            <span key={item.id} className="text-xs text-gray-400">
                              {item.description} <span className="font-medium text-gray-600">{item.quantity} db</span>
                            </span>
                          ))}
                          {order.items.length > 4 && <span className="text-xs text-gray-400">+{order.items.length - 4} tétel</span>}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-gray-900">{fmtEur(order.total)}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {order.status !== 'cancelled' && (
                    <div className="mt-3 flex items-center gap-1">
                      {STATUS_FLOW.map((s, idx) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(order.id, s)}
                          title={ORDER_STATUS[s].label}
                          className={`flex-1 h-1.5 rounded-full transition-all hover:opacity-80 ${
                            idx <= currentIdx
                              ? idx === currentIdx ? 'bg-blue-500' : 'bg-blue-200'
                              : 'bg-gray-100'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Akció gombok */}
                  <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={order.status}
                        onChange={e => handleStatusChange(order.id, e.target.value)}
                        className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(ORDER_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.open(`/orders/${order.id}/print`, '_blank')}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Megrendelőlap nyomtatása"
                      >
                        <Printer size={12} />
                        Nyomtatás
                      </button>
                      <button
                        onClick={() => handleGenerateInvoice(order.id)}
                        disabled={generatingInvoice === order.id}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                        title="Számla generálása"
                      >
                        <FileText size={12} />
                        {generatingInvoice === order.id ? 'Generálás...' : 'Számla'}
                        <ChevronRight size={10} />
                      </button>
                      <button
                        onClick={() => handleDuplicate(order.id)}
                        disabled={duplicating === order.id}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                        title="Megismétlés"
                      >
                        <Copy size={12} />
                        {duplicating === order.id ? '...' : 'Megismétlés'}
                      </button>
                      <button
                        onClick={() => { setEditOrder(order); setShowModal(true) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Szerkesztés"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        title="Törlés"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Order detail view */}
      {viewOrder && (
        <Modal title={`Megrendelés: ${viewOrder.number}`} onClose={() => setViewOrder(null)} size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Cég / Partner</p>
                {viewOrder.company && <p className="font-semibold text-gray-900">{viewOrder.company.name}</p>}
                {viewOrder.contact && <p className="text-sm text-gray-600">{viewOrder.contact.firstName} {viewOrder.contact.lastName}</p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Adatok</p>
                <p className="text-sm text-gray-700">Dátum: {format(new Date(viewOrder.date), 'yyyy. MMM d.', { locale: hu })}</p>
                {viewOrder.deliveryDate && <p className="text-sm text-gray-700">Szállítás: {format(new Date(viewOrder.deliveryDate), 'yyyy. MMM d.', { locale: hu })}</p>}
                {viewOrder.customerRef && <p className="text-sm text-gray-500">Ref: {viewOrder.customerRef}</p>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${ORDER_STATUS[viewOrder.status]?.color}`}>{ORDER_STATUS[viewOrder.status]?.label}</span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left py-2 pr-4">Termék</th>
                <th className="text-right py-2 px-2">Menny.</th>
                <th className="text-right py-2 px-2">Egységár</th>
                <th className="text-right py-2">Összesen</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {viewOrder.items.map(item => (
                  <tr key={item.id}>
                    <td className="py-2 pr-4 text-gray-900">{item.description}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{item.quantity} db</td>
                    <td className="py-2 px-2 text-right text-gray-600">€{item.unitPrice.toFixed(2)}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">€{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right text-sm font-bold text-gray-900 border-t pt-2">
              Összesen: €{viewOrder.total.toFixed(2)}
            </div>
            {viewOrder.notes && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewOrder.notes}</p>}
            <div className="flex justify-between pt-2">
              <div className="flex gap-2">
                <button onClick={() => window.open(`/orders/${viewOrder.id}/print`, '_blank')} className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"><Printer size={14} /> Nyomtatás</button>
                <button onClick={() => handleGenerateInvoice(viewOrder.id)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 transition-colors"><FileText size={14} /> Számla</button>
              </div>
              <button onClick={() => { setViewOrder(null); setEditOrder(viewOrder); setShowModal(true) }} className="flex items-center gap-1.5 text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Edit2 size={14} /> Szerkesztés</button>
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal
          title={editOrder ? `Megrendelés: ${editOrder.number}` : 'Új megrendelés'}
          onClose={() => { setShowModal(false); setEditOrder(null) }}
          size="xl"
        >
          <OrderForm
            order={editOrder as Parameters<typeof OrderForm>[0]['order']}
            onSave={() => { setShowModal(false); setEditOrder(null); fetchOrders() }}
            onCancel={() => { setShowModal(false); setEditOrder(null) }}
          />
        </Modal>
      )}
    </div>
  )
}
