'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useTheme } from '@/contexts/ThemeContext'
import type { Theme } from '@/lib/themes'

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
  orderCount?: number
}

interface Section {
  type: 'previous' | 'city' | 'upsell'
  label: string
  products: Product[]
}

function ProductsContent() {
  const searchParams = useSearchParams()
  const partnerId = searchParams.get('partnerId')
  const partnerName = searchParams.get('partnerName')
  const partnerCity = searchParams.get('partnerCity')
  const initialCity = searchParams.get('city') ?? 'all'
  const { theme } = useTheme()

  // Smart mode state
  const [sections, setSections] = useState<Section[]>([])

  // Regular mode state
  const [products, setProducts] = useState<Product[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState(initialCity)
  const [search, setSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Product | null>(null)

  const isSmartMode = !!partnerId && !search

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()

    if (partnerId) params.set('partnerId', partnerId)
    if (!partnerId && selectedCity !== 'all') params.set('city', selectedCity)
    if (search) params.set('search', search)

    const res = await fetch(`/api/products?${params}`)
    const data = await res.json()

    if (data.smart) {
      setSections(data.sections ?? [])
    } else {
      setProducts(data.products ?? [])
      if (data.cities?.length) setCities(data.cities)
    }
    setLoading(false)
  }, [partnerId, selectedCity, search])

  useEffect(() => {
    const t = setTimeout(fetchProducts, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchProducts])

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg,
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    borderBottom: `1px solid ${theme.cardBorder}`,
  }

  return (
    <div className="flex flex-col h-full">
      {/* Partner banner */}
      {partnerName && (
        <div
          className="px-4 md:px-8 lg:px-12 py-2.5 flex items-center gap-2"
          style={{ background: theme.inputBg, borderBottom: `1px solid ${theme.cardBorder}` }}
        >
          <span className="text-xs font-semibold uppercase tracking-widest flex-shrink-0" style={{ color: theme.textSecondary }}>
            Megrendelő
          </span>
          <span className="text-sm font-bold truncate" style={{ color: theme.textPrimary }}>{partnerName}</span>
          {partnerCity && (
            <span className="text-xs flex-shrink-0" style={{ color: theme.textSecondary }}>— {partnerCity}</span>
          )}
        </div>
      )}

      {/* Filter bar — always shown for search, city chips only in regular mode */}
      <div
        className="px-4 md:px-8 lg:px-12 pt-2 pb-3 space-y-2 sticky top-0 z-10"
        style={cardStyle}
      >
        <input
          type="search"
          placeholder="Keresés termékek között..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 md:py-3.5 rounded-xl text-base focus:outline-none"
          style={{
            background: theme.inputBg,
            border: `1px solid ${theme.inputBorder}`,
            color: theme.textPrimary,
          }}
        />
        {!partnerId && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <CityChip label="Összes" active={selectedCity === 'all'} onClick={() => setSelectedCity('all')} theme={theme} />
            {cities.map((c) => (
              <CityChip key={c} label={c} active={selectedCity === c} onClick={() => setSelectedCity(c)} theme={theme} />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: theme.textSecondary }}>
            Betöltés...
          </div>
        ) : isSmartMode ? (
          <SmartSections sections={sections} onSelect={setSelected} theme={theme} />
        ) : (
          <div className="px-4 md:px-8 lg:px-12 py-4">
            {products.length === 0 ? (
              <div className="flex items-center justify-center h-40" style={{ color: theme.textSecondary }}>
                Nincs találat
              </div>
            ) : (
              <ProductGrid products={products} onSelect={setSelected} theme={theme} />
            )}
          </div>
        )}
      </div>

      {selected && <ProductModal product={selected} onClose={() => setSelected(null)} theme={theme} />}
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center opacity-50">Betöltés...</div>}>
      <ProductsContent />
    </Suspense>
  )
}

// --- Smart sections ---

function SmartSections({ sections, onSelect, theme }: {
  sections: Section[]
  onSelect: (p: Product) => void
  theme: Theme
}) {
  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-2">
        <p className="text-base font-medium" style={{ color: theme.textPrimary }}>Nincsenek termékadatok</p>
        <p className="text-sm" style={{ color: theme.textSecondary }}>Ennek a partnernek még nincs rendelési előzménye</p>
      </div>
    )
  }

  return (
    <div className="pb-8">
      {sections.map((section, i) => (
        <div key={section.type}>
          {/* Section separator (not before first) */}
          {i > 0 && (
            <div
              className="mx-4 md:mx-8 lg:mx-12 my-6"
              style={{ height: '1px', background: theme.cardBorder }}
            />
          )}

          {/* Section header */}
          <div className="px-4 md:px-8 lg:px-12 pt-5 pb-3 flex items-center gap-3">
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: theme.textSecondary }}
            >
              {section.label}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: theme.inputBg, color: theme.textSecondary }}
            >
              {section.products.length}
            </span>
          </div>

          <div className="px-4 md:px-8 lg:px-12">
            <ProductGrid products={section.products} onSelect={onSelect} theme={theme} showOrderBadge={section.type === 'previous'} />
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Product grid ---

function ProductGrid({ products, onSelect, theme, showOrderBadge = false }: {
  products: Product[]
  onSelect: (p: Product) => void
  theme: Theme
  showOrderBadge?: boolean
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onClick={() => onSelect(p)} theme={theme} showOrderBadge={showOrderBadge} />
      ))}
    </div>
  )
}

// --- City chip ---

function CityChip({ label, active, onClick, theme }: {
  label: string; active: boolean; onClick: () => void; theme: Theme
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition min-h-[36px]"
      style={
        active
          ? { background: theme.textPrimary, color: theme.buttonText }
          : { background: theme.inputBg, color: theme.textSecondary, border: `1px solid ${theme.cardBorder}` }
      }
    >
      {label}
    </button>
  )
}

// --- Product card ---

function ProductCard({ product, onClick, theme, showOrderBadge }: {
  product: Product; onClick: () => void; theme: Theme; showOrderBadge?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl overflow-hidden text-left active:scale-[0.97] transition-transform duration-150 w-full"
      style={{
        background: theme.cardBg,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${theme.cardBorder}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}
    >
      <div className="aspect-square relative" style={{ background: theme.inputBg }}>
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">📦</div>
        )}
        {showOrderBadge && product.orderCount && product.orderCount > 0 && (
          <span
            className="absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: theme.buttonBg, color: theme.buttonText }}
          >
            ×{product.orderCount}
          </span>
        )}
        {product.city && !showOrderBadge && (
          <span
            className="absolute top-2 left-2 backdrop-blur-sm text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: theme.cardBg, color: theme.textSecondary, border: `1px solid ${theme.cardBorder}` }}
          >
            {product.city}
          </span>
        )}
      </div>
      <div className="p-3 md:p-4">
        <p className="font-semibold text-sm md:text-base leading-tight line-clamp-2" style={{ color: theme.textPrimary }}>
          {product.nameDE || product.name}
        </p>
        {product.material && (
          <p className="text-xs mt-0.5 truncate" style={{ color: theme.textSecondary }}>{product.material}</p>
        )}
        <p className="font-bold mt-2 text-sm md:text-base" style={{ color: theme.textPrimary }}>
          €{product.salesPrice.toFixed(2)}
          <span className="font-normal text-xs" style={{ color: theme.textSecondary }}> / {product.unit}</span>
        </p>
      </div>
    </button>
  )
}

// --- Product modal ---

function ProductModal({ product, onClose, theme }: { product: Product; onClose: () => void; theme: Theme }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl md:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col"
        style={{
          background: theme.cardBg,
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: `1px solid ${theme.cardBorder}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-video relative flex-shrink-0" style={{ background: theme.inputBg }}>
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl opacity-20">📦</div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg"
            style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, color: theme.textPrimary }}
          >
            ✕
          </button>
        </div>

        <div className="p-5 md:p-7 overflow-y-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold" style={{ color: theme.textPrimary }}>
                {product.nameDE || product.name}
              </h2>
              {product.nameDE && product.name !== product.nameDE && (
                <p className="text-sm mt-0.5" style={{ color: theme.textSecondary }}>{product.name}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl md:text-3xl font-bold" style={{ color: theme.textPrimary }}>
                €{product.salesPrice.toFixed(2)}
              </p>
              <p className="text-xs" style={{ color: theme.textSecondary }}>/ {product.unit} + {product.vatRate}% ÁFA</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            {product.sku && <InfoRow label="Cikkszám" value={product.sku} theme={theme} />}
            {product.city && <InfoRow label="Helyszín" value={product.city} theme={theme} />}
            {product.material && <InfoRow label="Anyag" value={product.material} theme={theme} />}
            {product.productType && <InfoRow label="Típus" value={product.productType} theme={theme} />}
          </div>

          {product.description && (
            <p className="mt-5 text-sm md:text-base leading-relaxed" style={{ color: theme.textSecondary }}>
              {product.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, theme }: { label: string; value: string; theme: Theme }) {
  return (
    <div className="rounded-xl p-3 md:p-4" style={{ background: theme.inputBg, border: `1px solid ${theme.cardBorder}` }}>
      <p className="text-xs font-medium" style={{ color: theme.textSecondary }}>{label}</p>
      <p className="font-semibold mt-0.5 text-sm md:text-base" style={{ color: theme.textPrimary }}>{value}</p>
    </div>
  )
}
