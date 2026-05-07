'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, ArrowUpDown, X } from 'lucide-react'
import Image from 'next/image'
import Modal from '@/components/Modal'
import ProductForm from '@/components/ProductForm'
import StockMovementForm from '@/components/StockMovementForm'

interface Product {
  id: string
  name: string
  sku: string
  description: string | null
  material: string | null
  productType: string | null
  site: string | null
  city: string | null
  costPrice: number
  salesPrice: number
  stock: number
  minStock: number
  unit: string
  vatRate: number
  imageUrl: string | null
}

const HORDOZO_CONFIG: Record<string, { label: string; color: string }> = {
  ko_grafitoptik_normal: { label: 'Kő GO normál',     color: 'bg-stone-100 text-stone-700' },
  ko_grafitoptik_nagy:   { label: 'Kő GO nagy',       color: 'bg-stone-100 text-stone-700' },
  ko_aquarel_normal:     { label: 'Kő Aq. normál',    color: 'bg-teal-100 text-teal-700' },
  ko_aquarel_nagy:       { label: 'Kő Aq. nagy',      color: 'bg-teal-100 text-teal-700' },
  belyeg_1_normal:       { label: 'Bélyeg 1r. normál',color: 'bg-blue-100 text-blue-700' },
  belyeg_1_kicsi:        { label: 'Bélyeg 1r. kicsi', color: 'bg-blue-100 text-blue-700' },
  belyeg_2:              { label: 'Bélyeg kétrétegű', color: 'bg-indigo-100 text-indigo-700' },
  faszelet_go:           { label: 'Faszelet GO',      color: 'bg-amber-100 text-amber-700' },
  fa_nagybetus:          { label: 'Fa Nagybetűs',     color: 'bg-amber-100 text-amber-700' },
  templomablak_kicsi:    { label: 'Templomablak K.',  color: 'bg-purple-100 text-purple-700' },
  templomablak_nagy:     { label: 'Templomablak N.',  color: 'bg-purple-100 text-purple-700' },
}

export default function WarehousePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (materialFilter) params.set('material', materialFilter)
    const res = await fetch(`/api/products?${params}`)
    const data = await res.json()
    setProducts(data)
    setLoading(false)
  }, [search, materialFilter])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  async function handleDelete(id: string) {
    if (!confirm('Biztosan archiválja ezt a terméket?')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    fetchProducts()
  }

  const lowStock = products.filter((p) => p.stock <= p.minStock)
  const totalStockValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0)
  const totalSalesValue = products.reduce((sum, p) => sum + p.stock * p.salesPrice, 0)

  return (
    <div className="p-6">
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

      {/* Figyelmeztetések */}
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

      {/* Szűrők */}
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
      </div>

      {/* Termék táblázat */}
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
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Betöltés...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Nem található termék</td></tr>
            ) : products.map((product) => {
              const hordozo = HORDOZO_CONFIG[product.material || '']
              const isLow = product.stock <= product.minStock
              const margin = product.salesPrice > 0
                ? ((product.salesPrice - product.costPrice) / product.salesPrice * 100).toFixed(0)
                : '0'

              return (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <button
                          onClick={() => setLightboxUrl(product.imageUrl)}
                          className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 shrink-0 hover:ring-2 hover:ring-blue-400 transition-all"
                        >
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        </button>
                      ) : (
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                          <Package size={16} className="text-blue-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
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
                        onClick={() => { setStockProduct(product); setShowStockModal(true) }}
                        title="Készletmozgás"
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
              )
            })}
          </tbody>
        </table>
      </div>

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

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={28} />
          </button>
          <div className="relative max-w-2xl max-h-[80vh] w-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={lightboxUrl}
              alt="Termékfotó"
              width={800}
              height={800}
              className="object-contain w-full h-full max-h-[80vh] rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  )
}
