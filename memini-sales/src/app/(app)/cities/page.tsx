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
    <div className="px-4 pb-8">
      <h1 className="text-white text-2xl font-bold mb-6 mt-2">Városok</h1>
      {loading ? (
        <p className="text-white/40">Betöltés...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {cities.map((city) => (
            <button
              key={city}
              onClick={() => router.push(`/products?city=${encodeURIComponent(city)}`)}
              className="w-full bg-[#161616] border border-white/8 rounded-2xl px-5 py-4 flex items-center justify-between text-left active:scale-95 transition-transform"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📍</span>
                <span className="text-white font-semibold text-lg">{city}</span>
              </div>
              <span className="text-white/30 text-lg">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
