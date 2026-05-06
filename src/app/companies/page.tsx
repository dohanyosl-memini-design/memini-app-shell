'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, Globe, Phone, Users } from 'lucide-react'
import Modal from '@/components/Modal'
import CompanyForm from '@/components/CompanyForm'

interface Company {
  id: string
  name: string
  industry: string | null
  website: string | null
  phone: string | null
  address: string | null
  createdAt: string
  _count: { contacts: number; deals: number }
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editCompany, setEditCompany] = useState<Company | null>(null)

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/companies?search=${encodeURIComponent(search)}`)
    const data = await res.json()
    setCompanies(data)
    setLoading(false)
  }, [search])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törölni szeretné ezt a céget?')) return
    await fetch(`/api/companies/${id}`, { method: 'DELETE' })
    fetchCompanies()
  }

  function handleEdit(company: Company) {
    setEditCompany(company)
    setShowModal(true)
  }

  function handleAdd() {
    setEditCompany(null)
    setShowModal(true)
  }

  function handleModalClose() {
    setShowModal(false)
    setEditCompany(null)
  }

  function handleSave() {
    handleModalClose()
    fetchCompanies()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cégek</h1>
          <p className="text-gray-500 mt-1">{companies.length} cég</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Új cég
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Keresés cég neve alapján..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-gray-400">Betöltés...</div>
        ) : companies.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-gray-400">Nem található cég</div>
        ) : (
          companies.map((company) => (
            <div key={company.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{company.name}</h3>
                  {company.industry && (
                    <p className="text-sm text-gray-500 mt-0.5">{company.industry}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(company)}
                    className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(company.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                {company.website && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Globe size={13} className="text-gray-400" />
                    {company.website}
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={13} className="text-gray-400" />
                    {company.phone}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 pt-3 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Users size={13} />
                  <span>{company._count.contacts} ügyfél</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>{company._count.deals} deal</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <Modal title={editCompany ? 'Cég szerkesztése' : 'Új cég'} onClose={handleModalClose}>
          <CompanyForm company={editCompany} onSave={handleSave} onCancel={handleModalClose} />
        </Modal>
      )}
    </div>
  )
}
