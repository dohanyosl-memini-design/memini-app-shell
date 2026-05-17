'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import InvoicePreview from '@/components/InvoicePreview'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
  isDiscount: boolean
}

interface Invoice {
  id: string
  number: string
  date: string
  dueDate: string
  deliveryInfo: string | null
  status: string
  stornoOf: string | null
  currency: string
  subtotal: number
  vatAmount: number
  total: number
  paidAt: string | null
  notes: string | null
  billingName: string | null
  billingAddress: string | null
  billingZip: string | null
  billingCity: string | null
  billingCountry: string | null
  contact: { firstName: string; lastName: string } | null
  company: {
    name: string
    address: string | null
    zip: string | null
    city: string | null
    vatId: string | null
    phone: string | null
    email: string | null
    customerNumber: string | null
  } | null
  items: InvoiceItem[]
}

export default function InvoicePrintPage() {
  const params = useParams()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/invoices/${params.id}`)
      .then(r => r.json())
      .then(data => { setInvoice(data); setLoading(false) })
  }, [params.id])

  useEffect(() => {
    if (!loading && invoice) {
      setTimeout(() => window.print(), 600)
    }
  }, [loading, invoice])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-400 text-sm">Betöltés...</p>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-400 text-sm">A számla nem található.</p>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      <InvoicePreview invoice={invoice} printMode />
    </div>
  )
}
