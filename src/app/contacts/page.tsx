'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Edit2, Trash2, Building2, ChevronRight, LayoutGrid, List, MapPin } from 'lucide-react'
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
  company: { id: string; name: string; city: string | null; country: string | null } | null
  createdAt: string
}

type ViewMode = 'grid' | 'list' | 'city'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  lead: { label: 'Érdeklődő', color: 'bg-yellow-100 text-yellow-800' },
  contacted: { label: 'Kapcsolatban', color: 'bg-blue-100 text-blue-700' },
  prospect: { label: 'Potenciális', color: 'bg-purple-100 text-purple-700' },
  qualified: { label: 'Minősített', color: 'bg-indigo-100 text-indigo-700' },
  active: { label: 'Aktív', color: 'bg-green-100 text-green-800' },
  customer: { label: 'Ügyfél', color: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Inaktív', color: 'bg-gray-100 text-gray-600' },
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [countryFilter, setCountryFilter] = useState('')
  const [openCities, setOpenCities] = useState<Set<string>>(new Set())

  // Load view preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('contacts-view') as ViewMode | null
      if (saved && ['grid', 'list', 'city'].includes(saved)) {
        setViewMode(saved)
      }
    } catch {
      // ignore
    }
  }, [])

  function setView(mode: ViewMode) {
    setViewMode(mode)
    try {
      localStorage.setItem('contacts-view', mode)
    } catch {
      // ignore
    }
  }

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

  function toggleCity(city: string) {
    setOpenCities(prev => {
      const next = new Set(prev)
      if (next.has(city)) next.delete(city)
      else next.add(city)
      return next
    })
  }

  // Apply status filter first, then country filter
  const statusFiltered = filterStatus === 'all'
    ? contacts
    : contacts.filter((c) => c.status === filterStatus)

  const filtered = countryFilter
    ? statusFiltered.filter(c => c.company?.country === countryFilter)
    : statusFiltered

  // Unique country codes from company data
  const uniqueCountries = Array.from(
    new Set(contacts.map(c => c.company?.country).filter(Boolean))
  ) as string[]
  uniqueCountries.sort()

  // City grouping for city view (from company city)
  const cityGroups = (() => {
    const map = new Map<string, Contact[]>()
    for (const c of filtered) {
      const key = c.company?.city || 'Ismeretlen város'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    const entries = Array.from(map.entries())
    entries.sort(([a], [b]) => {
      if (a === 'Ismeretlen város') return 1
      if (b === 'Ismeretlen város') return -1
      return a.localeCompare(b)
    })
    return entries
  })()

  const viewToggle = (
    <div className="flex border border-gray-200 rounded-lg overflow-hidden shrink-0">
      {([
        { mode: 'grid' as ViewMode, Icon: LayoutGrid, title: 'Kártya nézet' },
        { mode: 'list' as ViewMode, Icon: List, title: 'Lista nézet' },
        { mode: 'city' as ViewMode, Icon: MapPin, title: 'Város nézet' },
      ]).map(({ mode, Icon, title }) => (
        <button
          key={mode}
          title={title}
          onClick={() => setView(mode)}
          className={`px-2.5 py-2 transition-colors ${
            viewMode === mode
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  )

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ügyfelek</h1>
          <p className="text-gray-500 mt-1">{filtered.length} ügyfél</p>
        </div>
        <div className="flex items-center gap-2">
          {viewToggle}
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Új ügyfél
          </button>
        </div>
      </div>

      {/* Search + status filter bar */}
      <div className="flex gap-3 mb-3">
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

      {/* Country filter pill bar */}
      {uniqueCountries.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
          <button
            onClick={() => setCountryFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0 ${
              !countryFilter
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            Összes
          </button>
          {uniqueCountries.map(code => (
            <button
              key={code}
              onClick={() => setCountryFilter(prev => prev === code ? '' : code)}
              className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0 ${
                countryFilter === code
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 py-12 text-center text-gray-400">Betöltés...</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-3 py-12 text-center text-gray-400">Nem található ügyfél</div>
          ) : (
            filtered.map((contact) => {
              const status = STATUS_CONFIG[contact.status] ?? { label: contact.status, color: 'bg-gray-100 text-gray-600' }
              return (
                <div key={contact.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <Link href={`/contacts/${contact.id}`} className="flex-1 min-w-0 group">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
                          {contact.firstName[0]}{contact.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate flex items-center gap-1">
                            {contact.salutation && <span className="text-gray-400 text-xs font-normal">{contact.salutation}</span>}
                            {contact.firstName} {contact.lastName}
                            <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400 shrink-0" />
                          </div>
                          {status && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 ${status.color}`}>
                              {status.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button onClick={() => handleEdit(contact)} className="text-gray-400 hover:text-blue-600 transition-colors p-1">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(contact.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-gray-500">
                    {contact.company && (
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} className="text-gray-400 shrink-0" />
                        <span className="truncate">{contact.company.name}</span>
                        {contact.company.country && (
                          <span className="text-xs font-mono text-gray-400 shrink-0">{contact.company.country}</span>
                        )}
                      </div>
                    )}
                    {contact.email && <div className="truncate text-xs">{contact.email}</div>}
                    {contact.phone && <div className="text-xs">{contact.phone}</div>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
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
                    const status = STATUS_CONFIG[contact.status] ?? { label: contact.status, color: 'bg-gray-100 text-gray-600' }
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
      )}

      {/* CITY VIEW */}
      {viewMode === 'city' && (
        <div className="space-y-1">
          {loading ? (
            <div className="py-12 text-center text-gray-400">Betöltés...</div>
          ) : cityGroups.length === 0 ? (
            <div className="py-12 text-center text-gray-400">Nem található ügyfél</div>
          ) : (
            cityGroups.map(([city, items]) => {
              const isOpen = openCities.has(city)
              // Show country from first item's company
              const countryCode = items[0]?.company?.country
              return (
                <div key={city} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => toggleCity(city)}
                  >
                    <ChevronRight
                      size={16}
                      className={`text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                    />
                    <span className="font-medium text-gray-800 flex-1">{city}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium shrink-0">{items.length}</span>
                    {countryCode && (
                      <span className="text-xs font-mono text-gray-400 shrink-0">{countryCode}</span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-50">
                      {items.map((contact, idx) => {
                        const status = STATUS_CONFIG[contact.status] ?? { label: contact.status, color: 'bg-gray-100 text-gray-600' }
                        return (
                          <div
                            key={contact.id}
                            className={`flex items-center gap-3 px-4 py-2.5 ${idx < items.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors`}
                          >
                            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs shrink-0">
                              {contact.firstName[0]}{contact.lastName[0]}
                            </div>
                            <Link href={`/contacts/${contact.id}`} className="flex-1 min-w-0 text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors truncate">
                              {contact.firstName} {contact.lastName}
                            </Link>
                            {status && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 hidden sm:inline-flex ${status.color}`}>
                                {status.label}
                              </span>
                            )}
                            <button onClick={() => handleEdit(contact)} className="text-gray-400 hover:text-blue-600 transition-colors p-1 shrink-0">
                              <Edit2 size={12} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {showModal && (
        <Modal title={editContact ? 'Ügyfél szerkesztése' : 'Új ügyfél'} onClose={handleModalClose}>
          <ContactForm contact={editContact} onSave={handleSave} onCancel={handleModalClose} />
        </Modal>
      )}
    </div>
  )
}
