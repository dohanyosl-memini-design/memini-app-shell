'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, Edit2, Trash2, Package, AlertTriangle, ArrowUpDown, X,
  ArrowDown, ArrowUp, RefreshCw, FileText, ChevronDown, ChevronUp, Settings,
} from 'lucide-react'
import Image from 'next/image'
import Modal from '@/components/Modal'
import ProductForm from '@/components/ProductForm'
import StockMovementForm from '@/components/StockMovementForm'
import CarrierSettingsModal from '@/components/CarrierSettingsModal'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface Carrier { id: string; code: string; name: string; nameDE: string | null; group: string | null }

interface Product {
  id: string; name: string; nameDE: string | null; sku: string
  description: string | null; material: string | null; productType: string | null
  site: string | null; city: string | null
  locationCabinet: string | null; locationShelf: string | null; locationBox: string | null
  costPrice: number; salesPrice: number; stock: number; minStock: number
  unit: string; vatRate: number; imageUrl: string | null; priceListEntryId: string | null
}

interface StockMovement {
  id: string; type: string; quantity: number
  note: string | null; supplier: string | null; reference: string | null; createdAt: string
  product: { id: string; name: string; sku: string; nameDE: string | null }
}

const GROUP_COLORS: Record<string, string> = {
  'Kő': 'bg-stone-100 text-stone-700', 'Bélyeg': 'bg-blue-100 text-blue-700',
  'Fa': 'bg-amber-100 text-amber-700', 'Templomablak': 'bg-purple-100 text-purple-700',
}
const DEFAULT_BADGE = 'bg-gray-100 text-gray-700'

const MOVEMENT_CONFIG = {
  in:         { label: 'Bevételezés', color: 'bg-green-100 text-green-700',  icon: ArrowDown  },
  out:        { label: 'Kiadás',      color: 'bg-red-100 text-red-700',      icon: ArrowUp    },
  adjustment: { label: 'Korrekció',   color: 'bg-amber-100 text-amber-700',  icon: RefreshCw  },
  sale:       { label: 'Eladás',      color: 'bg-orange-100 text-orange-700',icon: FileText   },
}

export default function WarehousePage() {
  const [tab, setTab] = useState<'products' | 'log'>('products')

  const [products, setProducts] = useState<Product[]>([])
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [search, setSearch] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')
  const [cabinetFilter, setCabinetFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [showCarrierSettings, setShowCarrierSettings] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  const [productMovements, setProductMovements] = useState<StockMovement[]>([])
  const [loadingProductMovements, setLoadingProductMovements] = useState(false)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [productStats, setProductStats] = useState<null | { thisYear: { year: number; quantity: number; revenue: number; orderCount: number }; lastYear: { year: number; quantity: number; revenue: number; orderCount: number }; twoYearsAgo: { year: number; quantity: number; revenue: number; orderCount: number } }>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [logSearch, setLogSearch] = useState('')
  const [logTypeFilter, setLogTypeFilter] = useState('')
  const [lowStockOpen, setLowStockOpen] = useState(false)
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())

  const fetchCarriers = useCallback(async () => {
    const res = await fetch('/api/carriers')
    setCarriers(await res.json())
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (materialFilter) params.set('material', materialFilter)
    const res = await fetch(`/api/products?${params}`)
    let data: Product[] = await res.json()
    if (cabinetFilter) data = data.filter(p => p.locationCabinet === cabinetFilter)
    setProducts(data)
    setLoadingProducts(false)
  }, [search, materialFilter, cabinetFilter])

  const fetchMovements = useCallback(async () => {
    setLoadingMovements(true)
    const res = await fetch('/api/stock?limit=500')
    setMovements(await res.json())
    setLoadingMovements(false)
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { fetchCarriers() }, [fetchCarriers])
  useEffect(() => { if (tab === 'log') fetchMovements() }, [tab, fetchMovements])

  async function handleDelete(id: string) {
    if (!confirm('Biztosan archiválja ezt a terméket?')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    fetchProducts()
  }

  async function openProductDetail(product: Product) {
    setDetailProduct(product)
    setLoadingStats(true)
    const res = await fetch(`/api/products/${product.id}/stats`)
    if (res.ok) setProductStats(await res.json())
    setLoadingStats(false)
  }

  async function toggleProductHistory(productId: string) {
    if (expandedProductId === productId) { setExpandedProductId(null); return }
    setExpandedProductId(productId)
    setLoadingProductMovements(true)
    const res = await fetch(`/api/stock?productId=${productId}`)
    setProductMovements(await res.json())
    setLoadingProductMovements(false)
  }

  function toggleCity(city: string) {
    setExpandedCities(prev => {
      const next = new Set(prev)
      next.has(city) ? next.delete(city) : next.add(city)
      return next
    })
  }

  const lowStock = products.filter(p => p.minStock > 0 && p.stock <= p.minStock)
  const totalStockValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0)
  const totalSalesValue = products.reduce((s, p) => s + p.stock * p.salesPrice, 0)

  const cities = Array.from(new Set(products.map(p => p.city).filter(Boolean) as string[])).sort()
  const showCityHeaders = cities.length > 1
  const groupedForRender = showCityHeaders
    ? cities.map(city => ({ city, items: products.filter(p => p.city === city) })).filter(g => g.items.length > 0)
    : [{ city: '', items: products }]

  const filteredMovements = movements.filter(m => {
    const matchType = !logTypeFilter || m.type === logTypeFilter
    const matchSearch = !logSearch ||
      m.product.name.toLowerCase().includes(logSearch.toLowerCase()) ||
      m.product.sku.toLowerCase().includes(logSearch.toLowerCase()) ||
      (m.supplier || '').toLowerCase().includes(logSearch.toLowerCase()) ||
      (m.reference || '').toLowerCase().includes(logSearch.toLowerCase()) ||
      (m.note || '').toLowerCase().includes(logSearch.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Raktár & Termékek</h1>
          <p className="text-xs md:text-sm text-gray-400 mt-0.5">{products.length} termék · €{totalStockValue.toFixed(0)} készletérték</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCarrierSettings(true)}
            className="flex items-center gap-1.5 p-2 md:px-3 md:py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm">
            <Settings size={15} />
            <span className="hidden md:inline">Hordozók</span>
          </button>
          <button onClick={() => { setEditProduct(null); setShowModal(true) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium">
            <Plus size={15} />
            <span className="hidden sm:inline">Új termék</span>
          </button>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1 leading-tight">Önköltségi érték</p>
          <p className="text-base md:text-xl font-bold text-gray-900">€{totalStockValue.toFixed(0)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100 shadow-sm p-3 md:p-4">
          <p className="text-xs text-green-600 mb-1 leading-tight">Eladási érték</p>
          <p className="text-base md:text-xl font-bold text-green-700">€{totalSalesValue.toFixed(0)}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-3 md:p-4 ${lowStock.length > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
          <p className={`text-xs mb-1 leading-tight ${lowStock.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>Alacsony készlet</p>
          <p className={`text-base md:text-xl font-bold ${lowStock.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{lowStock.length} db</p>
        </div>
      </div>

      {/* ── ALACSONY KÉSZLET FIGYELMEZTETÉS ── */}
      {lowStock.length > 0 && (
        <div className="mb-4">
          <button onClick={() => setLowStockOpen(o => !o)}
            className="w-full flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3 hover:bg-red-100 transition-colors">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <span className="text-sm font-semibold text-red-700">{lowStock.length} termék utánrendelést igényel</span>
            </div>
            {lowStockOpen ? <ChevronUp size={14} className="text-red-400" /> : <ChevronDown size={14} className="text-red-400" />}
          </button>
          {lowStockOpen && (
            <div className="bg-red-50 border border-t-0 border-red-200 rounded-b-xl px-4 pb-3 pt-2 flex flex-wrap gap-2">
              {lowStock.map(p => (
                <span key={p.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                  {p.sku}: {p.stock} db (min: {p.minStock})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TABOK ── */}
      <div className="flex border-b border-gray-200 mb-4">
        {([['products', 'Termékek'], ['log', 'Mozgásnapló']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════ TERMÉKEK TAB ═══════════════ */}
      {tab === 'products' && (
        <>
          {/* Szűrők */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input type="text" placeholder="Termék neve, SKU, helyszín..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)}
                className="flex-1 sm:flex-none px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Minden hordozó</option>
                {Array.from(new Set(carriers.map(c => c.group).filter(Boolean))).map(group => (
                  <optgroup key={group!} label={group!}>
                    {carriers.filter(c => c.group === group).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
                {carriers.filter(c => !c.group).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {Array.from(new Set(products.map(p => p.locationCabinet).filter(Boolean))).length > 0 && (
                <select value={cabinetFilter} onChange={e => setCabinetFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Minden szekrény</option>
                  {Array.from(new Set(products.map(p => p.locationCabinet).filter(Boolean) as string[])).sort().map(cab => (
                    <option key={cab} value={cab}>{cab}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {loadingProducts ? (
            <div className="py-12 text-center text-gray-400 text-sm">Betöltés...</div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">Nem található termék</div>
          ) : (
            <>
              {/* ─── DESKTOP TÁBLA ─── */}
              <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Termék', 'Helyszín', 'Anyag / Típus', 'Önköltség', 'Eladási ár', 'Készlet', ''].map((h, i) => (
                        <th key={i} className={`px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${i >= 3 ? 'text-right' : 'text-left'} ${i === 6 ? 'w-28' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {groupedForRender.map(({ city, items: groupItems }) => (
                      <React.Fragment key={city || '__all__'}>
                        {showCityHeaders && city && (() => {
                          const isOpen = expandedCities.has(city)
                          return (
                            <tr>
                              <td colSpan={7} className="border-b border-gray-100">
                                <button onClick={() => toggleCity(city)}
                                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors group">
                                  <div className="flex items-center gap-3">
                                    <span className="text-base font-bold text-gray-800">{city}</span>
                                    <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{groupItems.length} termék</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-gray-400">
                                    <span className="text-xs">{isOpen ? 'összecsuk' : 'megnyit'}</span>
                                    {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                  </div>
                                </button>
                              </td>
                            </tr>
                          )
                        })()}
                        {(!showCityHeaders || expandedCities.has(city)) && groupItems.map((product) => {
                          const carrierInfo = carriers.find(c => c.id === product.material) ?? carriers.find(c => c.code === product.material)
                          const badgeColor = carrierInfo?.group ? (GROUP_COLORS[carrierInfo.group] ?? DEFAULT_BADGE) : DEFAULT_BADGE
                          const isLow = product.stock <= product.minStock
                          const margin = product.salesPrice > 0 ? ((product.salesPrice - product.costPrice) / product.salesPrice * 100).toFixed(0) : '0'
                          const isExpanded = expandedProductId === product.id
                          return (
                            <React.Fragment key={product.id}>
                              <tr className="hover:bg-gray-50/80 transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    {product.imageUrl ? (
                                      <button onClick={() => setLightboxUrl(product.imageUrl)} className="w-10 h-10 rounded-xl overflow-hidden border border-gray-100 shrink-0 hover:ring-2 hover:ring-blue-400">
                                        <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="object-cover w-full h-full" />
                                      </button>
                                    ) : (
                                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                                        <Package size={16} className="text-blue-400" />
                                      </div>
                                    )}
                                    <div>
                                      <button onClick={() => openProductDetail(product)} className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition-colors text-left">{product.name}</button>
                                      {product.nameDE && <p className="text-xs text-blue-500 italic">{product.nameDE}</p>}
                                      <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
                                      {(product.locationCabinet || product.locationShelf) && (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1 inline-block">
                                          📦 {[product.locationCabinet, product.locationShelf && `P${product.locationShelf}`, product.locationBox].filter(Boolean).join(' · ')}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-600">
                                  {product.site || '–'}
                                  {product.city && <p className="text-xs text-gray-400">{product.city}</p>}
                                </td>
                                <td className="px-5 py-3.5">
                                  {carrierInfo
                                    ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>{carrierInfo.name}</span>
                                    : <span className="text-xs text-gray-400">{product.material || '–'}</span>}
                                </td>
                                <td className="px-5 py-3.5 text-right text-sm text-gray-600">€{product.costPrice.toFixed(2)}</td>
                                <td className="px-5 py-3.5 text-right">
                                  <p className="text-sm font-semibold text-gray-900">€{product.salesPrice.toFixed(2)}</p>
                                  <p className="text-xs text-green-600">{margin}% marge</p>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <p className={`text-sm font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{product.stock} {product.unit}</p>
                                  {isLow && <p className="text-xs text-red-400">min: {product.minStock}</p>}
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button onClick={() => toggleProductHistory(product.id)} title="Mozgástörténet"
                                      className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-50'}`}>
                                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                    <button onClick={() => { setStockProduct(product); setShowStockModal(true) }} title="Készletmozgás"
                                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                                      <ArrowUpDown size={14} />
                                    </button>
                                    <button onClick={() => { setEditProduct(product); setShowModal(true) }}
                                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                      <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(product.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={7} className="px-5 py-3 bg-blue-50/60 border-t border-blue-100">
                                    <p className="text-xs font-semibold text-blue-700 mb-2">Mozgástörténet – {product.name}</p>
                                    {loadingProductMovements ? (
                                      <p className="text-xs text-gray-400">Betöltés...</p>
                                    ) : productMovements.length === 0 ? (
                                      <p className="text-xs text-gray-400">Nincs rögzített mozgás.</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {productMovements.map(m => {
                                          const cfg = MOVEMENT_CONFIG[m.type as keyof typeof MOVEMENT_CONFIG] || MOVEMENT_CONFIG.adjustment
                                          const Icon = cfg.icon
                                          return (
                                            <div key={m.id} className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                                              <span className="text-gray-400 w-32 shrink-0">{format(new Date(m.createdAt), 'yyyy.MM.dd HH:mm')}</span>
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${cfg.color}`}><Icon size={10} />{cfg.label}</span>
                                              <span className="font-semibold">{m.type === 'in' ? '+' : m.type === 'out' || m.type === 'sale' ? '−' : '±'}{m.quantity} db</span>
                                              {m.supplier && <span className="text-blue-600">📦 {m.supplier}</span>}
                                              {m.reference && <span className="font-mono text-gray-500">#{m.reference}</span>}
                                              {m.note && <span className="text-gray-400 italic">{m.note}</span>}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ─── MOBIL KÁRTYÁK ─── */}
              <div className="md:hidden space-y-3">
                {groupedForRender.map(({ city, items: groupItems }) => (
                  <React.Fragment key={city || '__all__'}>
                    {showCityHeaders && city && (
                      <button onClick={() => toggleCity(city)}
                        className="w-full flex items-center justify-between bg-gray-100 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-700">{city}</span>
                          <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">{groupItems.length} db</span>
                        </div>
                        {expandedCities.has(city) ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </button>
                    )}
                    {(!showCityHeaders || expandedCities.has(city)) && groupItems.map((product) => {
                      const carrierInfo = carriers.find(c => c.id === product.material) ?? carriers.find(c => c.code === product.material)
                      const badgeColor = carrierInfo?.group ? (GROUP_COLORS[carrierInfo.group] ?? DEFAULT_BADGE) : DEFAULT_BADGE
                      const isLow = product.stock <= product.minStock
                      const margin = product.salesPrice > 0 ? ((product.salesPrice - product.costPrice) / product.salesPrice * 100).toFixed(0) : '0'
                      const isExpanded = expandedProductId === product.id

                      return (
                        <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                          <div className="p-3.5">
                            <div className="flex items-start gap-3">
                              {/* Kép / icon */}
                              {product.imageUrl ? (
                                <button onClick={() => setLightboxUrl(product.imageUrl)} className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 shrink-0">
                                  <Image src={product.imageUrl} alt={product.name} width={48} height={48} className="object-cover w-full h-full" />
                                </button>
                              ) : (
                                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                                  <Package size={20} className="text-blue-300" />
                                </div>
                              )}

                              {/* Bal info */}
                              <div className="flex-1 min-w-0">
                                <button onClick={() => openProductDetail(product)} className="font-semibold text-gray-900 text-sm hover:text-blue-600 leading-snug text-left">{product.name}</button>
                                {product.nameDE && <p className="text-xs text-blue-500 italic">{product.nameDE}</p>}
                                <p className="text-xs text-gray-400 font-mono mt-0.5">{product.sku}</p>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {carrierInfo && <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${badgeColor}`}>{carrierInfo.name}</span>}
                                  {(product.locationCabinet || product.locationShelf) && (
                                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                      📦 {[product.locationCabinet, product.locationShelf && `P${product.locationShelf}`, product.locationBox].filter(Boolean).join('·')}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Jobb: készlet */}
                              <div className={`text-right shrink-0 rounded-xl px-3 py-2 ${isLow ? 'bg-red-50' : 'bg-gray-50'}`}>
                                <p className={`text-xl font-black leading-none ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{product.stock}</p>
                                <p className={`text-xs mt-0.5 ${isLow ? 'text-red-400' : 'text-gray-400'}`}>{product.unit}</p>
                                {isLow && <p className="text-xs text-red-400">min {product.minStock}</p>}
                              </div>
                            </div>

                            {/* Árak */}
                            <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-gray-50 text-xs text-gray-500">
                              <span>Önk.: <span className="font-medium text-gray-700">€{product.costPrice.toFixed(2)}</span></span>
                              <span>Elad.: <span className="font-semibold text-green-700">€{product.salesPrice.toFixed(2)}</span></span>
                              <span className="ml-auto text-green-600 font-medium">{margin}% marge</span>
                            </div>
                          </div>

                          {/* Akció sáv */}
                          <div className="flex border-t border-gray-100">
                            <button onClick={() => toggleProductHistory(product.id)}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${isExpanded ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              Napló
                            </button>
                            <button onClick={() => { setStockProduct(product); setShowStockModal(true) }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-500 hover:bg-green-50 hover:text-green-700 transition-colors border-l border-gray-100">
                              <ArrowUpDown size={13} /> Mozgás
                            </button>
                            <button onClick={() => { setEditProduct(product); setShowModal(true) }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-500 hover:bg-blue-50 hover:text-blue-700 transition-colors border-l border-gray-100">
                              <Edit2 size={13} /> Szerk.
                            </button>
                            <button onClick={() => handleDelete(product.id)}
                              className="px-4 flex items-center justify-center py-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-gray-100">
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Mozgástörténet (mobil) */}
                          {isExpanded && (
                            <div className="border-t border-blue-100 bg-blue-50/50 px-3.5 py-3">
                              <p className="text-xs font-semibold text-blue-700 mb-2">Mozgástörténet</p>
                              {loadingProductMovements ? (
                                <p className="text-xs text-gray-400">Betöltés...</p>
                              ) : productMovements.length === 0 ? (
                                <p className="text-xs text-gray-400">Nincs rögzített mozgás.</p>
                              ) : (
                                <div className="space-y-2">
                                  {productMovements.map(m => {
                                    const cfg = MOVEMENT_CONFIG[m.type as keyof typeof MOVEMENT_CONFIG] || MOVEMENT_CONFIG.adjustment
                                    const Icon = cfg.icon
                                    return (
                                      <div key={m.id} className="flex items-start gap-2 text-xs">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.color}`}><Icon size={9} />{cfg.label}</span>
                                        <div className="flex-1 min-w-0">
                                          <span className="font-semibold">{m.type === 'in' ? '+' : m.type === 'out' || m.type === 'sale' ? '−' : '±'}{m.quantity} db</span>
                                          {m.supplier && <span className="text-blue-600 ml-1">{m.supplier}</span>}
                                          {m.note && <p className="text-gray-400 italic truncate">{m.note}</p>}
                                        </div>
                                        <span className="text-gray-400 shrink-0">{format(new Date(m.createdAt), 'MM.dd HH:mm')}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════ MOZGÁSNAPLÓ TAB ═══════════════ */}
      {tab === 'log' && (
        <>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input type="text" placeholder="Termék, SKU, szállító, referencia..." value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {([['', 'Mind'], ['in', 'Bevét.'], ['out', 'Kiadás'], ['adjustment', 'Korr.']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setLogTypeFilter(val)}
                  className={`px-3 py-2 text-xs md:text-sm font-medium transition-colors ${logTypeFilter === val ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loadingMovements ? (
            <div className="py-12 text-center text-gray-400 text-sm">Betöltés...</div>
          ) : filteredMovements.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">Nem található mozgás</div>
          ) : (
            <>
              {/* Desktop tábla */}
              <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Dátum', 'Termék', 'Típus', 'Mennyiség', 'Szállító / Ref.', 'Megjegyzés'].map((h, i) => (
                        <th key={i} className={`px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredMovements.map(m => {
                      const cfg = MOVEMENT_CONFIG[m.type as keyof typeof MOVEMENT_CONFIG] || MOVEMENT_CONFIG.adjustment
                      const Icon = cfg.icon
                      const isIn = m.type === 'in'
                      const isOut = m.type === 'out' || m.type === 'sale'
                      return (
                        <tr key={m.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                            {format(new Date(m.createdAt), 'yyyy.MM.dd')}
                            <p className="text-xs text-gray-400">{format(new Date(m.createdAt), 'HH:mm')}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-medium text-gray-900">{m.product.name}</p>
                            {m.product.nameDE && <p className="text-xs text-blue-500 italic">{m.product.nameDE}</p>}
                            <p className="text-xs text-gray-400 font-mono">{m.product.sku}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                              <Icon size={10} />{cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`text-sm font-bold ${isIn ? 'text-green-600' : isOut ? 'text-red-600' : 'text-amber-600'}`}>
                              {isIn ? '+' : isOut ? '−' : '±'}{m.quantity} db
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {m.supplier && <p className="text-sm text-gray-700">{m.supplier}</p>}
                            {m.reference && <p className="text-xs font-mono text-gray-500">#{m.reference}</p>}
                            {!m.supplier && !m.reference && <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-400 italic">{m.note || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                  {filteredMovements.length} mozgás
                </div>
              </div>

              {/* Mobil kártyák */}
              <div className="md:hidden space-y-2">
                {filteredMovements.map(m => {
                  const cfg = MOVEMENT_CONFIG[m.type as keyof typeof MOVEMENT_CONFIG] || MOVEMENT_CONFIG.adjustment
                  const Icon = cfg.icon
                  const isIn = m.type === 'in'
                  const isOut = m.type === 'out' || m.type === 'sale'
                  return (
                    <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex">
                      <div className={`w-1 shrink-0 ${isIn ? 'bg-green-400' : isOut ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <div className="flex-1 px-3.5 py-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{m.product.name}</p>
                            {m.product.nameDE && <p className="text-xs text-blue-500 italic">{m.product.nameDE}</p>}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-xs text-gray-400">{format(new Date(m.createdAt), 'yyyy. MMM d. HH:mm', { locale: hu })}</span>
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${cfg.color}`}><Icon size={9} />{cfg.label}</span>
                            </div>
                            {(m.supplier || m.reference) && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {m.supplier && <span>📦 {m.supplier} </span>}
                                {m.reference && <span className="font-mono">#{m.reference}</span>}
                              </p>
                            )}
                            {m.note && <p className="text-xs text-gray-400 italic mt-0.5 truncate">{m.note}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-lg font-black leading-none ${isIn ? 'text-green-600' : isOut ? 'text-red-500' : 'text-amber-500'}`}>
                              {isIn ? '+' : isOut ? '−' : '±'}{m.quantity}
                            </p>
                            <p className="text-xs text-gray-400">db</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <p className="text-center text-xs text-gray-400 py-2">{filteredMovements.length} mozgás</p>
              </div>
            </>
          )}
        </>
      )}

      {/* ── MODÁLOK ── */}
      {showCarrierSettings && (
        <Modal title="Hordozó beállítások" onClose={() => { setShowCarrierSettings(false); fetchCarriers() }} size="xl">
          <CarrierSettingsModal onClose={() => { setShowCarrierSettings(false); fetchCarriers() }} />
        </Modal>
      )}
      {showModal && (
        <Modal title={editProduct ? 'Termék szerkesztése' : 'Új termék'} onClose={() => setShowModal(false)} size="lg">
          <ProductForm key={editProduct?.id || 'new'} product={editProduct} onSave={() => { setShowModal(false); fetchProducts() }} onCancel={() => setShowModal(false)} />
        </Modal>
      )}
      {showStockModal && stockProduct && (
        <Modal title="Készletmozgás rögzítése" onClose={() => setShowStockModal(false)}>
          <StockMovementForm product={stockProduct} onSave={() => { setShowStockModal(false); fetchProducts() }} onCancel={() => setShowStockModal(false)} />
        </Modal>
      )}
      {detailProduct && (
        <Modal title={detailProduct.name} onClose={() => { setDetailProduct(null); setProductStats(null) }} size="lg">
          <div className="space-y-5">
            <div className="flex gap-4">
              {detailProduct.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detailProduct.imageUrl} alt={detailProduct.name} className="w-28 h-28 object-cover rounded-xl border border-gray-100 shrink-0" />
              ) : (
                <div className="w-28 h-28 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Package size={36} className="text-blue-200" />
                </div>
              )}
              <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                {detailProduct.nameDE && <div><p className="text-xs text-gray-400">Német név</p><p className="font-medium">{detailProduct.nameDE}</p></div>}
                <div><p className="text-xs text-gray-400">SKU</p><p className="font-mono font-semibold">{detailProduct.sku}</p></div>
                <div><p className="text-xs text-gray-400">Eladási ár</p><p className="font-bold text-green-700">€{detailProduct.salesPrice.toFixed(2)}</p></div>
                <div><p className="text-xs text-gray-400">Önköltség</p><p className="font-medium">€{detailProduct.costPrice.toFixed(2)}</p></div>
                {(detailProduct.locationCabinet || detailProduct.locationShelf) && (
                  <div className="col-span-2"><p className="text-xs text-gray-400">Raktárhely</p><p className="font-mono font-bold text-amber-700">{[detailProduct.locationCabinet, detailProduct.locationShelf, detailProduct.locationBox].filter(Boolean).join(' / ')}</p></div>
                )}
                {detailProduct.site && <div className="col-span-2"><p className="text-xs text-gray-400">Helyszín</p><p>{detailProduct.site}{detailProduct.city ? ` · ${detailProduct.city}` : ''}</p></div>}
              </div>
            </div>
            <div className={`rounded-xl p-4 flex items-center gap-4 ${detailProduct.stock <= detailProduct.minStock ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="text-center">
                <p className="text-3xl font-black text-gray-900">{detailProduct.stock}</p>
                <p className="text-xs text-gray-500">{detailProduct.unit} raktáron</p>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <div className="text-sm text-gray-600">
                <p>Minimum: <span className="font-semibold">{detailProduct.minStock} {detailProduct.unit}</span></p>
                {detailProduct.stock <= detailProduct.minStock && <p className="text-red-600 font-semibold mt-0.5">⚠️ Utánrendelés szükséges!</p>}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Eladások évente</p>
              {loadingStats ? <p className="text-sm text-gray-400">Betöltés...</p> : productStats ? (
                <div className="grid grid-cols-3 gap-3">
                  {[productStats.twoYearsAgo, productStats.lastYear, productStats.thisYear].map(stat => (
                    <div key={stat.year} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">{stat.year}</p>
                      <p className="text-xl font-bold text-gray-900">{stat.quantity} db</p>
                      <p className="text-xs text-green-600 font-medium">€{stat.revenue.toFixed(0)}</p>
                      <p className="text-xs text-gray-400">{stat.orderCount} rend.</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <button onClick={() => { setStockProduct(detailProduct); setShowStockModal(true); setDetailProduct(null) }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm">
                <ArrowUpDown size={14} /> Készletmozgás
              </button>
              <button onClick={() => { setEditProduct(detailProduct); setShowModal(true); setDetailProduct(null) }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm">
                <Edit2 size={14} /> Szerkesztés
              </button>
            </div>
          </div>
        </Modal>
      )}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300" onClick={() => setLightboxUrl(null)}>
            <X size={28} />
          </button>
          <div className="relative max-w-2xl max-h-[80vh] w-full" onClick={e => e.stopPropagation()}>
            <Image src={lightboxUrl} alt="Termékfotó" width={800} height={800} className="object-contain w-full h-full max-h-[80vh] rounded-xl" />
          </div>
        </div>
      )}
    </div>
  )
}
