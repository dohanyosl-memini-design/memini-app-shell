'use client'

import { Printer } from 'lucide-react'
import { format } from 'date-fns'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
}

interface Invoice {
  number: string
  date: string
  dueDate: string
  status: string
  currency: string
  subtotal: number
  vatAmount: number
  total: number
  paidAt: string | null
  notes: string | null
  contact: { firstName: string; lastName: string } | null
  company: { name: string; address: string | null; city: string | null; vatId: string | null } | null
  items: InvoiceItem[]
}

export default function InvoicePreview({ invoice }: { invoice: Invoice }) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm"
        >
          <Printer size={16} />
          Nyomtatás / PDF mentés
        </button>
      </div>

      <div id="invoice-print" className="bg-white p-8 border border-gray-200 rounded-lg print:border-0 print:p-0">
        {/* Fejléc */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Memini Design</h1>
            <p className="text-gray-500 text-sm">Laci & Gabi</p>
            <p className="text-gray-500 text-sm">Ulm, Deutschland</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">Rechnung</p>
            <p className="text-lg font-mono text-blue-600 mt-1">{invoice.number}</p>
          </div>
        </div>

        {/* Dátumok */}
        <div className="flex gap-8 mb-8 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Rechnungsdatum</p>
            <p className="font-medium">{format(new Date(invoice.date), 'dd.MM.yyyy')}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Fälligkeitsdatum</p>
            <p className="font-medium">{format(new Date(invoice.dueDate), 'dd.MM.yyyy')}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Status</p>
            <p className={`font-medium ${invoice.status === 'paid' ? 'text-green-600' : 'text-blue-600'}`}>
              {invoice.status === 'paid' ? 'Bezahlt' : 'Offen'}
            </p>
          </div>
        </div>

        {/* Vevő adatok */}
        <div className="mb-8">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Rechnungsempfänger</p>
          <div className="bg-gray-50 rounded-lg p-4">
            {invoice.company && (
              <>
                <p className="font-semibold text-gray-900">{invoice.company.name}</p>
                {invoice.company.address && <p className="text-gray-600 text-sm">{invoice.company.address}</p>}
                {invoice.company.city && <p className="text-gray-600 text-sm">{invoice.company.city}</p>}
                {invoice.company.vatId && <p className="text-gray-500 text-sm">USt-IdNr: {invoice.company.vatId}</p>}
              </>
            )}
            {invoice.contact && (
              <p className="text-gray-600 text-sm mt-1">z.Hd. {invoice.contact.firstName} {invoice.contact.lastName}</p>
            )}
          </div>
        </div>

        {/* Tételek */}
        <table className="w-full mb-8 text-sm">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 font-semibold text-gray-700">Beschreibung</th>
              <th className="text-right py-2 font-semibold text-gray-700 w-16">Menge</th>
              <th className="text-right py-2 font-semibold text-gray-700 w-24">Einzelpreis</th>
              <th className="text-right py-2 font-semibold text-gray-700 w-16">MwSt.</th>
              <th className="text-right py-2 font-semibold text-gray-700 w-24">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-3 text-gray-800">{item.description}</td>
                <td className="py-3 text-right text-gray-600">{item.quantity}</td>
                <td className="py-3 text-right text-gray-600">€{item.unitPrice.toFixed(2)}</td>
                <td className="py-3 text-right text-gray-500">{item.vatRate}%</td>
                <td className="py-3 text-right font-medium text-gray-900">€{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Összegzés */}
        <div className="flex justify-end">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between text-gray-600">
              <span>Nettobetrag:</span>
              <span>€{invoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>MwSt.:</span>
              <span>€{invoice.vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-lg border-t-2 border-gray-900 pt-2 mt-2">
              <span>Gesamtbetrag:</span>
              <span>€{invoice.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Megjegyzés */}
        {invoice.notes && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Hinweise</p>
            <p className="text-sm text-gray-600">{invoice.notes}</p>
          </div>
        )}

        {/* Lábléc */}
        <div className="mt-10 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>Memini Design · Ulm, Deutschland · Nicht umsatzsteuerpflichtig (Kleinunternehmerregelung §19 UStG)</p>
        </div>
      </div>

      <style>{`
        @media print {
          body > * { display: none !important; }
          #invoice-print { display: block !important; position: fixed; inset: 0; }
        }
      `}</style>
    </div>
  )
}
