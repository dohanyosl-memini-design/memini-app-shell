'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, ArrowUpDown, X, ArrowDown, ArrowUp, RefreshCw, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import Modal from '@/components/Modal'
import ProductForm from '@/components/ProductForm'
import StockMovementForm from '@/components/StockMovementForm'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface Product {
  id: string
  name: string
  nameDE: string | null
  sku: string
  description: string | null
  material: string | null
  productType: string | null
  site: string | null
  city: string | null
  locationCabinet: string | null
  locationShelf: string | null
  locationBox: string | null
  costPrice: number
  salesPrice: number
  stock: number
  minStock: number
  unit: string
  vatRate: number
  imageUrl: string | null
  priceListEntryId: string | null
}

interface StockMovement {
  id: string
  type: string
  quantity: number
  note: string | null
  supplier: string | null
  reference: string | null
  createdAt: string
  product: { id: string; name: string; sku: string; nameDE: string | null }
}

const HORDOZO_CONFIG: Record<string, { label: string; color: string }> = {
  ko_grafitoptik_normal: { label: 'Kő GO normál',      color: 'bg-stone-100 text-stone-700' },
  ko_grafitoptik_nagy:   { label: 'Kő GO nagy',        color: 'bg-stone-100 text-stone-700' },
  ko_aquarel_normal:     { label: 'Kő Aq. normál',     color: 'bg-teal-100 text-teal-700' },
  ko_aquarel_nagy:       { label: 'Kő Aq. nagy',       color: 'bg-teal-100 text-teal-700' },
  belyeg_1_normal:       { label: 'Bélyeg 1r. normál', color: 'bg-blue-100 text-blue-700' },
  belyeg_1_kicsi:        { label: 'Bélyeg 1r. kicsi',  color: 'bg-blue-100 text-blue-700' },
  belyeg_2:              { label: 'Bélyeg kétrétegű',  color: 'bg-indigo-100 text-indigo-700' },
  faszelet_go:           { label: 'Faszelet GO',       color: 'bg-amber-100 text-amber-700' },
  fa_nagybetus:          { label: 'Fa Nagybetűs',      color: 'bg-amber-100 text-amber-700' },
  templomablak_kicsi:    { label: 'Templomablak K.',   color: 'bg-purple-100 text-purple-700' },
  templomablak_nagy:     { label: 'Templomablak N.',   color: 'bg-purple-100 text-purple-700' },
}

const MOVEMENT_CONFIG = {
  in:         { label: 'Bevételezés', color: 'bg-green-100 text-green-700',  icon: ArrowDown  },
  out:        { label: 'Kiadás',      color: 'bg-red-100 text-red-700',      icon: ArrowUp    },
  adjustment: { label: 'Korrekció',   color: 'bg-amber-100 text-amber-700',  icon: RefreshCw  },
  sale:       { label: 'Eladás',      color: 'bg-orange-100 text-orange-700',icon: FileText   },
}

export default function WarehousePage() {
  const [tab, setTab] = useState<'products' | 'log'>('products')

  // Products state
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [search, setSearch] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')
  const [cabinetFilter, setCabinetFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  const [productMovements, setProductMovements] = useState<StockMovement[]>([])
  const [loadingProductMovements, setLoadingProductMovements] = useState(false)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [productStats, setProductStats] = useState<null | { thisYear: { year: number; quantity: number; revenue: number; orderCount: number }; lastYear: { year: number; quantity: number; revenue: number; orderCount: number }; twoYearsAgo: { year: number; quantity: number; revenue: number; orderCount: number } }>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Movement log state
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [logSearch, setLogSearch] = useState('')
  const [logTypeFilter, setLogTypeFilter] = useState('')

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
    const data = await res.json()
    setMovements(data)
    setLoadingMovements(false)
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])
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
    if (expandedProductId === productId) {
      setExpandedProductId(null)
      return
    }
    setExpandedProductId(productId)
    setLoadingProductMovements(true)
    const res = await fetch(`/api/stock?productId=${productId}`)
    const data = await res.json()
    setProductMovements(data)
    setLoadingProductMovements(false)
  }

  const lowStock = products.filter((p) => p.stock <= p.minStock)
  const totalStockValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0)
  const totalSalesValue = products.reduce((sum, p) => sum + p.stock * p.salesPrice, 0)

  const filteredMovements = movements.filter((m) => {
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
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raktár & Termékek</h1>
          <p className="text-gray-500 mt-1">{products.length} aktív termék · Készletérték: €{totalStockValue.toFixed(0)}</p>
        </div>
        <button
          onClick={() => { setEditProduct(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Új termék
        </button>
      </div>

      {/* KPI sáv */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Készlet önköltségi értéke</p>
          <p className="text-xl font-bold text-gray-900 mt-1">€{totalStockValue.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Készlet eladási értéke</p>
          <p className="text-xl font-bold text-green-600 mt-1">€{totalSalesValue.toFixed(2)}</p>
        </div>
        <div className={`rounded-xl border p-4 shadow-sm ${lowStock.length > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
          <p className="text-sm text-gray-500">Alacsony készlet figyelmeztetés</p>
          <p className={`text-xl font-bold mt-1 ${lowStock.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {lowStock.length} termék
          </p>
        </div>
      </div>

      {/* Alacsony készlet figyelmeztetés */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-600" />
            <p className="text-sm font-semibold text-red-700">Alacsony készlet – rendelj utána!</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <span key={p.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                {p.sku}: {p.stock} db (min: {p.minStock})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabok */}
      <div className="flex border-b border-gray-200 mb-4">
        {([['products', 'Termékek'], ['log', 'Mozgásnapló']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── TERMÉKEK TAB ─── */}
      {tab === 'products' && (
        <>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Termék neve, SKU, helyszín..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Minden hordozó</option>
              <option value="ko">Kő</option>
              <option value="belyeg">Bélyeg</option>
              <option value="fa">Fa / Faszelet</option>
              <option value="templomablak">Templomablak</option>
            </select>
            {/* Szekrény szűrő — dinamikusan a meglévő értékekből */}
            {Array.from(new Set(products.map(p => p.locationCabinet).filter(Boolean))).length > 0 && (
              <select
                value={cabinetFilter}
                onChange={(e) => setCabinetFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Minden szekrény</option>
                {Array.from(new Set(products.map(p => p.locationCabinet).filter(Boolean) as string[])).sort().map(cab => (
                  <option key={cab} value={cab}>{cab}</option>
                ))}
              </select>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Termék</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Helyszín</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Anyag / Típus</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Önköltség</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Eladási ár</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Készlet</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loadingProducts ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Betöltés...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Nem található termék</td></tr>
                ) : products.map((product) => {
                  const hordozo = HORDOZO_CONFIG[product.material || '']
                  const isLow = product.stock <= product.minStock
                  const margin = product.salesPrice > 0
                    ? ((product.salesPrice - product.costPrice) / product.salesPrice * 100).toFixed(0)
                    : '0'
                  const isExpanded = expandedProductId === product.id

                  return (
                    <>
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {product.imageUrl ? (
                              <button
                                onClick={() => setLightboxUrl(product.imageUrl)}
                                className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 shrink-0 hover:ring-2 hover:ring-blue-400 transition-all"
                              >
                                <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="object-cover w-full h-full" />
                              </button>
                            ) : (
                              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                                <Package size={16} className="text-blue-400" />
                              </div>
                            )}
                            <div>
                              <button onClick={() => openProductDetail(product)} className="font-medium text-gray-900 text-sm hover:text-blue-600 hover:underline text-left transition-colors">{product.name}</button>
                              {product.nameDE && <p className="text-xs text-blue-600 italic">{product.nameDE}</p>}
                              <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
                              {(product.locationCabinet || product.locationShelf || product.locationBox) && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1 inline-block font-medium">
                                  📦 {[product.locationCabinet, product.locationShelf && `P${product.locationShelf}`, product.locationBox].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm text-gray-700">{product.site || '-'}</p>
                          {product.city && <p className="text-xs text-gray-400">{product.city}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          {hordozo
                            ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${hordozo.color}`}>{hordozo.label}</span>
                            : <span className="text-xs text-gray-400">{product.material || '–'}</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm text-gray-600">€{product.costPrice.toFixed(2)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <p className="text-sm font-medium text-gray-900">€{product.salesPrice.toFixed(2)}</p>
                          <p className="text-xs text-green-600">{margin}% marge</p>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <p className={`text-sm font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                            {product.stock} {product.unit}
                          </p>
                          {isLow && <p className="text-xs text-red-500">Min: {product.minStock}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleProductHistory(product.id)}
                              title="Mozgástörténet"
                              className={`transition-colors ${isExpanded ? 'text-blue-600' : 'text-gray-400 hover:text-blue-500'}`}
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                            <button
                              onClick={() => { setStockProduct(product); setShowStockModal(true) }}
                              title="Készletmozgás rögzítése"
                              className="text-gray-400 hover:text-green-600 transition-colors"
                            >
                              <ArrowUpDown size={15} />
                            </button>
                            <button
                              onClick={() => { setEditProduct(product); setShowModal(true) }}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${product.id}-history`}>
                          <td colSpan={7} className="px-5 py-3 bg-blue-50 border-t border-blue-100">
                            <p className="text-xs font-semibold text-blue-700 mb-2">Mozgástörténet – {product.name}</p>
                            {loadingProductMovements ? (
                              <p className="text-xs text-gray-400">Betöltés...</p>
                            ) : productMovements.length === 0 ? (
                              <p className="text-xs text-gray-400">Nincs rögzített mozgás.</p>
                            ) : (
                              <div className="space-y-1">
                                {productMovements.map((m) => {
                                  const cfg = MOVEMENT_CONFIG[m.type as keyof typeof MOVEMENT_CONFIG] || MOVEMENT_CONFIG.adjustment
                                  const Icon = cfg.icon
                                  return (
                                    <div key={m.id} className="flex items-center gap-3 text-xs text-gray-600">
                                      <span className="text-gray-400 w-32 shrink-0">{format(new Date(m.createdAt), 'yyyy.MM.dd HH:mm')}</span>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                                        <Icon size={10} />{cfg.label}
                                      </span>
                                      <span className="font-semibold w-16 shrink-0">
                                        {m.type === 'in' ? '+' : m.type === 'out' || m.type === 'sale' ? '−' : '±'}{m.quantity} db
                                      </span>
                                      {m.supplier && <span className="text-blue-600">📦 {m.supplier}</span>}
                                      {m.reference && <span className="text-gray-500 font-mono">#{m.reference}</span>}
                                      {m.note && <span className="text-gray-400 italic">{m.note}</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── MOZGÁSNAPLÓ TAB ─── */}
      {tab === 'log' && (
        <>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Termék neve, SKU, szállító, referencia..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
              {([['', 'Mind'], ['in', 'Bevételezés'], ['out', 'Kiadás'], ['adjustment', 'Korrekció']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setLogTypeFilter(val)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${logTypeFilter === val ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Dátum</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Termék</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Típus</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Mennyiség</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Szállító / Ref.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Megjegyzés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loadingMovements ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">Betöltés...</td></tr>
                ) : filteredMovements.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">Nem található mozgás</td></tr>
                ) : filteredMovements.map((m) => {
                  const cfg = MOVEMENT_CONFIG[m.type as keyof typeof MOVEMENT_CONFIG] || MOVEMENT_CONFIG.adjustment
                  const Icon = cfg.icon
                  const isIn = m.type === 'in'
                  const isOut = m.type === 'out' || m.type === 'sale'
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                        {format(new Date(m.createdAt), 'yyyy.MM.dd')}
                        <p className="text-xs text-gray-400">{format(new Date(m.createdAt), 'HH:mm')}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-gray-900">{m.product.name}</p>
                        {m.product.nameDE && <p className="text-xs text-blue-600 italic">{m.product.nameDE}</p>}
                        <p className="text-xs text-gray-400 font-mono">{m.product.sku}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                          <Icon size={11} />{cfg.label}
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
                      <td className="px-5 py-3.5 text-sm text-gray-500 italic">
                        {m.note || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredMovements.length > 0 && (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                {filteredMovements.length} mozgás megjelenítve
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <Modal title={editProduct ? 'Termék szerkesztése' : 'Új termék'} onClose={() => setShowModal(false)} size="lg">
          <ProductForm product={editProduct} onSave={() => { setShowModal(false); fetchProducts() }} onCancel={() => setShowModal(false)} />
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
                <img src={detailProduct.imageUrl} alt={detailProduct.name} className="w-32 h-32 object-cover rounded-xl border border-gray-100 shrink-0" />
              ) : (
                <div className="w-32 h-32 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Package size={40} className="text-blue-200" />
                </div>
              )}
              <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                {detailProduct.nameDE && <div><p className="text-xs text-gray-400">Német név</p><p className="font-medium">{detailProduct.nameDE}</p></div>}
                <div><p className="text-xs text-gray-400">SKU</p><p className="font-mono font-medium">{detailProduct.sku}</p></div>
                <div><p className="text-xs text-gray-400">Egységár (eladási)</p><p className="font-bold text-green-700">€{detailProduct.salesPrice.toFixed(2)}</p></div>
                <div><p className="text-xs text-gray-400">Önköltség</p><p className="font-medium">€{detailProduct.costPrice.toFixed(2)}</p></div>
                {(detailProduct.locationCabinet || detailProduct.locationShelf) && (
                  <div><p className="text-xs text-gray-400">Raktárhely</p><p className="font-mono font-bold text-amber-700">{[detailProduct.locationCabinet, detailProduct.locationShelf, detailProduct.locationBox].filter(Boolean).join(' / ')}</p></div>
                )}
                {detailProduct.site && <div><p className="text-xs text-gray-400">Helyszín</p><p>{detailProduct.site}{detailProduct.city ? ` · ${detailProduct.city}` : ''}</p></div>}
              </div>
            </div>

            {/* Készlet */}
            <div className={`rounded-xl p-4 flex items-center gap-4 ${detailProduct.stock <= detailProduct.minStock ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="text-center">
                <p className="text-3xl font-black text-gray-900">{detailProduct.stock}</p>
                <p className="text-xs text-gray-500">{detailProduct.unit} raktáron</p>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <div className="text-sm text-gray-600">
                <p>Minimum készlet: <span className="font-semibold">{detailProduct.minStock} {detailProduct.unit}</span></p>
                {detailProduct.stock <= detailProduct.minStock && <p className="text-red-600 font-semibold mt-0.5">⚠️ Utánrendelés szükséges!</p>}
              </div>
            </div>

            {/* Eladási statisztikák */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Eladások évente</p>
              {loadingStats ? (
                <p className="text-sm text-gray-400">Betöltés...</p>
              ) : productStats ? (
                <div className="grid grid-cols-3 gap-3">
                  {[productStats.twoYearsAgo, productStats.lastYear, productStats.thisYear].map(stat => (
                    <div key={stat.year} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">{stat.year}</p>
                      <p className="text-xl font-bold text-gray-900">{stat.quantity} db</p>
                      <p className="text-xs text-green-600 font-medium">€{stat.revenue.toFixed(0)}</p>
                      <p className="text-xs text-gray-400">{stat.orderCount} megrendelés</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex justify-between pt-2 border-t border-gray-100">
              <button
                onClick={() => { setStockProduct(detailProduct); setShowStockModal(true); setDetailProduct(null) }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                <ArrowUpDown size={14} /> Készletmozgás
              </button>
              <button
                onClick={() => { setEditProduct(detailProduct); setShowModal(true); setDetailProduct(null) }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Edit2 size={14} /> Szerkesztés
              </button>
            </div>
          </div>
        </Modal>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors" onClick={() => setLightboxUrl(null)}>
            <X size={28} />
          </button>
          <div className="relative max-w-2xl max-h-[80vh] w-full" onClick={(e) => e.stopPropagation()}>
            <Image src={lightboxUrl} alt="Termékfotó" width={800} height={800} className="object-contain w-full h-full max-h-[80vh] rounded-lg" />
          </div>
        </div>
      )}
    </div>
  )
}
