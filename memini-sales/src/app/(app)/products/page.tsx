'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'

interface Product {
  id: string
  name: string
  nameDE: string | null
  sku: string
  description: string | null
  material: string | null
  productType: string | null
  city: string | null
  salesPrice: number
  unit: string
  vatRate: number
  imageUrl: string | null
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Product | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedCity !== 'all') params.set('city', selectedCity)
    if (search) params.set('search', search)

    const res = await fetch(`/api/products?${params}`)
    const data = await res.json()
    setProducts(data.products ?? [])
    if (data.cities?.length) setCities(data.cities)
    setLoading(false)
  }, [selectedCity, search])

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300)
    return () => clearTimeout(t)
  }, [fetchProducts])

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="px-4 pt-4 pb-2 space-y-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <input
          type="search"
          placeholder="Keresés termékek között..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500 bg-gray-50"
        />

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <CityChip label="Összes" active={selectedCity === 'all'} onClick={() => setSelectedCity('all')} />
          {cities.map((c) => (
            <CityChip key={c} label={c} active={selectedCity === c} onClick={() => setSelectedCity(c)} />
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Betöltés...</div>
        ) : products.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Nincs találat</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onClick={() => setSelected(p)} />
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && <ProductModal product={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function CityChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
        active
          ? 'bg-brand-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-left hover:shadow-md transition active:scale-95"
    >
      <div className="aspect-square bg-gray-50 relative">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">
            📦
          </div>
        )}
        {product.city && (
          <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-600 px-2 py-0.5 rounded-full">
            {product.city}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{product.nameDE || product.name}</p>
        {product.material && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{product.material}</p>
        )}
        <p className="text-brand-600 font-bold mt-1.5 text-sm">
          €{product.salesPrice.toFixed(2)}
          <span className="text-gray-400 font-normal text-xs"> / {product.unit}</span>
        </p>
      </div>
    </button>
  )
}

function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-video bg-gray-50 relative flex-shrink-0">
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl text-gray-200">📦</div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full w-9 h-9 flex items-center justify-center text-gray-600 font-bold shadow"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{product.nameDE || product.name}</h2>
              {product.nameDE && product.name !== product.nameDE && (
                <p className="text-sm text-gray-400">{product.name}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold text-brand-600">€{product.salesPrice.toFixed(2)}</p>
              <p className="text-xs text-gray-400">/ {product.unit} + {product.vatRate}% ÁFA</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {product.sku && <InfoRow label="Cikkszám" value={product.sku} />}
            {product.city && <InfoRow label="Helyszín" value={product.city} />}
            {product.material && <InfoRow label="Anyag" value={product.material} />}
            {product.productType && <InfoRow label="Típus" value={product.productType} />}
          </div>

          {product.description && (
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">{product.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-gray-800 font-semibold mt-0.5">{value}</p>
    </div>
  )
}
