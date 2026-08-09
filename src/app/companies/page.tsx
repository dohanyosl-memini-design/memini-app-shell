'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Edit2, Trash2, Globe, Phone, Users, ChevronRight, Filter, Mail, Merge, X, LayoutGrid, List, MapPin, Skull } from 'lucide-react'
import Modal from '@/components/Modal'
import CompanyForm from '@/components/CompanyForm'
import LostReasonModal from '@/components/LostReasonModal'

interface Company {
  id: string
  name: string
  partnerType: string | null
  industry: string | null
  website: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  region: string | null
  country: string | null
  classification: string | null
  language: string | null
  channel: string | null
  notes: string | null
  lifecycle: string
  lastOrderDate: string | null
  _count: { contacts: number; deals: number; orders: number }
  activities: { activityDate: string }[]
}

// A Partner CRM csak partnert + inaktívat mutat. A badge ezt jelzi.
const LIFECYCLE_BADGE: Record<string, { label: string; color: string }> = {
  partner:  { label: 'Partner', color: 'bg-green-100 text-green-700 border border-green-300' },
  inactive: { label: 'Inaktív', color: 'bg-amber-100 text-amber-700 border border-amber-300' },
}

// Inaktivitási küszöb (hónap) — a felület javasolja az inaktívra léptetést.
const INACTIVE_SUGGEST_MONTHS = 12

function monthsSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30.4))
}

type ViewMode = 'grid' | 'list' | 'city'

function getDormancyDays(activities: { activityDate: string }[], createdAt?: string): number | null {
  const lastDate = activities[0]?.activityDate
  if (!lastDate) {
    if (!createdAt) return null
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
  }
  return Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
}

const CLASSIFICATION_CONFIG: Record<string, { label: string; color: string }> = {
  A: { label: 'A', color: 'bg-yellow-100 text-yellow-700 border border-yellow-300' },
  B: { label: 'B', color: 'bg-blue-100 text-blue-700 border border-blue-300' },
  C: { label: 'C', color: 'bg-gray-100 text-gray-600 border border-gray-300' },
  D: { label: 'D', color: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

const PARTNER_TYPES = [
  'Kastély', 'Vár', 'Kolostor', 'Templom / Dóm', 'Múzeum',
  'Tourist Info', 'Stadtmarketing', 'Hotel / Lobbyshop',
  'Concept Store', 'Ajándékbolt / Souvenirshop',
]

const COUNTRIES: Record<string, { label: string; regions: string[] }> = {
  DE: {
    label: 'Németország',
    regions: [
      'Baden-Württemberg', 'Bajorország', 'Berlin', 'Brandenburg', 'Bréma',
      'Hamburg', 'Hessen', 'Mecklenburg-Elő-Pomeránia', 'Alsó-Szászország',
      'Észak-Rajna-Vesztfália', 'Rajna-vidék-Pfalz', 'Saar-vidék',
      'Szászország', 'Szász-Anhalt', 'Schleswig-Holstein', 'Türingia',
    ],
  },
  AT: {
    label: 'Ausztria',
    regions: ['Burgenland', 'Karintia', 'Alsó-Ausztria', 'Felső-Ausztria', 'Salzburg', 'Stájerország', 'Tirol', 'Vorarlberg', 'Bécs'],
  },
  CH: {
    label: 'Svájc',
    regions: ['Aargau', 'Bern', 'Zürich', 'Genf', 'Luzern', 'St. Gallen', 'Ticino', 'Valais', 'Vaud'],
  },
  IT: { label: 'Olaszország', regions: ['Lombardia', 'Veneto', 'Piemont', 'Toszkána', 'Lazio', 'Szicília', 'Campania'] },
  FR: { label: 'Franciaország', regions: ['Île-de-France', 'Auvergne-Rhône-Alpes', 'Provence-Alpes-Côte d\'Azur', 'Grand Est'] },
  HU: { label: 'Magyarország', regions: ['Budapest', 'Baranya', 'Bács-Kiskun', 'Pest', 'Győr-Moson-Sopron'] },
}

function DormancyBadge({ activities }: { activities: { activityDate: string }[] }) {
  const days = getDormancyDays(activities)
  if (days === null) return null
  if (days >= 28) return <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">{days}n</span>
  if (days >= 21) return <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">{days}n</span>
  return null
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editCompany, setEditCompany] = useState<Company | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [mergeMode, setMergeMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [masterId, setMasterId] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [openCities, setOpenCities] = useState<Set<string>>(new Set())
  const [cemeteryTarget, setCemeteryTarget] = useState<Company | null>(null)
  const [cemeteryBusy, setCemeteryBusy] = useState(false)

  const [filters, setFilters] = useState({
    partnerType: '',
    country: '',
    region: '',
    classification: '',
    language: '',
  })

  // Load view preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('companies-view') as ViewMode | null
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
      localStorage.setItem('companies-view', mode)
    } catch {
      // ignore
    }
  }

  const availableRegions = filters.country ? (COUNTRIES[filters.country]?.regions || []) : []

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filters.partnerType) params.set('partnerType', filters.partnerType)
    if (filters.country) params.set('country', filters.country)
    if (filters.region) params.set('region', filters.region)
    if (filters.classification) params.set('classification', filters.classification)
    if (filters.language) params.set('language', filters.language)

    const res = await fetch(`/api/companies?${params}`)
    const data = await res.json()
    setCompanies(data)
    setLoading(false)
  }, [search, filters])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])

  // A kuka gomb NEM töröl — a kötelező indokot bekérő ablakot nyitja, ami a
  // céget a temetőbe rakja. A tényleges DELETE hívás a modal megerősítésekor fut.
  async function moveToCemetery(reason: string) {
    if (!cemeteryTarget) return
    setCemeteryBusy(true)
    await fetch(`/api/companies/${cemeteryTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    setCemeteryBusy(false)
    setCemeteryTarget(null)
    fetchCompanies()
  }

  // Inaktívra léptetés egy kattintással (a „rég nem rendelt" javaslatból).
  async function markInactive(id: string) {
    await fetch(`/api/companies/${id}/lifecycle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'inactive' }),
    })
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

  function toggleMergeMode() {
    setMergeMode(m => !m)
    setSelectedIds([])
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function openMergeModal() {
    setMasterId(selectedIds[0])
    setShowMergeModal(true)
  }

  async function handleMerge() {
    if (!masterId) return
    setMerging(true)
    const duplicateIds = selectedIds.filter(id => id !== masterId)
    await fetch('/api/companies/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterId, duplicateIds }),
    })
    setMerging(false)
    setShowMergeModal(false)
    setMergeMode(false)
    setSelectedIds([])
    fetchCompanies()
  }

  function toggleCity(city: string) {
    setOpenCities(prev => {
      const next = new Set(prev)
      if (next.has(city)) next.delete(city)
      else next.add(city)
      return next
    })
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length
  const selectedCompanies = companies.filter(c => selectedIds.includes(c.id))

  // Unique country codes from loaded data
  const uniqueCountries = Array.from(new Set(companies.map(c => c.country).filter(Boolean))) as string[]
  uniqueCountries.sort()

  // Group by classification for subtitle
  const byClass = ['A', 'B', 'C', 'D'].map((cls) => ({
    cls,
    count: companies.filter((c) => c.classification === cls).length,
  })).filter((x) => x.count > 0)

  // City view: group companies by city
  const cityGroups = (() => {
    const map = new Map<string, Company[]>()
    for (const c of companies) {
      const key = c.city || 'Ismeretlen város'
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
          <h1 className="text-2xl font-bold text-gray-900">Cégek</h1>
          <p className="text-gray-500 mt-1">
            {companies.length} partner
            {byClass.length > 0 && (
              <span className="ml-2">
                {byClass.map(({ cls, count }) => (
                  <span key={cls} className="mr-1.5 text-xs">
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-xs font-bold ${CLASSIFICATION_CONFIG[cls]?.color}`}>{cls}</span>
                    {' '}{count}
                  </span>
                ))}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/temeto"
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            title="Elvesztett leadek és partnerek"
          >
            <Skull size={15} />
            <span className="hidden sm:inline">Temető</span>
          </Link>
          {viewToggle}
          <button
            onClick={toggleMergeMode}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
              mergeMode
                ? 'border-orange-400 bg-orange-50 text-orange-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {mergeMode ? <X size={15} /> : <Merge size={15} />}
            {mergeMode ? 'Mégse' : 'Egyesítés'}
          </button>
          {!mergeMode && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Új partner
            </button>
          )}
          {mergeMode && selectedIds.length >= 2 && (
            <button
              onClick={openMergeModal}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Merge size={15} />
              {selectedIds.length} cég egyesítése
            </button>
          )}
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Keresés név, város, email alapján..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
            activeFilterCount > 0
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter size={15} />
          Szűrők
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* Country filter pill bar */}
      {uniqueCountries.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-hide">
          <button
            onClick={() => setFilters(f => ({ ...f, country: '', region: '' }))}
            className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0 ${
              !filters.country
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            Összes
          </button>
          {uniqueCountries.map(code => (
            <button
              key={code}
              onClick={() => setFilters(f => ({ ...f, country: f.country === code ? '' : code, region: '' }))}
              className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0 ${
                filters.country === code
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Típus</label>
            <select
              value={filters.partnerType}
              onChange={(e) => setFilters({ ...filters, partnerType: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Mind</option>
              {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ország</label>
            <select
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value, region: '' })}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Mind</option>
              {Object.entries(COUNTRIES).map(([code, c]) => (
                <option key={code} value={code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Régió</label>
            <select
              value={filters.region}
              onChange={(e) => setFilters({ ...filters, region: e.target.value })}
              disabled={!filters.country}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Mind</option>
              {availableRegions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ABC besorolás</label>
            <select
              value={filters.classification}
              onChange={(e) => setFilters({ ...filters, classification: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Mind</option>
              <option value="A">A – Kiemelt</option>
              <option value="B">B – Rendszeres</option>
              <option value="C">C – Alkalmi</option>
              <option value="D">D – Potenciális</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nyelv</label>
            <select
              value={filters.language}
              onChange={(e) => setFilters({ ...filters, language: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Mind</option>
              <option value="DE">Német</option>
              <option value="EN">Angol</option>
              <option value="HU">Magyar</option>
              <option value="MULTI">Többnyelvű</option>
            </select>
          </div>
          {activeFilterCount > 0 && (
            <div className="col-span-full flex justify-end">
              <button
                onClick={() => setFilters({ partnerType: '', country: '', region: '', classification: '', language: '' })}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Szűrők törlése
              </button>
            </div>
          )}
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 py-12 text-center text-gray-400">Betöltés...</div>
          ) : companies.length === 0 ? (
            <div className="col-span-3 py-12 text-center text-gray-400">Nem található partner</div>
          ) : (
            companies.map((company) => {
              const cls = CLASSIFICATION_CONFIG[company.classification || 'D']
              const isSelected = selectedIds.includes(company.id)
              return (
                <div
                  key={company.id}
                  className={`bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow ${
                    mergeMode
                      ? isSelected
                        ? 'border-orange-400 ring-2 ring-orange-200 cursor-pointer'
                        : 'border-gray-200 cursor-pointer hover:border-orange-300'
                      : 'border-gray-100'
                  }`}
                  onClick={mergeMode ? () => toggleSelect(company.id) : undefined}
                >
                  <div className="flex items-start justify-between mb-3">
                    {mergeMode ? (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                            {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                          </div>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cls.color}`}>{company.classification || 'D'}</span>
                          <h3 className="font-semibold text-gray-900 truncate">{company.name}</h3>
                        </div>
                        {company.partnerType && <p className="text-xs text-blue-600 font-medium">{company.partnerType}</p>}
                        {(company.city || company.region) && (
                          <p className="text-xs text-gray-400">{[company.city, company.region, company.country].filter(Boolean).join(', ')}</p>
                        )}
                      </div>
                    ) : (
                      <Link href={`/companies/${company.id}`} className="flex-1 min-w-0 group">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cls.color}`}>{company.classification || 'D'}</span>
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate flex items-center gap-1">
                            {company.name}
                            <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400 shrink-0" />
                          </h3>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {LIFECYCLE_BADGE[company.lifecycle] && (
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${LIFECYCLE_BADGE[company.lifecycle].color}`}>
                              {LIFECYCLE_BADGE[company.lifecycle].label}
                            </span>
                          )}
                          {company.partnerType && <span className="text-xs text-blue-600 font-medium">{company.partnerType}</span>}
                        </div>
                        {(company.city || company.region) && (
                          <p className="text-xs text-gray-400 mt-0.5">{[company.city, company.region, company.country].filter(Boolean).join(', ')}</p>
                        )}
                      </Link>
                    )}
                    {!mergeMode && (
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button onClick={() => handleEdit(company)} className="text-gray-400 hover:text-blue-600 transition-colors p-1">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setCemeteryTarget(company)} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {!mergeMode && company.lifecycle === 'partner' && (monthsSince(company.lastOrderDate) ?? 0) >= INACTIVE_SUGGEST_MONTHS && (
                    <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
                      <span className="text-xs text-amber-700">{monthsSince(company.lastOrderDate)} hónapja nem rendelt</span>
                      <button
                        onClick={() => markInactive(company.id)}
                        className="text-xs font-medium text-amber-800 hover:underline shrink-0"
                      >
                        Inaktív?
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5 mb-3">
                    {company.phone && (
                      <a href={`tel:${company.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-600 transition-colors" onClick={e => mergeMode && e.preventDefault()}>
                        <Phone size={12} className="text-gray-400" />
                        {company.phone}
                      </a>
                    )}
                    {company.email && (
                      <a href={`mailto:${company.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors" onClick={e => mergeMode && e.preventDefault()}>
                        <Mail size={12} className="text-gray-400" />
                        <span className="truncate">{company.email}</span>
                      </a>
                    )}
                    {company.website && (
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors" onClick={e => mergeMode && e.preventDefault()}>
                        <Globe size={12} className="text-gray-400" />
                        <span className="truncate">{company.website.replace(/^https?:\/\//, '')}</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Users size={11} />
                        {company._count.contacts}
                      </div>
                      <div className="text-xs text-gray-400">{company._count.orders} rendelés</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DormancyBadge activities={company.activities} />
                      {company.language && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{company.language}</span>
                      )}
                    </div>
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
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cég</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Típus</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Helyszín</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kapcsolatok</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rendelések</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aktivitás</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">Betöltés...</td>
                  </tr>
                ) : companies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">Nem található partner</td>
                  </tr>
                ) : (
                  companies.map((company) => {
                    const cls = CLASSIFICATION_CONFIG[company.classification || 'D']
                    const isSelected = selectedIds.includes(company.id)
                    return (
                      <tr
                        key={company.id}
                        className={`hover:bg-gray-50 transition-colors ${mergeMode ? 'cursor-pointer' : ''} ${mergeMode && isSelected ? 'bg-orange-50' : ''}`}
                        onClick={mergeMode ? () => toggleSelect(company.id) : undefined}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {mergeMode && (
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                                {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                              </div>
                            )}
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${cls.color}`}>{company.classification || 'D'}</span>
                            {mergeMode ? (
                              <span className="font-medium text-gray-900 text-sm">{company.name}</span>
                            ) : (
                              <Link href={`/companies/${company.id}`} className="font-medium text-gray-900 text-sm hover:text-blue-600 transition-colors">
                                {company.name}
                              </Link>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-blue-600 font-medium">{company.partnerType || '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{[company.city, company.country].filter(Boolean).join(', ') || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Users size={11} />
                            {company._count.contacts}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{company._count.orders}</td>
                        <td className="px-4 py-3">
                          <DormancyBadge activities={company.activities} />
                        </td>
                        <td className="px-4 py-3">
                          {!mergeMode && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEdit(company)} className="text-gray-400 hover:text-blue-600 transition-colors p-1">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => setCemeteryTarget(company)} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
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
            <div className="py-12 text-center text-gray-400">Nem található partner</div>
          ) : (
            cityGroups.map(([city, items]) => {
              const isOpen = openCities.has(city)
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
                    {items[0]?.country && (
                      <span className="text-xs font-mono text-gray-400 shrink-0">{items[0].country}</span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-50">
                      {items.map((company, idx) => {
                        const cls = CLASSIFICATION_CONFIG[company.classification || 'D']
                        return (
                          <div
                            key={company.id}
                            className={`flex items-center gap-3 px-4 py-2.5 ${idx < items.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors`}
                          >
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${cls.color}`}>{company.classification || 'D'}</span>
                            <Link href={`/companies/${company.id}`} className="flex-1 min-w-0 text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors truncate">
                              {company.name}
                            </Link>
                            {company.partnerType && (
                              <span className="text-xs text-blue-600 shrink-0 hidden sm:inline">{company.partnerType}</span>
                            )}
                            <button onClick={() => handleEdit(company)} className="text-gray-400 hover:text-blue-600 transition-colors p-1 shrink-0">
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
        <Modal title={editCompany ? 'Partner szerkesztése' : 'Új partner'} onClose={handleModalClose}>
          <CompanyForm company={editCompany} onSave={() => { handleModalClose(); fetchCompanies() }} onCancel={handleModalClose} />
        </Modal>
      )}

      {showMergeModal && (
        <Modal title="Cégek egyesítése" onClose={() => setShowMergeModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Válaszd ki, melyik cég legyen a <strong>fő rekord</strong>. A többi cég összes adata (számlák, kapcsolatok, ügyletek) oda kerül, majd törlődnek.
            </p>
            <div className="space-y-2">
              {selectedCompanies.map(c => (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    masterId === c.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="master"
                    value={c.id}
                    checked={masterId === c.id}
                    onChange={() => setMasterId(c.id)}
                    className="accent-orange-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{c.name}</div>
                    {(c.city || c.country) && (
                      <div className="text-xs text-gray-500">{[c.city, c.country].filter(Boolean).join(', ')}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {c._count.contacts} kapcsolat · {c._count.orders} rendelés · {c._count.deals} ügylet
                    </div>
                  </div>
                  {masterId === c.id && (
                    <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full shrink-0">Fő rekord</span>
                  )}
                </label>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              A többi {selectedIds.length - 1} cég véglegesen törlődik az egyesítés után.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Mégse
              </button>
              <button
                onClick={handleMerge}
                disabled={!masterId || merging}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Merge size={14} />
                {merging ? 'Egyesítés...' : 'Egyesítés megerősítése'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Temetőbe helyezés — kötelező indokkal. A kuka gomb ezt nyitja. */}
      {cemeteryTarget && (
        <LostReasonModal
          entityName={cemeteryTarget.name}
          busy={cemeteryBusy}
          onCancel={() => setCemeteryTarget(null)}
          onConfirm={moveToCemetery}
        />
      )}
    </div>
  )
}
