'use client'

import { useEffect, useState } from 'react'

interface Partner {
  id: string
  name: string
  city: string | null
  country: string | null
  email: string | null
  phone: string | null
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/partners')
      .then((r) => r.json())
      .then((data) => {
        setPartners(data.partners ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = partners.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.city ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="px-4 pb-8">
      <h1 className="text-white text-2xl font-bold mb-4 mt-2">Partnerek</h1>

      <input
        type="search"
        placeholder="Keresés..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 bg-[#161616] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/30 mb-4 text-base"
      />

      {loading ? (
        <p className="text-white/40">Betöltés...</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/40">Nincs találat</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-[#161616] border border-white/8 rounded-2xl px-5 py-4"
            >
              <p className="text-white font-semibold text-base">{p.name}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {p.city && (
                  <span className="text-white/40 text-sm">📍 {p.city}{p.country ? `, ${p.country}` : ''}</span>
                )}
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="text-white/40 text-sm hover:text-white/70">
                    📞 {p.phone}
                  </a>
                )}
                {p.email && (
                  <a href={`mailto:${p.email}`} className="text-white/40 text-sm hover:text-white/70">
                    ✉️ {p.email}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
