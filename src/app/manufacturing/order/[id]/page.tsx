'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, Package, MapPin, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  note: string | null
  product: { id: string; name: string; nameDE: string | null; sku: string; unit: string; costPrice: number; city: string | null; imageUrl: string | null }
}

interface PurchaseOrder {
  id: string
  number: string
  status: string
  notes: string | null
  createdAt: string
  orderedAt: string | null
  supplier: {
    id: string; name: string; contactName: string | null; email: string | null
    phone: string | null; address: string | null; city: string | null; zip: string | null; country: string | null
  }
  items: OrderItem[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: 'Vázlat',          color: 'bg-gray-100 text-gray-600',     icon: Clock },
  sent:      { label: 'Elküldve',        color: 'bg-blue-100 text-blue-700',     icon: Clock },
  confirmed: { label: 'Visszaigazolt',   color: 'bg-purple-100 text-purple-700', icon: CheckCircle2 },
  received:  { label: 'Megérkezett',     color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  cancelled: { label: 'Törölt',          color: 'bg-red-100 text-red-600',       icon: XCircle },
}

const NEXT_STATUSES: Record<string, string[]> = {
  draft:     ['sent', 'cancelled'],
  sent:      ['confirmed', 'cancelled'],
  confirmed: ['received', 'cancelled'],
  received:  [],
  cancelled: [],
}

export default function PurchaseOrderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/purchase-orders/${id}`)
    if (res.ok) setOrder(await res.json())
    setLoading(false)
  }, [id])

  useEffect(() => { fetchOrder() }, [fetchOrder])

  async function handleStatusChange(newStatus: string) {
    if (!order) return
    setUpdating(true)
    await fetch(`/api/purchase-orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        notes: order.notes,
        orderedAt: newStatus === 'sent' ? new Date().toISOString() : order.orderedAt,
        items: order.items.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.unitPrice, note: i.note })),
      }),
    })
    setUpdating(false)
    fetchOrder()
  }

  async function handleDelete() {
    if (!confirm('Törli ezt a megrendelést?')) return
    await fetch(`/api/purchase-orders/${id}`, { method: 'DELETE' })
    router.back()
  }

  if (loading) return <div className="p-6 h-64 flex items-center justify-center text-gray-400">Betöltés...</div>
  if (!order) return <div className="p-6"><p className="text-gray-500">Megrendelés nem található.</p></div>

  const st = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft
  const StatusIcon = st.icon
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0)

  // Group items by city
  const byCity: Record<string, OrderItem[]> = {}
  for (const item of order.items) {
    const city = item.product.city || '—'
    if (!byCity[city]) byCity[city] = []
    byCity[city].push(item)
  }
  const sortedCities = Object.keys(byCity).sort((a, b) => a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b))

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 font-mono">{order.number}</h1>
          <p className="text-sm text-gray-500">{order.supplier.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {NEXT_STATUSES[order.status]?.map(next => (
            <button key={next} onClick={() => handleStatusChange(next)} disabled={updating}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50 ${
                next === 'cancelled' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-blue-200 text-blue-600 hover:bg-blue-50'
              }`}>
              → {STATUS_CONFIG[next]?.label}
            </button>
          ))}
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            <Printer size={14} />
            <span className="hidden sm:inline">Nyomtatás</span>
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">Megrendelőlap — {order.number}</h1>
        <p className="text-gray-600 mt-1">Gyártópartner: {order.supplier.name}</p>
        {order.orderedAt && <p className="text-gray-500 text-sm">Rendelés dátuma: {format(new Date(order.orderedAt), 'yyyy. MMMM d.', { locale: hu })}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: meta */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 print:shadow-none print:border-gray-300">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Státusz</h3>
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full ${st.color}`}>
              <StatusIcon size={13} />{st.label}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 print:shadow-none print:border-gray-300">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Gyártópartner</h3>
            <p className="font-semibold text-gray-900 text-sm">{order.supplier.name}</p>
            {order.supplier.contactName && <p className="text-xs text-gray-500 mt-0.5">{order.supplier.contactName}</p>}
            {order.supplier.email && <p className="text-xs text-gray-500">{order.supplier.email}</p>}
            {order.supplier.phone && <p className="text-xs text-gray-500">{order.supplier.phone}</p>}
            {(order.supplier.address || order.supplier.city) && (
              <p className="text-xs text-gray-400 mt-1">
                {[order.supplier.address, order.supplier.zip, order.supplier.city, order.supplier.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 print:shadow-none print:border-gray-300">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Összesítő</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Létrehozva</span><span>{format(new Date(order.createdAt), 'yyyy. MMM d.', { locale: hu })}</span></div>
              {order.orderedAt && <div className="flex justify-between"><span className="text-gray-500">Elküldve</span><span>{format(new Date(order.orderedAt), 'yyyy. MMM d.', { locale: hu })}</span></div>}
              <div className="flex justify-between pt-1 border-t border-gray-100"><span className="text-gray-500">Tételek</span><span className="font-semibold">{order.items.length} féle / {totalItems} db</span></div>
            </div>
            {order.notes && <p className="text-xs text-gray-500 border-t pt-2 mt-2">{order.notes}</p>}
          </div>

          {order.status === 'draft' && (
            <button onClick={handleDelete} className="w-full text-xs text-red-500 hover:text-red-600 py-2 print:hidden">
              Megrendelés törlése
            </button>
          )}
        </div>

        {/* Right: items by city */}
        <div className="md:col-span-2 space-y-4">
          {sortedCities.map(city => (
            <div key={city} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden print:shadow-none print:border-gray-300">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2 print:bg-white">
                <MapPin size={12} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">{city}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {byCity[city].map(item => (
                  <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                    {item.product.imageUrl ? (
                      <img src={item.product.imageUrl} alt="" className="w-9 h-9 object-cover rounded-lg border border-gray-100 shrink-0 print:hidden" />
                    ) : (
                      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 print:hidden">
                        <Package size={14} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.product.name}</p>
                      {item.product.nameDE && <p className="text-xs text-gray-500">{item.product.nameDE}</p>}
                      <p className="text-xs text-gray-400 font-mono">{item.product.sku}</p>
                      {item.note && <p className="text-xs text-gray-500 italic mt-0.5">{item.note}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{item.quantity} {item.product.unit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
