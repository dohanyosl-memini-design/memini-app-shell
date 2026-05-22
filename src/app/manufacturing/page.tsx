'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Edit2, Trash2, Package, ChevronRight, Phone, Mail, Globe, Factory } from 'lucide-react'
import Modal from '@/components/Modal'
import SupplierForm from '@/components/SupplierForm'

interface Supplier {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  zip: string | null
  city: string | null
  country: string | null
  website: string | null
  vatId: string | null
  notes: string | null
  active: boolean
  _count: { products: number; purchaseOrders: number }
}

export default function ManufacturingPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/suppliers')
    const data = await res.json()
    setSuppliers(data.filter((s: Supplier) => s.active))
    setLoading(false)
  }, [])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const filtered = suppliers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase()) ||
    s.contactName?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Törli a(z) ${name} gyártópartnert?`)) return
    await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    fetchSuppliers()
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gyártás</h1>
          <p className="text-gray-500 mt-1">{suppliers.length} gyártópartner</p>
        </div>
        <button
          onClick={() => { setEditSupplier(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Új gyártópartner
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Keresés név, város alapján..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">Betöltés...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Factory size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Nincs gyártópartner</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-sm text-blue-600 hover:underline">
            + Első partner hozzáadása
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <Link href={`/manufacturing/${s.id}`} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                      <Factory size={15} className="text-indigo-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate flex items-center gap-1">
                      {s.name}
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400 shrink-0" />
                    </h3>
                  </div>
                  {s.contactName && <p className="text-xs text-gray-500 ml-10">{s.contactName}</p>}
                  {(s.city || s.country) && (
                    <p className="text-xs text-gray-400 ml-10">{[s.city, s.country].filter(Boolean).join(', ')}</p>
                  )}
                </Link>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button onClick={() => { setEditSupplier(s); setShowModal(true) }} className="text-gray-400 hover:text-blue-600 p-1 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(s.id, s.name)} className="text-gray-400 hover:text-red-600 p-1 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-1 mb-3">
                {s.phone && (
                  <a href={`tel:${s.phone}`} className="flex items-center gap-2 text-xs text-gray-500 hover:text-green-600 transition-colors">
                    <Phone size={11} className="text-gray-400" />{s.phone}
                  </a>
                )}
                {s.email && (
                  <a href={`mailto:${s.email}`} className="flex items-center gap-2 text-xs text-gray-500 hover:text-blue-600 transition-colors">
                    <Mail size={11} className="text-gray-400" /><span className="truncate">{s.email}</span>
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-50 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Package size={11} />{s._count.products} termék
                </span>
                <span>{s._count.purchaseOrders} rendelés</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editSupplier ? 'Gyártópartner szerkesztése' : 'Új gyártópartner'} onClose={() => setShowModal(false)}>
          <SupplierForm
            supplier={editSupplier}
            onSave={() => { setShowModal(false); fetchSuppliers() }}
            onCancel={() => setShowModal(false)}
          />
        </Modal>
      )}
    </div>
  )
}
