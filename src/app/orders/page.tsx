'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Search, Package, Building2, User, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface Order {
  id: string
  number: string
  date: string
  deliveryDate: string | null
  status: string
  total: number
  notes: string | null
  contact: { id: string; firstName: string; lastName: string } | null
  company: { id: string; name: string } | null
  items: { id: string; description: string; quantity: number; unitPrice: number; total: number }[]
}

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Függőben', color: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Visszaigazolva', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'Gyártásban', color: 'bg-purple-100 text-purple-700' },
  shipped: { label: 'Kiszállítva', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'Átadva', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Lemondva', color: 'bg-red-100 text-red-700' },
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

  const filtered = orders.filter((o) => {
    const term = search.toLowerCase()
    return (
      !term ||
      o.number.toLowerCase().includes(term) ||
      o.contact?.firstName.toLowerCase().includes(term) ||
      o.contact?.lastName.toLowerCase().includes(term) ||
      o.company?.name.toLowerCase().includes(term)
    )
  })

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Megrendelések</h1>
          <p className="text-gray-500 mt-1">{filtered.length} megrendelés</p>
        </div>
      </div>

      {/* Status pipeline summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {Object.entries(ORDER_STATUS).map(([status, cfg]) => {
          const count = orders.filter((o) => o.status === status).length
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
              className={`rounded-xl p-3 text-left border-2 transition-all ${
                filterStatus === status ? 'border-current shadow-sm' : 'border-transparent'
              } ${cfg.color}`}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs font-medium mt-1 opacity-80">{cfg.label}</p>
            </button>
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
          {Object.entries(ORDER_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">Betöltés...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <Package size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nincs megrendelés</p>
          </div>
        ) : (
          filtered.map((order) => {
            const os = ORDER_STATUS[order.status]
            const currentIdx = STATUS_FLOW.indexOf(order.status)
            return (
              <div key={order.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono font-semibold text-gray-900 text-sm">{order.number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${os?.color}`}>{os?.label}</span>
                        {order.deliveryDate && (
                          <span className="text-xs text-gray-400">
                            Szállítás: {format(new Date(order.deliveryDate), 'yyyy. MMM d.', { locale: hu })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {order.contact && (
                          <Link href={`/contacts/${order.contact.id}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                            <User size={12} />
                            {order.contact.firstName} {order.contact.lastName}
                          </Link>
                        )}
                        {order.company && (
                          <Link href={`/companies/${order.company.id}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
                            <Building2 size={12} />
                            {order.company.name}
                          </Link>
                        )}
                        <span className="text-xs text-gray-400">
                          {format(new Date(order.date), 'yyyy. MMM d.', { locale: hu })}
                        </span>
                      </div>
                      {order.items.length > 0 && (
                        <div className="mt-2 text-xs text-gray-400">
                          {order.items.slice(0, 3).map((item) => (
                            <span key={item.id} className="mr-2">
                              {item.description} ({item.quantity} db)
                            </span>
                          ))}
                          {order.items.length > 3 && <span>+{order.items.length - 3} tétel</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-gray-900">{fmtEur(order.total)}</p>
                    </div>
                  </div>

                  {/* Status progress */}
                  {order.status !== 'cancelled' && (
                    <div className="mt-4 flex items-center gap-1">
                      {STATUS_FLOW.map((s, idx) => {
                        const isCompleted = idx <= currentIdx
                        const isCurrent = idx === currentIdx
                        const sc = ORDER_STATUS[s]
                        return (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(order.id, s)}
                            title={sc.label}
                            className={`flex-1 h-1.5 rounded-full transition-all ${
                              isCompleted
                                ? isCurrent ? 'bg-blue-500' : 'bg-blue-200'
                                : 'bg-gray-100'
                            }`}
                          />
                        )
                      })}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex gap-2">
                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.entries(ORDER_STATUS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    {order.notes && (
                      <p className="text-xs text-gray-400 truncate max-w-xs">{order.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
