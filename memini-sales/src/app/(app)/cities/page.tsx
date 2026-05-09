'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CitiesPage() {
  const [cities, setCities] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        setCities(data.cities ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="px-4 md:px-8 lg:px-12 pb-10">
      <h1 className="text-white text-2xl md:text-3xl font-bold mb-5 md:mb-7 mt-2">
        Városok
      </h1>

      {loading ? (
        <p className="text-white/40">Betöltés...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {cities.map((city) => (
            <button
              key={city}
              onClick={() => router.push(`/products?city=${encodeURIComponent(city)}`)}
              className="bg-[#161616] border border-white/[0.08] rounded-2xl md:rounded-3xl px-5 py-5 md:px-6 md:py-6 flex items-center justify-between text-left active:scale-[0.97] transition-transform duration-150 min-h-[72px] md:min-h-[88px]"
            >
              <div className="flex items-center gap-3 md:gap-4">
                <span className="text-2xl md:text-3xl">📍</span>
                <span className="text-white font-semibold text-lg md:text-xl">{city}</span>
              </div>
              <span className="text-white/30 text-xl">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
