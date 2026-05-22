'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Package, AlertTriangle, Plus, Minus,
  ShoppingCart, CheckCircle2, FileText, Phone, Mail, Globe,
  MapPin, Factory, Tag,
} from 'lucide-react'
import Modal from '@/components/Modal'
import SupplierForm from '@/components/SupplierForm'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface Product {
  id: string
  name: string
  nameDE: string | null
  sku: string
  city: string | null
  stock: number
  minStock: number
  unit: string
  costPrice: number
  imageUrl: string | null
  material: string | null
}

interface Carrier {
  id: string
  code: string
  name: string
  nameDE: string | null
  group: string | null
  products: Product[]
}

interface PurchaseOrderItem {
  product: { id: string; name: string; sku: string; unit: string }
  quantity: number
}

interface PurchaseOrder {
  id: string
  number: string
  status: string
  createdAt: string
  items: PurchaseOrderItem[]
}

interface Supplier {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  zip: string | null
  country: string | null
  website: string | null
  vatId: string | null
  notes: string | null
  carriers: Carrier[]
  purchaseOrders: PurchaseOrder[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Vázlat',        color: 'bg-gray-100 text-gray-600' },
  sent:      { label: 'Elküldve',      color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Visszaigazolt', color: 'bg-purple-100 text-purple-700' },
  received:  { label: 'Megérkezett',   color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Törölt',        color: 'bg-red-100 text-red-600' },
}

export default function ManufacturingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'carriers' | 'orders'>('carriers')
  const [basket, setBasket] = useState<Record<string, number>>({})
  const [orderNotes, setOrderNotes] = useState('')
  const [savingOrder, setSavingOrder] = useState(false)
  const [showOrderConfirm, setShowOrderConfirm] = useState(false)

  const fetchSupplier = useCallback(async () => {
    const res = await fetch(`/api/suppliers/${id}`)
    if (res.ok) setSupplier(await res.json())
    setLoading(false)
  }, [id])

  useEffect(() => { fetchSupplier() }, [fetchSupplier])

  const allProducts = useMemo(() =>
    supplier?.carriers.flatMap(c => c.products) ?? [], [supplier])

  const lowStockProducts = useMemo(() =>
    allProducts.filter(p => p.stock <= p.minStock), [allProducts])

  const basketItems = useMemo(() =>
    Object.entries(basket)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        productId, quantity,
        product: allProducts.find(p => p.id === productId),
      }))
  , [basket, allProducts])

  function setQty(productId: string, qty: number) {
    setBasket(b => ({ ...b, [productId]: Math.max(0, qty) }))
  }

  async function handleCreateOrder() {
    if (basketItems.length === 0) return
    setSavingOrder(true)
    const res = await fetch('/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: id, notes: orderNotes,
        items: basketItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.product?.costPrice ?? 0,
        })),
      }),
    })
    setSavingOrder(false)
    if (res.ok) {
      setBasket({}); setOrderNotes(''); setShowOrderConfirm(false)
      setActiveTab('orders'); fetchSupplier()
    }
  }

  if (loading) return <div className="p-6 h-64 flex items-center justify-center text-gray-400">Betöltés...</div>
  if (!supplier) return <div className="p-6"><p className="text-gray-500">Partner nem található.</p><Link href="/manufacturing" className="text-blue-600 hover:underline">← Vissza</Link></div>

  const basketCount = basketItems.length
  const totalProducts = allProducts.length

  // Group carriers by group (Kő, Bélyeg, Fa, etc.)
  const groupedCarriers: Record<string, Carrier[]> = {}
  for (const c of supplier.carriers) {
    const g = c.group || 'Egyéb'
    if (!groupedCarriers[g]) groupedCarriers[g] = []
    groupedCarriers[g].push(c)
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/manufacturing')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
              <Factory size={15} className="text-indigo-600" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{supplier.name}</h1>
          </div>
          {supplier.contactName && <p className="text-sm text-gray-500 mt-0.5 ml-10">{supplier.contactName}</p>}
        </div>
        <button onClick={() => setShowEditModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          <Edit2 size={14} /><span className="hidden sm:inline">Szerkesztés</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left sidebar */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
            {supplier.phone && (
              <a href={`tel:${supplier.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-600">
                <Phone size={13} className="text-gray-400" />{supplier.phone}
              </a>
            )}
            {supplier.email && (
              <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
                <Mail size={13} className="text-gray-400" /><span className="truncate">{supplier.email}</span>
              </a>
            )}
            {supplier.website && (
              <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
                <Globe size={13} className="text-gray-400" /><span className="truncate">{supplier.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
            {(supplier.address || supplier.city) && (
              <div className="flex items-start gap-2 text-sm text-gray-500">
                <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
                <span>{[supplier.address, supplier.zip, supplier.city, supplier.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {supplier.vatId && <p className="text-xs text-gray-400 font-mono">ÁFA: {supplier.vatId}</p>}
            {supplier.notes && <p className="text-xs text-gray-500 border-t pt-2 mt-2">{supplier.notes}</p>}
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Hordozók</span>
              <span className="font-semibold">{supplier.carriers.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Termékek</span>
              <span className="font-semibold">{totalProducts}</span>
            </div>
          </div>

          {/* Low stock */}
          {lowStockProducts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-amber-500" />
                <p className="text-sm font-semibold text-amber-700">Rendelendő ({lowStockProducts.length})</p>
              </div>
              <div className="space-y-1.5">
                {lowStockProducts.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-amber-800 truncate flex-1">{p.name}</p>
                    <span className="text-xs font-mono text-amber-700 shrink-0">{p.stock}/{p.minStock}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Basket */}
          {basketCount > 0 && (
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart size={15} className="text-blue-600" />
                <p className="font-semibold text-gray-900 text-sm">Kosár ({basketCount} tétel)</p>
              </div>
              <div className="space-y-1.5 mb-3">
                {basketItems.map(item => (
                  <div key={item.productId} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate flex-1">{item.product?.name}</span>
                    <span className="font-mono text-gray-500 shrink-0 ml-2">{item.quantity} {item.product?.unit}</span>
                  </div>
                ))}
              </div>
              <textarea rows={2} placeholder="Megjegyzés..." value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2" />
              <div className="flex gap-2">
                <button onClick={() => setBasket({})} className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Törlés</button>
                <button onClick={() => setShowOrderConfirm(true)} className="flex-1 text-xs py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Megrendelés</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: tabs */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { key: 'carriers', label: `Hordozók & Termékek (${supplier.carriers.length})` },
              { key: 'orders',   label: `Rendelések (${supplier.purchaseOrders.length})` },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as 'carriers' | 'orders')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Carriers tab */}
          {activeTab === 'carriers' && (
            <div className="space-y-3">
              {supplier.carriers.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
                  <Tag size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Nincs hordozó ehhez a partnerhez.</p>
                  <p className="text-gray-400 text-xs mt-1">A Hordozók kezelőben rendeld hozzá a partnert az egyes hordozókhoz.</p>
                </div>
              ) : (
                Object.entries(groupedCarriers).map(([group, carriers]) => (
                  <div key={group} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Group header */}
                    <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                      <Tag size={13} className="text-indigo-400" />
                      <span className="text-sm font-bold text-indigo-700">{group}</span>
                    </div>

                    {carriers.map(carrier => (
                      <div key={carrier.id}>
                        {/* Carrier row */}
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700">{carrier.name}</span>
                          {carrier.nameDE && <span className="text-xs text-gray-400">· {carrier.nameDE}</span>}
                          <span className="ml-auto text-xs text-gray-400">{carrier.products.length} termék</span>
                        </div>

                        {/* Products */}
                        {carrier.products.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-gray-400 italic">Nincs termék ennél a hordozónál</div>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {carrier.products.map(p => {
                              const isLow = p.stock <= p.minStock
                              const qty = basket[p.id] ?? 0
                              return (
                                <div key={p.id} className={`px-4 py-3 flex items-center gap-3 ${isLow ? 'bg-amber-50/40' : ''}`}>
                                  {p.imageUrl ? (
                                    <img src={p.imageUrl} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-gray-100 shrink-0" />
                                  ) : (
                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                      <Package size={16} className="text-gray-400" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                                    {p.nameDE && <p className="text-xs text-gray-500 truncate">{p.nameDE}</p>}
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs font-mono text-gray-400">{p.sku}</span>
                                      {p.city && <span className="text-xs text-gray-400 flex items-center gap-0.5"><MapPin size={9} />{p.city}</span>}
                                      <span className={`text-xs font-medium flex items-center gap-0.5 ${isLow ? 'text-amber-600' : 'text-gray-500'}`}>
                                        {isLow && <AlertTriangle size={10} />}
                                        {p.stock}/{p.minStock} {p.unit}
                                      </span>
                                    </div>
                                  </div>
                                  {/* Qty stepper */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => setQty(p.id, qty - 1)} disabled={qty === 0}
                                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                                      <Minus size={12} />
                                    </button>
                                    <input type="number" min={0} value={qty || ''} placeholder="0"
                                      onChange={e => setQty(p.id, parseInt(e.target.value) || 0)}
                                      className="w-12 text-center text-sm border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    <button onClick={() => setQty(p.id, qty + 1)}
                                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Orders tab */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              {supplier.purchaseOrders.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Még nincs rendelés.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {supplier.purchaseOrders.map(order => {
                    const st = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft
                    return (
                      <Link key={order.id} href={`/manufacturing/order/${order.id}`}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                        <FileText size={16} className="text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 font-mono">{order.number}</p>
                          <p className="text-xs text-gray-400">
                            {format(new Date(order.createdAt), 'yyyy. MMM d.', { locale: hu })} · {order.items.length} termék
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${st.color}`}>{st.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <Modal title="Gyártópartner szerkesztése" onClose={() => setShowEditModal(false)}>
          <SupplierForm supplier={supplier} onSave={() => { setShowEditModal(false); fetchSupplier() }} onCancel={() => setShowEditModal(false)} />
        </Modal>
      )}

      {showOrderConfirm && (
        <Modal title="Megrendelés megerősítése" onClose={() => setShowOrderConfirm(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Tételek <strong>{supplier.name}</strong> partnerhez:</p>
            <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
              {basketItems.map(item => (
                <div key={item.productId} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-800">{item.product?.name}</span>
                  <span className="font-mono text-gray-600">{item.quantity} {item.product?.unit}</span>
                </div>
              ))}
            </div>
            {orderNotes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">Megjegyzés: {orderNotes}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowOrderConfirm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Mégse</button>
              <button onClick={handleCreateOrder} disabled={savingOrder}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                <CheckCircle2 size={14} />
                {savingOrder ? 'Mentés...' : 'Megrendelés létrehozása'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
