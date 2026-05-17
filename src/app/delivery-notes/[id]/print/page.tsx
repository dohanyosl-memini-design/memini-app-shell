'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import DeliveryNotePreview from '@/components/DeliveryNotePreview'

interface DeliveryNoteItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
  isDiscount: boolean
}

interface DeliveryNote {
  id: string
  number: string
  date: string
  deliveryInfo: string | null
  status: string
  currency: string
  subtotal: number
  vatAmount: number
  total: number
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
  items: DeliveryNoteItem[]
}

export default function DeliveryNotePrintPage() {
  const params = useParams()
  const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/delivery-notes/${params.id}`)
      .then(r => r.json())
      .then(data => { setDeliveryNote(data); setLoading(false) })
  }, [params.id])

  useEffect(() => {
    if (!loading && deliveryNote) {
      setTimeout(() => window.print(), 600)
    }
  }, [loading, deliveryNote])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-400 text-sm">Betöltés...</p>
      </div>
    )
  }

  if (!deliveryNote) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-400 text-sm">A szállítólevél nem található.</p>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      <DeliveryNotePreview deliveryNote={deliveryNote} printMode />
    </div>
  )
}
