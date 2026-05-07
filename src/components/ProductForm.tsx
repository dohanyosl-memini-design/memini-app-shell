'use client'

import { useState, useRef } from 'react'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import Image from 'next/image'

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

interface ProductFormProps {
  product: Product | null
  onSave: () => void
  onCancel: () => void
}

const MATERIALS = [
  { value: 'stone', label: 'Kő' },
  { value: 'wood', label: 'Fa' },
  { value: 'pla', label: 'PLA (3D)' },
  { value: 'other', label: 'Egyéb' },
]

const PRODUCT_TYPES = [
  { value: 'magnet', label: 'Hűtőmágnes' },
  { value: 'postcard', label: 'Képeslap' },
  { value: 'decor', label: 'Dekor elem' },
  { value: 'other', label: 'Egyéb' },
]

export default function ProductForm({ product, onSave, onCancel }: ProductFormProps) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>(product?.imageUrl || '')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    description: product?.description || '',
    material: product?.material || 'stone',
    productType: product?.productType || 'magnet',
    site: product?.site || '',
    city: product?.city || '',
    costPrice: product?.costPrice?.toString() || '',
    salesPrice: product?.salesPrice?.toString() || '',
    stock: product?.stock?.toString() || '0',
    minStock: product?.minStock?.toString() || '10',
    unit: product?.unit || 'db',
    vatRate: product?.vatRate?.toString() || '19',
  })

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) setImageUrl(data.url)
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const method = product ? 'PUT' : 'POST'
    const url = product ? `/api/products/${product.id}` : '/api/products'

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, imageUrl: imageUrl || null }),
    })

    setLoading(false)
    onSave()
  }

  const margin = form.salesPrice && form.costPrice
    ? (((parseFloat(form.salesPrice) - parseFloat(form.costPrice)) / parseFloat(form.salesPrice)) * 100).toFixed(0)
    : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Fotó */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Termékfotó (JPEG / WebP)</label>
        <div className="flex items-start gap-4">
          {imageUrl ? (
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 shrink-0">
              <Image src={imageUrl} alt="termékfotó" fill className="object-cover" />
              <button
                type="button"
                onClick={() => { setImageUrl(''); if (fileRef.current) fileRef.current.value = '' }}
                className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow hover:bg-red-50 transition-colors"
              >
                <X size={12} className="text-gray-600" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors shrink-0"
            >
              {uploading
                ? <Loader2 size={20} className="animate-spin" />
                : <><ImagePlus size={20} /><span className="text-xs mt-1">Feltöltés</span></>}
            </button>
          )}
          <div className="text-xs text-gray-400 pt-1 space-y-1">
            <p>Max. 4 MB</p>
            <p>JPEG vagy WebP formátum</p>
            {imageUrl && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-blue-500 hover:underline"
              >
                Csere
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/webp"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Termék neve *</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="pl. Ulmer Münster – Kő hűtőmágnes"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
          <input
            required
            type="text"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            placeholder="MM-ULM-001-KO"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Egység</label>
          <input
            type="text"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            placeholder="db"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anyag</label>
          <select
            value={form.material}
            onChange={(e) => setForm({ ...form, material: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MATERIALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Termék típus</label>
          <select
            value={form.productType}
            onChange={(e) => setForm({ ...form, productType: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Helyszín (szuvenír)</label>
          <input
            type="text"
            value={form.site}
            onChange={(e) => setForm({ ...form, site: e.target.value })}
            placeholder="pl. Ulmer Münster"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Város</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="pl. Ulm"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Árak & Készlet</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Önköltség (€)</label>
            <input
              type="number"
              step="0.01"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Eladási ár (€)
              {margin && <span className="text-green-600 ml-2 font-medium">{margin}% marge</span>}
            </label>
            <input
              type="number"
              step="0.01"
              value={form.salesPrice}
              onChange={(e) => setForm({ ...form, salesPrice: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ÁFA / MwSt (%)</label>
            <select
              value={form.vatRate}
              onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="19">19% (Standard)</option>
              <option value="7">7% (Ermäßigt)</option>
              <option value="0">0%</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min. készlet (újrarendelés)</label>
            <input
              type="number"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!product && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kezdő készlet</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Leírás</label>
        <textarea
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Mégse</button>
        <button type="submit" disabled={loading || uploading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Mentés...' : 'Mentés'}
        </button>
      </div>
    </form>
  )
}
