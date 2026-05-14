'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { ShoppingCart, X, Plus, Minus } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useCart } from '@/contexts/CartContext'
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
  priceListEntryId: string | null
  orderCount?: number
}

interface Section {
  type: 'previous' | 'city' | 'upsell'
  label: string
  products: Product[]
}

interface PriceEntry {
  id: string
  basePrice: number
  tiers: { qty: number; m: number }[]
}

const QTY_STEPS = [50, 100, 200, 300, 500, 1000, 2000]

function getTierPrice(basePrice: number, qty: number, tiers: { qty: number; m: number }[]): number {
  if (!tiers.length) return basePrice
  const sorted = [...tiers].sort((a, b) => b.qty - a.qty)
  const tier = sorted.find((t) => qty >= t.qty)
  return tier ? Math.round(basePrice * tier.m * 100) / 100 : basePrice
}

function ProductsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const partnerId = searchParams.get('partnerId')
  const partnerName = searchParams.get('partnerName')
  const partnerCity = searchParams.get('partnerCity')
  const initialCity = searchParams.get('city') ?? 'all'
  const { theme } = useTheme()
  const { cart, addItem, totalItems, subtotal, setPartner } = useCart()

  const [sections, setSections] = useState<Section[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState(initialCity)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Product | null>(null)

  const isSmartMode = !!partnerId && !search

  // Sync partner to cart context
  useEffect(() => {
    if (partnerId && partnerName) {
      setPartner(partnerId, partnerName, partnerCity ?? undefined)
    }
  }, [partnerId, partnerName, partnerCity, setPartner])

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

  const filterBarStyle: React.CSSProperties = {
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
          <span className="text-xs font-semibold uppercase tracking-widest flex-shrink-0" style={{ color: theme.textSecondary }}>Megrendelő</span>
          <span className="text-sm font-bold truncate" style={{ color: theme.textPrimary }}>{partnerName}</span>
          {partnerCity && <span className="text-xs flex-shrink-0" style={{ color: theme.textSecondary }}>— {partnerCity}</span>}
        </div>
      )}

      {/* Filter bar */}
      <div className="px-4 md:px-8 lg:px-12 pt-2 pb-3 space-y-2 sticky top-0 z-10" style={filterBarStyle}>
        <input
          type="search"
          placeholder="Keresés termékek között..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 md:py-3.5 rounded-xl text-base focus:outline-none"
          style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary }}
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
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: totalItems > 0 ? '80px' : '0' }}>
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: theme.textSecondary }}>Betöltés...</div>
        ) : isSmartMode ? (
          <SmartSections sections={sections} onSelect={setSelected} theme={theme} />
        ) : (
          <div className="px-4 md:px-8 lg:px-12 py-4">
            {products.length === 0 ? (
              <div className="flex items-center justify-center h-40" style={{ color: theme.textSecondary }}>Nincs találat</div>
            ) : (
              <ProductGrid products={products} onSelect={setSelected} theme={theme} />
            )}
          </div>
        )}
      </div>

      {/* Cart bar */}
      {totalItems > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-20 px-4 py-3"
          style={{
            background: theme.cardBg,
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            borderTop: `1px solid ${theme.cardBorder}`,
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          <button
            onClick={() => router.push('/cart')}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl font-semibold text-base"
            style={{ background: theme.buttonBg, color: theme.buttonText }}
          >
            <span className="flex items-center gap-2">
              <ShoppingCart size={18} strokeWidth={2} />
              {totalItems} termék
            </span>
            <span>€{subtotal.toFixed(2)} →</span>
          </button>
        </div>
      )}

      {/* Product modal */}
      {selected && (
        <ProductModal
          product={selected}
          onClose={() => setSelected(null)}
          theme={theme}
          onAdded={() => setSelected(null)}
        />
      )}
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

function SmartSections({ sections, onSelect, theme }: { sections: Section[]; onSelect: (p: Product) => void; theme: Theme }) {
  if (!sections.length) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-2">
        <p className="text-base font-medium" style={{ color: theme.textPrimary }}>Nincs rendelési előzmény</p>
        <p className="text-sm" style={{ color: theme.textSecondary }}>Válassz a termékekből az első megrendeléshez</p>
      </div>
    )
  }
  return (
    <div className="pb-4">
      {sections.map((section, i) => (
        <div key={section.type}>
          {i > 0 && <div className="mx-4 md:mx-8 lg:mx-12 my-5" style={{ height: '1px', background: theme.cardBorder }} />}
          <div className="px-4 md:px-8 lg:px-12 pt-5 pb-3 flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.textSecondary }}>{section.label}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: theme.inputBg, color: theme.textSecondary }}>{section.products.length}</span>
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
  products: Product[]; onSelect: (p: Product) => void; theme: Theme; showOrderBadge?: boolean
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onClick={() => onSelect(p)} theme={theme} showOrderBadge={showOrderBadge} />
      ))}
    </div>
  )
}

// --- City chip ---

function CityChip({ label, active, onClick, theme }: { label: string; active: boolean; onClick: () => void; theme: Theme }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition min-h-[36px]"
      style={active
        ? { background: theme.textPrimary, color: theme.buttonText }
        : { background: theme.inputBg, color: theme.textSecondary, border: `1px solid ${theme.cardBorder}` }}
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
        {showOrderBadge && product.orderCount ? (
          <span className="absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: theme.buttonBg, color: theme.buttonText }}>×{product.orderCount}</span>
        ) : product.city ? (
          <span className="absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: theme.cardBg, color: theme.textSecondary, border: `1px solid ${theme.cardBorder}` }}>{product.city}</span>
        ) : null}
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

function ProductModal({ product, onClose, theme, onAdded }: {
  product: Product; onClose: () => void; theme: Theme; onAdded: () => void
}) {
  const { addItem, cart } = useCart()
  const [qtyIndex, setQtyIndex] = useState(0)
  const [priceEntry, setPriceEntry] = useState<PriceEntry | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(false)
  const [added, setAdded] = useState(false)

  const qty = QTY_STEPS[qtyIndex]

  useEffect(() => {
    if (!product.priceListEntryId) return
    setLoadingPrice(true)
    fetch(`/api/pricelists/${product.priceListEntryId}`)
      .then((r) => r.json())
      .then((data) => {
        setPriceEntry({ id: data.id, basePrice: data.basePrice, tiers: data.tiers ?? [] })
      })
      .finally(() => setLoadingPrice(false))
  }, [product.priceListEntryId])

  const basePrice = priceEntry ? getTierPrice(priceEntry.basePrice, QTY_STEPS[0], priceEntry.tiers) : product.salesPrice
  const unitPrice = priceEntry ? getTierPrice(priceEntry.basePrice, qty, priceEntry.tiers) : product.salesPrice
  const totalPrice = unitPrice * qty
  const savings = (basePrice - unitPrice) * qty

  // Check if already in cart
  const inCart = cart.items.some((i) => i.productId === product.id)

  function handleAdd() {
    addItem({
      productId: product.id,
      name: product.nameDE || product.name,
      sku: product.sku,
      quantity: qty,
      unitPrice,
      baseUnitPrice: basePrice,
      vatRate: product.vatRate,
      unit: product.unit,
      imageUrl: product.imageUrl,
      city: product.city,
    })
    setAdded(true)
    setTimeout(() => onAdded(), 600)
  }

  const displayName = product.nameDE || product.name

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden w-full"
        style={{
          background: theme.cardBg,
          backdropFilter: 'blur(48px)',
          WebkitBackdropFilter: 'blur(48px)',
          border: `1px solid ${theme.cardBorder}`,
          maxWidth: '640px',
          maxHeight: '95vh',
          borderTopLeftRadius: '1.5rem',
          borderTopRightRadius: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full image */}
        <div className="relative flex-shrink-0" style={{ height: '38vh', background: theme.inputBg }}>
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={displayName} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-8xl opacity-20">📦</div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}
          >
            <X size={18} strokeWidth={2.5} />
          </button>
          {product.city && (
            <span
              className="absolute bottom-3 left-3 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: theme.cardBg, color: theme.textSecondary, border: `1px solid ${theme.cardBorder}` }}
            >
              {product.city}
            </span>
          )}
        </div>

        {/* Scrollable details */}
        <div className="overflow-y-auto px-5 pt-3 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold leading-tight" style={{ color: theme.textPrimary }}>{displayName}</h2>
              {product.nameDE && product.name !== product.nameDE && (
                <p className="text-sm mt-0.5" style={{ color: theme.textSecondary }}>{product.name}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs" style={{ color: theme.textSecondary }}>/ {product.unit} + {product.vatRate}% ÁFA</p>
            </div>
          </div>

          {/* Details row */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {product.sku && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: theme.inputBg, color: theme.textSecondary }}>
                {product.sku}
              </span>
            )}
            {product.material && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: theme.inputBg, color: theme.textSecondary }}>
                {product.material}
              </span>
            )}
            {product.productType && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: theme.inputBg, color: theme.textSecondary }}>
                {product.productType}
              </span>
            )}
          </div>

          {product.description && (
            <p className="mt-3 text-sm leading-relaxed" style={{ color: theme.textSecondary }}>{product.description}</p>
          )}
        </div>

        {/* Fixed bottom: price + slider + button */}
        <div
          className="flex-shrink-0 px-5 pt-4"
          style={{
            borderTop: `1px solid ${theme.cardBorder}`,
            paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
          }}
        >
          {/* Price display — big and prominent */}
          {loadingPrice ? (
            <p className="text-sm text-center mb-4" style={{ color: theme.textSecondary }}>Ár betöltése...</p>
          ) : (
            <div className="mb-4">
              {/* Unit price — large */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-5xl font-black tracking-tight" style={{ color: theme.textPrimary }}>
                  €{unitPrice.toFixed(2)}
                </span>
                <span className="text-base font-medium" style={{ color: theme.textSecondary }}>/ {product.unit}</span>
              </div>
              {/* Total + savings row */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold" style={{ color: theme.textSecondary }}>
                  {qty} {product.unit} = <span style={{ color: theme.textPrimary }}>€{totalPrice.toFixed(2)}</span>
                </span>
                {savings > 0.005 && (
                  <span
                    className="text-sm font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
                  >
                    −€{savings.toFixed(2)} megtakarítás
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Slider */}
          <div className="mb-1">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.textSecondary }}>Mennyiség</span>
              <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>{qty} {product.unit}</span>
            </div>
            <input
              type="range"
              min={0}
              max={QTY_STEPS.length - 1}
              step={1}
              value={qtyIndex}
              onChange={(e) => setQtyIndex(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer mb-1"
              style={{ accentColor: theme.textPrimary, background: theme.inputBg }}
            />
            <div className="flex justify-between mb-4">
              {QTY_STEPS.map((q, i) => (
                <button
                  key={q}
                  onClick={() => setQtyIndex(i)}
                  className="text-xs text-center transition"
                  style={{
                    color: theme.textPrimary,
                    fontWeight: i === qtyIndex ? 700 : 400,
                    opacity: i === qtyIndex ? 1 : 0.4,
                  }}
                >
                  {q >= 1000 ? `${q / 1000}k` : q}
                </button>
              ))}
            </div>
          </div>

          {/* Add to cart */}
          <button
            onClick={handleAdd}
            disabled={added}
            className="w-full py-4 rounded-2xl font-bold text-base transition disabled:opacity-70"
            style={{ background: theme.buttonBg, color: theme.buttonText }}
          >
            {added ? '✓ Hozzáadva' : inCart ? 'Frissítés a kosárban' : 'Kosárba'}
          </button>
        </div>
      </div>
    </div>
  )
}
