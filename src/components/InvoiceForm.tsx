'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Tag, Percent, Euro, MapPin } from 'lucide-react'
import { format, addDays } from 'date-fns'

interface Contact { id: string; firstName: string; lastName: string; companyId: string | null }
interface Company { id: string; name: string; address: string | null; zip: string | null; city: string | null; country: string | null; vatId: string | null; customerNumber: string | null }
interface Product { id: string; name: string; nameDE: string | null; sku: string; material: string | null; priceListEntryId: string | null; salesPrice: number; vatRate: number; city: string | null }
interface Carrier { id: string; code: string; nameDE: string | null }
interface PriceTier { qty: number; m: number }
interface PriceEntry { id: string; hordozo: string | null; basePrice: number; tiers: PriceTier[] }

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  productId: string
  isDiscount: false
}

interface DiscountItem {
  description: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  isDiscount: true
}

type Item = LineItem | DiscountItem

const DISCOUNT_PRESETS = [
  { label: '10% Neukunden-Rabatt', type: 'percent' as const, value: 10 },
  { label: '5% Rabatt', type: 'percent' as const, value: 5 },
  { label: '15% Rabatt', type: 'percent' as const, value: 15 },
]

function calcTierPriceFromEntry(entry: PriceEntry | undefined, quantity: number): { price: number; tier: PriceTier | null } | null {
  if (!entry) return null
  const sorted = [...entry.tiers].sort((a, b) => b.qty - a.qty)
  const tier = sorted.find(t => t.qty <= quantity) ?? null
  const m = tier ? tier.m : 1
  return { price: Math.round(entry.basePrice * m * 100) / 100, tier }
}

interface ExistingInvoice {
  id: string
  number: string
  date: string
  dueDate: string
  deliveryInfo: string | null
  currency: string
  notes: string | null
  status: string
  contactId?: string | null
  companyId?: string | null
  contact?: { id?: string } | null
  company?: { id?: string } | null
  billingName?: string | null
  billingAddress?: string | null
  billingZip?: string | null
  billingCity?: string | null
  billingCountry?: string | null
  items: { description: string; quantity: number; unitPrice: number; vatRate: number; productId?: string | null; isDiscount: boolean }[]
}

export default function InvoiceForm({ onSave, onCancel, invoice }: { onSave: () => void; onCancel: () => void; invoice?: ExistingInvoice | null }) {
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [pricelist, setPricelist] = useState<PriceEntry[]>([])
  const [previousProductIds, setPreviousProductIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const due30 = format(addDays(new Date(), 30), 'yyyy-MM-dd')

  const [form, setForm] = useState({
    invoiceNumber: invoice?.number || '',
    contactId: invoice?.contact?.id || invoice?.contactId || '',
    companyId: invoice?.company?.id || invoice?.companyId || '',
    date: invoice?.date?.slice(0, 10) || today,
    dueDate: invoice?.dueDate?.slice(0, 10) || due30,
    deliveryInfo: invoice?.deliveryInfo || '',
    currency: invoice?.currency || 'EUR',
    notes: invoice?.notes || '',
    billingName: invoice?.billingName || '',
    billingAddress: invoice?.billingAddress || '',
    billingZip: invoice?.billingZip || '',
    billingCity: invoice?.billingCity || '',
    billingCountry: invoice?.billingCountry || '',
  })

  const [items, setItems] = useState<Item[]>(
    invoice?.items?.length
      ? invoice.items.map(i => i.isDiscount
          ? ({ description: i.description, discountType: 'fixed' as const, discountValue: Math.abs(i.unitPrice), isDiscount: true as const })
          : ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate, productId: i.productId || '', isDiscount: false as const }))
      : [{ description: '', quantity: 1, unitPrice: 0, vatRate: 19, productId: '', isDiscount: false as const }]
  )

  useEffect(() => {
    Promise.all([
      fetch('/api/contacts').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/pricelist').then(r => r.json()),
      fetch('/api/carriers').then(r => r.json()),
      fetch('/api/invoices/next-number').then(r => r.json()),
    ]).then(([c, co, p, pl, ca, nn]) => {
      setAllContacts(c); setCompanies(co); setProducts(p); setPricelist(pl); setCarriers(ca)
      if (!invoice) setForm(f => ({ ...f, invoiceNumber: nn.number }))
    })
  }, [invoice])

  // Load previous orders for the selected company
  const loadPreviousProducts = useCallback(async (companyId: string) => {
    if (!companyId) { setPreviousProductIds(new Set()); return }
    const res = await fetch(`/api/orders?companyId=${companyId}`)
    const orders = await res.json()
    const ids = new Set<string>()
    for (const order of orders) {
      for (const item of (order.items || [])) {
        if (item.productId) ids.add(item.productId)
      }
    }
    setPreviousProductIds(ids)
  }, [])

  useEffect(() => {
    if (form.companyId) loadPreviousProducts(form.companyId)
    else setPreviousProductIds(new Set())
  }, [form.companyId, loadPreviousProducts])

  // Contacts filtered to the selected company
  const filteredContacts = form.companyId
    ? allContacts.filter(c => c.companyId === form.companyId)
    : allContacts

  const selectedCompany = companies.find(c => c.id === form.companyId) ?? null

  // Products grouped: previously ordered / same city / upsell
  function getProductGroups() {
    const prev: Product[] = []
    const cityMatch: Product[] = []
    const upsell: Product[] = []
    const companyCity = selectedCompany?.city?.toLowerCase()

    for (const p of products) {
      if (previousProductIds.has(p.id)) {
        prev.push(p)
      } else if (companyCity && p.city?.toLowerCase() === companyCity) {
        cityMatch.push(p)
      } else {
        upsell.push(p)
      }
    }
    return { prev, cityMatch, upsell }
  }

  const productSubtotal = items
    .filter(i => !i.isDiscount)
    .reduce((s, i) => s + (i as LineItem).quantity * (i as LineItem).unitPrice, 0)

  function resolveCarrierCode(material: string | null): string | null {
    if (!material) return null
    const carrier = carriers.find(c => c.id === material) ?? carriers.find(c => c.code === material)
    return carrier?.code ?? material
  }

  function findEntry(product: Product): PriceEntry | undefined {
    if (product.priceListEntryId) {
      const e = pricelist.find(e => e.id === product.priceListEntryId)
      if (e) return e
    }
    const code = resolveCarrierCode(product.material)
    return code ? pricelist.find(e => e.hordozo === code) : undefined
  }

  function addProductItem() {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, vatRate: 19, productId: '', isDiscount: false }])
  }

  function addDiscount(preset?: typeof DISCOUNT_PRESETS[0]) {
    const d: DiscountItem = {
      description: preset?.label ?? 'Rabatt',
      discountType: preset?.type ?? 'percent',
      discountValue: preset?.value ?? 10,
      isDiscount: true,
    }
    setItems([...items, d])
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateProduct(idx: number, field: keyof LineItem, value: string | number) {
    const updated = [...items]
    const item = { ...updated[idx] } as LineItem
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(item as any)[field] = value

    if (field === 'productId') {
      if (value) {
        const product = products.find(p => p.id === value)
        if (product) {
          const carrier = carriers.find(c => c.id === product.material) ?? carriers.find(c => c.code === product.material)
          const line1 = carrier?.nameDE || product.nameDE || product.name
          const line2Bold = `${product.sku} / ${carrier?.code ?? product.material ?? ''}`
          const line2Paren = product.nameDE || ''
          item.description = [line1, line2Paren ? `${line2Bold}\t${line2Paren}` : line2Bold].join('\n')
          item.vatRate = product.vatRate
          const calc = calcTierPriceFromEntry(findEntry(product), item.quantity)
          item.unitPrice = calc ? calc.price : product.salesPrice
        }
      } else {
        item.description = ''
        item.unitPrice = 0
      }
    }

    if (field === 'quantity' && item.productId) {
      const product = products.find(p => p.id === item.productId)
      if (product) {
        const calc = calcTierPriceFromEntry(findEntry(product), Number(value))
        if (calc) item.unitPrice = calc.price
      }
    }

    updated[idx] = item
    setItems(updated)
  }

  function updateDiscount(idx: number, field: 'description' | 'discountType' | 'discountValue', value: string | number) {
    const updated = [...items]
    const item = { ...updated[idx] } as DiscountItem
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(item as any)[field] = value
    updated[idx] = item
    setItems(updated)
  }

  function getDiscountAmount(d: DiscountItem): number {
    if (d.discountType === 'percent') return Math.round(productSubtotal * d.discountValue / 100 * 100) / 100
    return d.discountValue
  }

  function getTierLabel(idx: number): string | null {
    const item = items[idx]
    if (item.isDiscount) return null
    const li = item as LineItem
    if (!li.productId) return null
    const product = products.find(p => p.id === li.productId)
    if (!product?.material) return null
    const calc = calcTierPriceFromEntry(findEntry(product), li.quantity)
    if (!calc) return null
    if (!calc.tier) return 'Alap ár'
    return `${calc.tier.qty}+ db · −${((1 - calc.tier.m) * 100).toFixed(1)}%`
  }

  const discountTotal = items
    .filter(i => i.isDiscount)
    .reduce((s, i) => s + getDiscountAmount(i as DiscountItem), 0)

  const netAfterDiscount = productSubtotal - discountTotal
  const vatAmount = netAfterDiscount * 0.19
  const total = netAfterDiscount + vatAmount
  const hasDiscounts = items.some(i => i.isDiscount)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const apiItems = items.map(item => {
      if (item.isDiscount) {
        const d = item as DiscountItem
        const amount = getDiscountAmount(d)
        return {
          description: d.discountType === 'percent'
            ? `- ${d.discountValue}% ${d.description}`
            : `- ${d.description}`,
          quantity: 1,
          unitPrice: -amount,
          vatRate: 0,
          isDiscount: true,
        }
      }
      const li = item as LineItem
      return { ...li, isDiscount: false }
    })

    const url = invoice ? `/api/invoices/${invoice.id}` : '/api/invoices'
    const method = invoice ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, number: form.invoiceNumber, items: apiItems }),
    })

    if (!res.ok) {
      const err = await res.json()
      alert(err.error || 'Hiba történt a számla kiállítása során.')
      setLoading(false)
      return
    }

    setLoading(false)
    onSave()
  }

  const { prev: prevProducts, cityMatch: cityProducts, upsell: upsellProducts } = getProductGroups()

  function renderProductSelect(li: LineItem, idx: number) {
    return (
      <select
        value={li.productId}
        onChange={e => updateProduct(idx, 'productId', e.target.value)}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1 mb-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">— Termék választása —</option>
        {prevProducts.length > 0 && (
          <optgroup label={`✓ Korábban rendelt (${prevProducts.length})`}>
            {prevProducts.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.nameDE ? ` · ${p.nameDE}` : ''}</option>
            ))}
          </optgroup>
        )}
        {cityProducts.length > 0 && (
          <optgroup label={`📍 ${selectedCompany?.city} – városhoz tartozó`}>
            {cityProducts.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.nameDE ? ` · ${p.nameDE}` : ''}</option>
            ))}
          </optgroup>
        )}
        {upsellProducts.length > 0 && (
          <optgroup label={prevProducts.length > 0 || cityProducts.length > 0 ? '↑ Upsell – egyéb termékek' : 'Termékek'}>
            {upsellProducts.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.nameDE ? ` · ${p.nameDE}` : ''}</option>
            ))}
          </optgroup>
        )}
      </select>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Számlaszám */}
      <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-sm font-semibold text-blue-700 whitespace-nowrap">Számlaszám:</span>
        <input
          type="text"
          value={form.invoiceNumber}
          onChange={e => setForm({ ...form, invoiceNumber: e.target.value })}
          placeholder="pl. 07/2026"
          required
          className="flex-1 px-3 py-1.5 border border-blue-300 rounded-lg text-sm font-mono font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <span className="text-xs text-blue-500 whitespace-nowrap">szerkeszthető</span>
      </div>

      {/* Cég + Ügyfél */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cég</label>
          <select value={form.companyId} onChange={e => {
            const co = companies.find(c => c.id === e.target.value)
            setForm(f => ({
              ...f,
              companyId: e.target.value,
              // Reset contact if it doesn't belong to the new company
              contactId: allContacts.find(c => c.id === f.contactId)?.companyId === e.target.value ? f.contactId : '',
              billingName: co?.name || '',
              billingAddress: co?.address || '',
              billingZip: co?.zip || '',
              billingCity: co?.city || '',
              billingCountry: co?.country || '',
            }))
          }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="">Válassz céget</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ügyfél
            {form.companyId && filteredContacts.length === 0 && (
              <span className="text-gray-400 font-normal ml-1 text-xs">(nincs kapcsolt ügyfél)</span>
            )}
          </label>
          <select value={form.contactId} onChange={e => setForm({ ...form, contactId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="">Válassz ügyfelet</option>
            {filteredContacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>

        {/* Cég adatok kártya */}
        {selectedCompany && (
          <div className="col-span-2 bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-3">
            <MapPin size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <div className="text-sm text-gray-700 leading-relaxed">
              <p className="font-semibold text-gray-900">{selectedCompany.name}</p>
              {selectedCompany.address && <p>{selectedCompany.address}</p>}
              {(selectedCompany.zip || selectedCompany.city) && (
                <p>{[selectedCompany.zip, selectedCompany.city].filter(Boolean).join(' ')}</p>
              )}
              {selectedCompany.vatId && <p className="text-xs text-gray-500 mt-0.5">USt-IdNr.: {selectedCompany.vatId}</p>}
              {selectedCompany.customerNumber && <p className="text-xs text-gray-500">Kunden-Nr.: {selectedCompany.customerNumber}</p>}
            </div>
            {previousProductIds.size > 0 && (
              <div className="ml-auto text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-right shrink-0">
                <p className="font-semibold">{previousProductIds.size} korábban rendelt</p>
                <p className="text-blue-400">termék kiemelve</p>
              </div>
            )}
          </div>
        )}

        {/* Számlázási cím — szerkeszthető */}
        {form.companyId && (
          <div className="col-span-2 bg-white rounded-lg p-3 space-y-2 border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Számlázási cím</p>
            <input type="text" placeholder="Cégnév" value={form.billingName}
              onChange={e => setForm({ ...form, billingName: e.target.value })}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="text" placeholder="Utca, házszám" value={form.billingAddress}
              onChange={e => setForm({ ...form, billingAddress: e.target.value })}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <input type="text" placeholder="PLZ" value={form.billingZip}
                onChange={e => setForm({ ...form, billingZip: e.target.value })}
                className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" placeholder="Város" value={form.billingCity}
                onChange={e => setForm({ ...form, billingCity: e.target.value })}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" placeholder="Ország" value={form.billingCountry}
                onChange={e => setForm({ ...form, billingCountry: e.target.value })}
                className="w-16 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kiállítás dátuma</label>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fizetési határidő</label>
          <div className="flex gap-1.5 mb-1.5">
            {[7, 14, 30].map(days => (
              <button
                key={days}
                type="button"
                onClick={() => setForm({ ...form, dueDate: format(addDays(new Date(form.date || new Date()), days), 'yyyy-MM-dd') })}
                className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors font-medium"
              >
                +{days} nap
              </button>
            ))}
          </div>
          <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Lieferdatum</label>
          <input type="text" value={form.deliveryInfo} onChange={e => setForm({ ...form, deliveryInfo: e.target.value })}
            placeholder="pl. 15.03.2026 vagy 10.01.2026 &amp; 15.03.2026"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </div>

      {/* Tételek */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Tételek *</label>
          <button type="button" onClick={addProductItem}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <Plus size={14} />Termék hozzáadása
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Termék / Leírás</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 w-20">Menny.</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Egységár (€)</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 w-20">MwSt</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">Összesen</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => {
                if (item.isDiscount) {
                  const d = item as DiscountItem
                  const amount = getDiscountAmount(d)
                  return (
                    <tr key={idx} className="bg-orange-50">
                      <td className="px-3 py-2" colSpan={2}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">RABATT</span>
                          <input type="text" value={d.description}
                            onChange={e => updateDiscount(idx, 'description', e.target.value)}
                            className="flex-1 text-sm border border-orange-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button type="button"
                            onClick={() => updateDiscount(idx, 'discountType', d.discountType === 'percent' ? 'fixed' : 'percent')}
                            className={`px-2 py-1 rounded text-xs font-semibold border transition-colors ${d.discountType === 'percent' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300'}`}>
                            %
                          </button>
                          <button type="button"
                            onClick={() => updateDiscount(idx, 'discountType', d.discountType === 'fixed' ? 'percent' : 'fixed')}
                            className={`px-2 py-1 rounded text-xs font-semibold border transition-colors ${d.discountType === 'fixed' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300'}`}>
                            €
                          </button>
                          <input type="number" step="0.01" min="0" value={d.discountValue}
                            onChange={e => updateDiscount(idx, 'discountValue', parseFloat(e.target.value) || 0)}
                            className="w-16 text-sm text-right border border-orange-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white" />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-gray-400">—</td>
                      <td className="px-3 py-2 text-right font-medium text-red-600">
                        −{amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                      </td>
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                }

                const li = item as LineItem
                const tierLabel = getTierLabel(idx)
                return (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      {renderProductSelect(li, idx)}
                      <input type="text" value={li.description}
                        onChange={e => updateProduct(idx, 'description', e.target.value)}
                        placeholder="Számlán megjelenő szöveg"
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="1" value={li.quantity}
                        onChange={e => updateProduct(idx, 'quantity', parseFloat(e.target.value))}
                        className="w-full text-sm text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" value={li.unitPrice}
                        onChange={e => updateProduct(idx, 'unitPrice', parseFloat(e.target.value))}
                        className="w-full text-sm text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      {tierLabel && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Tag size={9} className="text-green-500 shrink-0" />
                          <span className="text-[10px] text-green-600 font-medium">{tierLabel}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select value={li.vatRate} onChange={e => updateProduct(idx, 'vatRate', parseFloat(e.target.value))}
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value={19}>19%</option>
                        <option value={7}>7%</option>
                        <option value={0}>0%</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      €{(li.quantity * li.unitPrice * (1 + li.vatRate / 100)).toFixed(2)}
                    </td>
                    <td className="px-2 py-2">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Kedvezmény */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Kedvezmény:</span>
          {DISCOUNT_PRESETS.map(p => (
            <button key={p.label} type="button" onClick={() => addDiscount(p)}
              className="text-xs px-2.5 py-1 rounded-full border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors flex items-center gap-1">
              <Percent size={10} />
              {p.label}
            </button>
          ))}
          <button type="button" onClick={() => addDiscount()}
            className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1">
            <Euro size={10} />
            Egyéni kedvezmény
          </button>
        </div>

        {/* Összegzés */}
        <div className="flex justify-end mt-3">
          <div className="text-sm space-y-1 w-64">
            {hasDiscounts && (
              <div className="flex justify-between text-gray-500">
                <span>Termékek nettó:</span>
                <span>€{productSubtotal.toFixed(2)}</span>
              </div>
            )}
            {items.filter(i => i.isDiscount).map((item, i) => {
              const d = item as DiscountItem
              const amount = getDiscountAmount(d)
              return (
                <div key={i} className="flex justify-between text-red-500 text-xs">
                  <span>
                    {d.discountType === 'percent' ? `−${d.discountValue}% ` : '−'}{d.description}:
                  </span>
                  <span>−€{amount.toFixed(2)}</span>
                </div>
              )
            })}
            <div className="flex justify-between text-gray-600 font-medium">
              <span>Summe Netto:</span>
              <span>€{netAfterDiscount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>MwSt 19%:</span>
              <span>€{vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-1">
              <span>Gesamtsumme:</span>
              <span>€{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés / Hinweis</label>
        <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
          placeholder="pl. Gemäß unserer Vereinbarung..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm" />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Mégse</button>
        <button type="submit" disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Kiállítás...' : 'Számla kiállítása'}
        </button>
      </div>
    </form>
  )
}
