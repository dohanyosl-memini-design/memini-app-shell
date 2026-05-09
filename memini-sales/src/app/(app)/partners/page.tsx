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
    <div className="px-4 md:px-8 lg:px-12 pb-10">
      <h1 className="text-white text-2xl md:text-3xl font-bold mb-4 md:mb-6 mt-2">
        Partnerek
      </h1>

      <input
        type="search"
        placeholder="Keresés..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 md:py-4 bg-[#161616] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/30 mb-4 text-base"
      />

      {loading ? (
        <p className="text-white/40">Betöltés...</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/40">Nincs találat</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-[#161616] border border-white/[0.08] rounded-2xl px-5 py-4 md:px-6 md:py-5"
            >
              <p className="text-white font-semibold text-base md:text-lg">{p.name}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                {p.city && (
                  <span className="text-white/40 text-sm">
                    📍 {p.city}{p.country ? `, ${p.country}` : ''}
                  </span>
                )}
                {p.phone && (
                  <a
                    href={`tel:${p.phone}`}
                    className="text-white/40 text-sm hover:text-white/70 transition"
                  >
                    📞 {p.phone}
                  </a>
                )}
                {p.email && (
                  <a
                    href={`mailto:${p.email}`}
                    className="text-white/40 text-sm hover:text-white/70 transition"
                  >
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
