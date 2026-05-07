'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, AlertTriangle, TrendingDown, ChevronDown, ChevronUp, History, Package } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface Company { id: string; name: string; city: string | null; partnerType: string | null; address: string | null }
interface Contact { id: string; firstName: string; lastName: string; companyId: string | null }
interface Product { id: string; name: string; sku: string; stock: number; salesPrice: number; city: string | null; productType: string | null; priceListEntryId: string | null; imageUrl: string | null }
interface PriceEntry { id: string; name: string; basePrice: number; tiers: { qty: number; m: number }[] }
interface PrevOrderItem { description: string; quantity: number; unitPrice: number; productId: string | null }
interface PrevOrder { id: string; number: string; date: string; total: number; items: PrevOrderItem[] }

interface OrderItem {
  productId: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  stock: number
  tierApplied: boolean
}

interface OrderData {
  id: string
  status: string
  notes: string | null
  internalNotes: string | null
  customerRef: string | null
  deliveryAddress: string | null
  deliveryDate: string | null
  shippingMethod: string | null
  contactId: string | null
  companyId: string | null
  items: { productId: string | null; description: string; quantity: number; unitPrice: number; vatRate: number }[]
}

interface OrderFormProps {
  order?: OrderData | null
  defaultCompanyId?: string
  onSave: () => void
  onCancel: () => void
}

function getTierPrice(basePrice: number, qty: number, tiers: { qty: number; m: number }[]): number | null {
  if (!tiers.length) return null
  const sorted = [...tiers].sort((a, b) => b.qty - a.qty)
  const tier = sorted.find(t => qty >= t.qty)
  return tier ? Math.round(basePrice * tier.m * 100) / 100 : null
}

function findPriceEntry(product: Product, pricelist: PriceEntry[]): PriceEntry | null {
  if (product.priceListEntryId) {
    return pricelist.find(e => e.id === product.priceListEntryId) || null
  }
  return null
}

export default function OrderForm({ order, defaultCompanyId, onSave, onCancel }: OrderFormProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pricelist, setPricelist] = useState<PriceEntry[]>([])
  const [prevOrders, setPrevOrders] = useState<PrevOrder[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(false)

  const [companyId, setCompanyId] = useState(order?.companyId || defaultCompanyId || '')
  const [contactId, setContactId] = useState(order?.contactId || '')
  const [status, setStatus] = useState(order?.status || 'pending')
  const [date, setDate] = useState(order ? '' : new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState(order?.deliveryDate?.slice(0, 10) || '')
  const [deliveryAddress, setDeliveryAddress] = useState(order?.deliveryAddress || '')
  const [shippingMethod, setShippingMethod] = useState(order?.shippingMethod || '')
  const [customerRef, setCustomerRef] = useState(order?.customerRef || '')
  const [notes, setNotes] = useState(order?.notes || '')
  const [internalNotes, setInternalNotes] = useState(order?.internalNotes || '')
  const [items, setItems] = useState<OrderItem[]>(
    order?.items.map(i => ({
      productId: i.productId || '',
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      vatRate: i.vatRate,
      stock: 999,
      tierApplied: false,
    })) || []
  )

  const selectedCompany = companies.find(c => c.id === companyId) || null
  const filteredContacts = contacts.filter(c => !companyId || c.companyId === companyId)

  useEffect(() => {
    Promise.all([
      fetch('/api/companies').then(r => r.json()),
      fetch('/api/contacts').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/pricelist').then(r => r.json()),
    ]).then(([co, ct, pr, pl]) => {
      setCompanies(co)
      setContacts(ct)
      setProducts(pr)
      setPricelist(pl)
    })
  }, [])

  const fetchPrevOrders = useCallback(async (cid: string) => {
    if (!cid) { setPrevOrders([]); return }
    const res = await fetch(`/api/orders?companyId=${cid}`)
    if (res.ok) {
      const data: PrevOrder[] = await res.json()
      setPrevOrders(data.filter(o => o.id !== order?.id).slice(0, 5))
    }
  }, [order?.id])

  useEffect(() => {
    fetchPrevOrders(companyId)
    // Auto-fill delivery address from company
    if (companyId) {
      const co = companies.find(c => c.id === companyId)
      if (co?.address && !deliveryAddress) setDeliveryAddress(co.address)
    }
  }, [companyId, companies]) // eslint-disable-line

  // Build ranked product list
  const rankedProducts = (() => {
    if (!products.length) return []

    // Count previously ordered product frequencies
    const freq = new Map<string, number>()
    prevOrders.forEach(o => o.items.forEach(i => {
      if (i.productId) freq.set(i.productId, (freq.get(i.productId) || 0) + i.quantity)
    }))

    return [...products].sort((a, b) => {
      const aFreq = freq.get(a.id) || 0
      const bFreq = freq.get(b.id) || 0
      if (aFreq !== bFreq) return bFreq - aFreq
      const aCity = selectedCompany?.city && a.city === selectedCompany.city ? 1 : 0
      const bCity = selectedCompany?.city && b.city === selectedCompany.city ? 1 : 0
      return bCity - aCity
    })
  })()

  // Previously ordered product IDs for badge display
  const prevProductIds = new Set(prevOrders.flatMap(o => o.items.map(i => i.productId).filter(Boolean)))

  function addProduct(product: Product) {
    const priceEntry = findPriceEntry(product, pricelist)
    const tierPrice = priceEntry ? getTierPrice(priceEntry.basePrice, 1, priceEntry.tiers) : null
    setItems(prev => [...prev, {
      productId: product.id,
      description: product.name,
      quantity: 1,
      unitPrice: tierPrice ?? product.salesPrice,
      vatRate: 19,
      stock: product.stock,
      tierApplied: !!tierPrice,
    }])
  }

  function addBlankItem() {
    setItems(prev => [...prev, {
      productId: '', description: '', quantity: 1, unitPrice: 0, vatRate: 19, stock: 999, tierApplied: false,
    }])
  }

  function updateItem(idx: number, field: string, value: string | number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      // Recalculate tier price when quantity changes
      if (field === 'quantity' && item.productId) {
        const product = products.find(p => p.id === item.productId)
        if (product) {
          const priceEntry = findPriceEntry(product, pricelist)
          if (priceEntry) {
            const tierPrice = getTierPrice(priceEntry.basePrice, Number(value), priceEntry.tiers)
            if (tierPrice !== null) {
              updated.unitPrice = tierPrice
              updated.tierApplied = true
            }
          }
        }
      }
      return updated
    }))
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function applyPrevOrder(prevOrder: PrevOrder) {
    const newItems: OrderItem[] = prevOrder.items.map(i => {
      const product = products.find(p => p.id === i.productId)
      return {
        productId: i.productId || '',
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        vatRate: 19,
        stock: product?.stock ?? 999,
        tierApplied: false,
      }
    })
    setItems(newItems)
    setShowHistory(false)
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
  const total = subtotal + vatAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!items.length) return alert('Adj hozzá legalább egy terméket!')
    setLoading(true)
    const body = {
      status, notes, internalNotes, customerRef, deliveryAddress, shippingMethod: shippingMethod || null,
      deliveryDate, date, contactId: contactId || null, companyId: companyId || null,
      items: items.map(({ productId, description, quantity, unitPrice, vatRate }) => ({
        productId: productId || null, description, quantity, unitPrice, vatRate,
      })),
    }
    const method = order ? 'PUT' : 'POST'
    const url = order ? `/api/orders/${order.id}` : '/api/orders'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setLoading(false)
    onSave()
  }

  const ORDER_STATUSES = [
    { value: 'pending', label: 'Függőben' },
    { value: 'confirmed', label: 'Visszaigazolva' },
    { value: 'in_production', label: 'Gyártásban' },
    { value: 'shipped', label: 'Kiszállítva' },
    { value: 'delivered', label: 'Átadva' },
    { value: 'cancelled', label: 'Lemondva' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Cég + kontakt + státusz */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cég *</label>
          <select
            required
            value={companyId}
            onChange={e => { setCompanyId(e.target.value); setContactId('') }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Válassz céget —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedCompany?.city && (
            <p className="text-xs text-gray-400 mt-1">📍 {selectedCompany.city} · {selectedCompany.partnerType || '—'}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Kapcsolattartó</label>
          <select
            value={contactId}
            onChange={e => setContactId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">—</option>
            {filteredContacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Státusz</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Dátumok + ref + szállítási cím */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Rendelés dátuma</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Szállítási határidő</label>
          <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Vevői rendelési szám (Bestellnummer)</label>
          <input type="text" value={customerRef} onChange={e => setCustomerRef(e.target.value)}
            placeholder="pl. PO-2025-0047"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Szállítási cím</label>
          <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
            placeholder="Utca, irányítószám, város, ország"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Szállítási mód</label>
          <input
            type="text"
            list="shipping-methods"
            value={shippingMethod}
            onChange={e => setShippingMethod(e.target.value)}
            placeholder="GLS, DPD, személyes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="shipping-methods">
            <option value="GLS" />
            <option value="DPD" />
            <option value="UPS" />
            <option value="FedEx" />
            <option value="Személyes átvétel" />
            <option value="Expressz" />
          </datalist>
        </div>
      </div>

      {/* Előző rendelések */}
      {prevOrders.length > 0 && (
        <div className="border border-amber-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHistory(h => !h)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 text-sm font-medium text-amber-800"
          >
            <span className="flex items-center gap-2"><History size={14} /> Korábbi rendelések ({prevOrders.length})</span>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showHistory && (
            <div className="divide-y divide-amber-100">
              {prevOrders.map(prev => (
                <div key={prev.id} className="px-4 py-3 flex items-center justify-between gap-3 bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-semibold text-gray-800">{prev.number}</p>
                    <p className="text-xs text-gray-400">{format(new Date(prev.date), 'yyyy. MMM d.', { locale: hu })} · €{prev.total.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {prev.items.slice(0, 3).map(i => `${i.description} (${i.quantity})`).join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyPrevOrder(prev)}
                    className="text-xs px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors shrink-0"
                  >
                    Megismétlés
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Termék ajánlások */}
      {companyId && rankedProducts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">
            Termékek
            {selectedCompany?.city && <span className="text-gray-400"> · {selectedCompany.city} alapján rendezve</span>}
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-72 overflow-y-auto p-1">
            {rankedProducts.slice(0, 48).map(p => {
              const isPrev = prevProductIds.has(p.id)
              const isCity = !isPrev && selectedCompany?.city && p.city === selectedCompany.city
              const alreadyAdded = items.some(i => i.productId === p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  disabled={alreadyAdded}
                  title={`${p.name}${p.stock === 0 ? ' — NINCS KÉSZLETEN' : p.stock <= 5 ? ` — Csak ${p.stock} db` : ''}`}
                  className={`relative flex flex-col items-center rounded-xl border-2 p-1.5 text-center transition-all ${
                    alreadyAdded
                      ? 'opacity-40 cursor-not-allowed border-gray-200 bg-gray-50'
                      : isPrev
                        ? 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:scale-[1.03] shadow-sm'
                        : isCity
                          ? 'border-green-300 bg-green-50 hover:bg-green-100 hover:scale-[1.03]'
                          : 'border-gray-200 bg-white hover:bg-gray-50 hover:scale-[1.02]'
                  }`}
                >
                  {/* Badge */}
                  {isPrev && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center leading-none">⭐</span>
                  )}
                  {isCity && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center leading-none">📍</span>
                  )}

                  {/* Thumbnail */}
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="w-12 h-12 object-cover rounded-lg mb-1" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg mb-1 flex items-center justify-center">
                      <Package size={18} className="text-gray-300" />
                    </div>
                  )}

                  {/* Name */}
                  <p className="text-[10px] font-medium text-gray-700 leading-tight line-clamp-2 w-full">{p.name}</p>

                  {/* Stock warning */}
                  {p.stock === 0 && <span className="text-[9px] text-red-500 font-bold mt-0.5">0db!</span>}
                  {p.stock > 0 && p.stock <= 5 && <span className="text-[9px] text-orange-500 mt-0.5">{p.stock}db</span>}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">⭐ = korábban rendelt · 📍 = városhoz illő · Kattints a hozzáadáshoz</p>
        </div>
      )}

      {/* Tételek */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-600">Tételek</p>
          <button type="button" onClick={addBlankItem} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <Plus size={12} /> Üres sor
          </button>
        </div>

        {items.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400">
            Adj hozzá termékeket a fenti listából, vagy kattints az &quot;Üres sor&quot; gombra.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-2">
              <div className="col-span-4">Termék / Leírás</div>
              <div className="col-span-2 text-right">Menny.</div>
              <div className="col-span-2 text-right">Egységár €</div>
              <div className="col-span-1 text-right">ÁFA%</div>
              <div className="col-span-2 text-right">Összesen</div>
              <div className="col-span-1"></div>
            </div>

            {items.map((item, idx) => {
              const lineTotal = item.quantity * item.unitPrice * (1 + item.vatRate / 100)
              const overStock = item.stock < item.quantity && item.stock < 999
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                  <div className="col-span-12 sm:col-span-4">
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateItem(idx, 'description', e.target.value)}
                      placeholder="Leírás..."
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {item.tierApplied && (
                      <span className="text-xs text-indigo-600 flex items-center gap-0.5 mt-0.5">
                        <TrendingDown size={10} /> Tier ár alkalmazva
                      </span>
                    )}
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {overStock && (
                      <p className="text-xs text-orange-500 flex items-center gap-0.5 mt-0.5">
                        <AlertTriangle size={10} /> Csak {item.stock} db van
                      </p>
                    )}
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice}
                      onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <select
                      value={item.vatRate}
                      onChange={e => updateItem(idx, 'vatRate', Number(e.target.value))}
                      className="w-full px-1 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value={0}>0%</option>
                      <option value={7}>7%</option>
                      <option value={19}>19%</option>
                    </select>
                  </div>
                  <div className="col-span-4 sm:col-span-2 text-right text-sm font-semibold text-gray-800 pr-1">
                    €{lineTotal.toFixed(2)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button type="button" onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Összesítő */}
            <div className="border-t border-gray-200 pt-2 space-y-1 text-sm text-right pr-8">
              <div className="flex justify-end gap-8 text-gray-500">
                <span>Nettó:</span>
                <span className="w-24 font-medium text-gray-800">€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-end gap-8 text-gray-500">
                <span>ÁFA:</span>
                <span className="w-24 font-medium text-gray-800">€{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-end gap-8 font-bold text-gray-900 text-base">
                <span>Összesen:</span>
                <span className="w-24">€{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Megjegyzések */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Megjegyzés (ügyfélnek látható)</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Szállítási instrukciók, különleges kérések..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Belső megjegyzés</label>
          <textarea rows={2} value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
            placeholder="Belső feljegyzések, nem látja az ügyfél..."
            className="w-full px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm">
          Mégse
        </button>
        <button type="submit" disabled={loading || !items.length}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium">
          {loading ? 'Mentés...' : order ? 'Módosítás' : 'Megrendelés létrehozása'}
        </button>
      </div>
    </form>
  )
}
