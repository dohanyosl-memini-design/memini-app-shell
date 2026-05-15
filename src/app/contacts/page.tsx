'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Edit2, Trash2, Building2, ChevronRight } from 'lucide-react'
import Modal from '@/components/Modal'
import ContactForm from '@/components/ContactForm'

interface Contact {
  id: string
  salutation: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  status: string
  notes: string | null
  companyId: string | null
  company: { id: string; name: string } | null
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  lead: { label: 'Érdeklődő', color: 'bg-yellow-100 text-yellow-800' },
  active: { label: 'Aktív', color: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inaktív', color: 'bg-gray-100 text-gray-600' },
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/contacts?crmOnly=true&search=${encodeURIComponent(search)}`)
    const data = await res.json()
    setContacts(data)
    setLoading(false)
  }, [search])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törölni szeretné ezt az ügyfelet?')) return
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    fetchContacts()
  }

  function handleEdit(contact: Contact) {
    setEditContact(contact)
    setShowModal(true)
  }

  function handleAdd() {
    setEditContact(null)
    setShowModal(true)
  }

  function handleModalClose() {
    setShowModal(false)
    setEditContact(null)
  }

  function handleSave() {
    handleModalClose()
    fetchContacts()
  }

  const filtered = filterStatus === 'all'
    ? contacts
    : contacts.filter((c) => c.status === filterStatus)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ügyfelek</h1>
          <p className="text-gray-500 mt-1">{filtered.length} ügyfél</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Új ügyfél
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Keresés név, email alapján..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
        >
          <option value="all">Minden státusz</option>
          <option value="lead">Érdeklődő</option>
          <option value="active">Aktív</option>
          <option value="inactive">Inaktív</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ügyfél</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cég</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Telefon</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Státusz</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Műveletek</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">Betöltés...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">Nem található ügyfél</td>
              </tr>
            ) : (
              filtered.map((contact) => {
                const status = STATUS_CONFIG[contact.status]
                return (
                  <tr key={contact.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-6 py-4" onClick={() => window.location.href = `/contacts/${contact.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
                          {contact.firstName[0]}{contact.lastName[0]}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {contact.salutation && <span className="text-gray-400 text-xs mr-1">{contact.salutation}</span>}
                            {contact.firstName} {contact.lastName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4" onClick={() => window.location.href = `/contacts/${contact.id}`}>
                      {contact.company ? (
                        <span className="flex items-center gap-1 text-gray-600 text-sm">
                          <Building2 size={13} />
                          {contact.company.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600" onClick={() => window.location.href = `/contacts/${contact.id}`}>{contact.email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600" onClick={() => window.location.href = `/contacts/${contact.id}`}>{contact.phone || '-'}</td>
                    <td className="px-6 py-4" onClick={() => window.location.href = `/contacts/${contact.id}`}>
                      {status && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(contact)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editContact ? 'Ügyfél szerkesztése' : 'Új ügyfél'} onClose={handleModalClose}>
          <ContactForm contact={editContact} onSave={handleSave} onCancel={handleModalClose} />
        </Modal>
      )}
    </div>
  )
}
