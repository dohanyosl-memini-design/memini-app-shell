'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface PrintProduct {
  id: string
  name: string
  nameDE: string | null
  sku: string
  imageUrl: string | null
  locationCabinet: string | null
  locationShelf: string | null
  locationBox: string | null
}

interface PrintItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
  product: PrintProduct | null
}

interface PrintOrder {
  id: string
  number: string
  date: string
  deliveryDate: string | null
  status: string
  shippingMethod: string | null
  customerRef: string | null
  deliveryAddress: string | null
  notes: string | null
  internalNotes: string | null
  subtotal: number
  vatAmount: number
  total: number
  contact: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null
  company: {
    id: string; name: string; address: string | null; city: string | null
    region: string | null; country: string | null; phone: string | null
    email: string | null; vatId: string | null; customerNumber: string | null
  } | null
  items: PrintItem[]
}

const STATUS_LABELS: Record<string, string> = {
  pending:       'Függőben',
  confirmed:     'Visszaigazolva',
  in_production: 'Gyártásban',
  packing:       'Összekészítés',
  shipped:       'Kiszállítva',
  delivered:     'Átadva',
  cancelled:     'Lemondva',
}

function locationStr(product: PrintProduct | null) {
  if (!product) return '—'
  const parts = [product.locationCabinet, product.locationShelf, product.locationBox].filter(Boolean)
  return parts.length ? parts.join(' / ') : '—'
}

function fmtDate(d: string) {
  return format(new Date(d), 'yyyy. MMM d.', { locale: hu })
}

export default function PrintOrderPage() {
  const params = useParams()
  const [order, setOrder] = useState<PrintOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/orders/${params.id}/print-data`)
      .then(r => r.json())
      .then(data => { setOrder(data); setLoading(false) })
  }, [params.id])

  useEffect(() => {
    if (!loading && order) {
      setTimeout(() => window.print(), 600)
    }
  }, [loading, order])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-400 text-sm">Betöltés...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-400 text-sm">A megrendelés nem található.</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 12mm; size: A4 portrait; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          input[type="checkbox"] { appearance: none; -webkit-appearance: none; width: 12px; height: 12px; border: 1.5px solid #888; border-radius: 2px; display: inline-block; vertical-align: middle; }
        }
      `}</style>

      {/* Toolbar - hidden when printing */}
      <div className="no-print fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 z-50 shadow-sm">
        <span className="text-sm font-medium text-gray-700 mr-2">Megrendelőlap: {order.number}</span>
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          🖨️ Nyomtatás
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Bezárás
        </button>
      </div>

      {/* Print content */}
      <div className="bg-white min-h-screen px-8 pt-20 pb-8 print:pt-0 print:px-0 max-w-[800px] mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-5 pb-4 border-b-2 border-gray-900">
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">MEMINI DESIGN</h1>
            <p className="text-xs text-gray-500 mt-0.5">Ulm, Deutschland</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">Megrendelőlap</p>
            <p className="text-2xl font-black font-mono text-gray-900">{order.number}</p>
            <div className="flex items-center gap-2 justify-end mt-1 flex-wrap">
              <span className="text-xs text-gray-500">📅 {fmtDate(order.date)}</span>
              {order.deliveryDate && (
                <span className="text-xs text-gray-500">→ 🚚 {fmtDate(order.deliveryDate)}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                order.status === 'confirmed'     ? 'bg-blue-100 text-blue-700' :
                order.status === 'in_production' ? 'bg-purple-100 text-purple-700' :
                order.status === 'packing'       ? 'bg-orange-100 text-orange-700' :
                order.status === 'shipped'       ? 'bg-indigo-100 text-indigo-700' :
                order.status === 'delivered'     ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-600'
              }`}>{STATUS_LABELS[order.status] || order.status}</span>
            </div>
          </div>
        </div>

        {/* Partner + Delivery info */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Megrendelő */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Megrendelő</p>
            <p className="font-bold text-gray-900 text-sm leading-tight">{order.company?.name || '—'}</p>
            <div className="mt-1 space-y-0.5">
              {order.company?.customerNumber && (
                <p className="text-xs text-gray-500">Cégkód: <span className="font-medium text-gray-700">{order.company.customerNumber}</span></p>
              )}
              {order.company?.vatId && (
                <p className="text-xs text-gray-500">VAT-ID: <span className="font-medium text-gray-700">{order.company.vatId}</span></p>
              )}
              {order.company?.address && (
                <p className="text-xs text-gray-600 mt-1">{order.company.address}</p>
              )}
              {(order.company?.city || order.company?.country) && (
                <p className="text-xs text-gray-600">
                  {[order.company.city, order.company.region, order.company.country].filter(Boolean).join(', ')}
                </p>
              )}
              {order.company?.phone && <p className="text-xs text-gray-500 mt-1">📞 {order.company.phone}</p>}
              {order.company?.email && <p className="text-xs text-gray-500">✉️ {order.company.email}</p>}
              {order.contact && (
                <p className="text-xs text-gray-700 mt-1.5 pt-1.5 border-t border-gray-200">
                  👤 <span className="font-medium">{order.contact.firstName} {order.contact.lastName}</span>
                  {order.contact.phone && <span className="text-gray-500"> · {order.contact.phone}</span>}
                </p>
              )}
            </div>
          </div>

          {/* Szállítás */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Szállítás</p>
            {order.deliveryAddress ? (
              <p className="text-sm font-medium text-gray-800 leading-snug">{order.deliveryAddress}</p>
            ) : (
              <p className="text-xs text-gray-400 italic">Nincs szállítási cím megadva</p>
            )}
            <div className="mt-2 space-y-1">
              {order.shippingMethod && (
                <p className="text-xs text-gray-600">
                  🚚 <span className="font-medium">{order.shippingMethod}</span>
                </p>
              )}
              {order.customerRef && (
                <p className="text-xs text-gray-600">
                  Vevői ref.: <span className="font-medium font-mono">{order.customerRef}</span>
                </p>
              )}
              {order.deliveryDate && (
                <p className="text-xs text-gray-600">
                  Határidő: <span className="font-medium">{fmtDate(order.deliveryDate)}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-xs mb-5 border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left py-2 px-2 font-semibold w-14 rounded-tl">Kép</th>
              <th className="text-left py-2 px-2 font-semibold">Termék</th>
              <th className="text-left py-2 px-2 font-semibold w-24">Raktárhely</th>
              <th className="text-right py-2 px-2 font-semibold w-16">Menny.</th>
              <th className="text-right py-2 px-2 font-semibold w-18">Egységár</th>
              <th className="text-right py-2 px-2 font-semibold w-20 pr-3">Összesen</th>
              <th className="text-center py-2 px-2 font-semibold w-36 rounded-tr">Elvégzendő</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={item.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="py-2 px-2">
                  {item.product?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.product.imageUrl}
                      alt={item.description}
                      className="w-12 h-12 object-cover rounded border border-gray-100"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-300 text-lg">
                      📦
                    </div>
                  )}
                </td>
                <td className="py-2 px-2">
                  <p className="font-semibold text-gray-900 leading-tight">{item.description}</p>
                  {item.product?.nameDE && (
                    <p className="text-gray-500 leading-tight">{item.product.nameDE}</p>
                  )}
                  {item.product?.sku && (
                    <p className="font-mono text-gray-400 text-[10px]">{item.product.sku}</p>
                  )}
                </td>
                <td className="py-2 px-2">
                  <span className="font-mono font-bold text-gray-700 bg-yellow-100 px-1.5 py-0.5 rounded text-[11px]">
                    {locationStr(item.product)}
                  </span>
                </td>
                <td className="py-2 px-2 text-right font-bold text-gray-900 text-sm">
                  {item.quantity} db
                </td>
                <td className="py-2 px-2 text-right text-gray-600">
                  €{item.unitPrice.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-right font-bold text-gray-900 pr-3">
                  €{item.total.toFixed(2)}
                </td>
                <td className="py-2 px-3">
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" className="w-3.5 h-3.5 border border-gray-400 rounded" />
                      <span className="text-gray-600">Összeszedve</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" className="w-3.5 h-3.5 border border-gray-400 rounded" />
                      <span className="text-gray-600">Csomagolva</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" className="w-3.5 h-3.5 border border-orange-400 rounded" />
                      <span className="text-orange-600 font-medium">Rendelni kell</span>
                    </label>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-5">
          <div className="border border-gray-200 rounded-lg overflow-hidden w-56">
            <div className="flex justify-between text-xs px-3 py-1.5 bg-gray-50 border-b border-gray-200">
              <span className="text-gray-500">Nettó:</span>
              <span className="font-medium text-gray-800">€{order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs px-3 py-1.5 bg-gray-50 border-b border-gray-200">
              <span className="text-gray-500">ÁFA:</span>
              <span className="font-medium text-gray-800">€{order.vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm px-3 py-2 bg-gray-900 text-white font-bold">
              <span>Összesen:</span>
              <span>€{order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {(order.notes || order.internalNotes) && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {order.notes && (
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Megjegyzés</p>
                <p className="text-xs text-gray-700 leading-relaxed">{order.notes}</p>
              </div>
            )}
            {order.internalNotes && (
              <div className="border border-amber-300 bg-amber-50 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">Belső megjegyzés</p>
                <p className="text-xs text-amber-800 leading-relaxed">{order.internalNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Summary checkboxes + signature */}
        <div className="border-t-2 border-gray-900 pt-4">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Ellenőrzőlista</p>
              {[
                { label: 'Összes tétel összeszedve', color: '' },
                { label: 'Be van csomagolva', color: '' },
                { label: 'Szállítólevél kész', color: '' },
                { label: 'Kész, indulásra vár', color: 'text-green-700 font-medium' },
              ].map(item => (
                <label key={item.label} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 border border-gray-400 rounded" />
                  <span className={`text-xs ${item.color || 'text-gray-700'}`}>{item.label}</span>
                </label>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Csomagolás</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Dobozok száma:</span>
                  <div className="border-b border-gray-400 flex-1"></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Súly (kg):</span>
                  <div className="border-b border-gray-400 flex-1"></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Csomagszám:</span>
                  <div className="border-b border-gray-400 flex-1"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-4">
            <div>
              <p className="text-[10px] text-gray-400 mb-6">Összeszedő / raktáros aláírása:</p>
              <div className="border-b-2 border-gray-400 w-full"></div>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-6">Dátum:</p>
              <div className="border-b-2 border-gray-400 w-full"></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[9px] text-gray-300 text-center mt-6 print:mt-4">
          Memini Design · {order.number} · Nyomtatva: {format(new Date(), 'yyyy.MM.dd')}
        </p>
      </div>
    </>
  )
}
