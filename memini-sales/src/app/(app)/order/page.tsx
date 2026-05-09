'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Building2, User, ArrowRight } from 'lucide-react'
import { Background } from '@/components/Background'
import { useTheme } from '@/contexts/ThemeContext'
import { useCart } from '@/contexts/CartContext'

interface Company {
  id: string
  name: string
  city: string | null
  country: string | null
  classification: string | null
  customerNumber: string | null
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string | null
}

export default function OrderPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const { cart, saveCartToDB, clearCart, saving } = useCart()
  const [query, setQuery] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setCompanies([])
      setContacts([])
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/partners/search?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      setCompanies(data.companies ?? [])
      setContacts(data.contacts ?? [])
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  async function navigate(partnerId: string, params: URLSearchParams) {
    // If cart has items for a DIFFERENT partner → auto-save before switching
    if (cart.items.length > 0 && cart.partnerId && cart.partnerId !== partnerId) {
      await saveCartToDB()
      clearCart()
    }
    router.push(`/products?${params}`)
  }

  function selectCompany(c: Company) {
    const params = new URLSearchParams({
      partnerId: c.id,
      partnerName: c.name,
      ...(c.city ? { partnerCity: c.city } : {}),
      ...(c.country ? { partnerCountry: c.country } : {}),
    })
    navigate(c.id, params)
  }

  function selectContact(c: Contact) {
    const params = new URLSearchParams({
      partnerId: c.id,
      partnerName: `${c.firstName} ${c.lastName}`.trim(),
      partnerType: 'contact',
    })
    navigate(c.id, params)
  }

  const hasResults = companies.length > 0 || contacts.length > 0
  const searched = query.trim().length >= 2

  const cardStyle = {
    background: theme.cardBg,
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: `1px solid ${theme.cardBorder}`,
  }

  return (
    <>
      <Background />
      <div
        className="min-h-screen flex flex-col items-center px-5 md:px-10"
        style={{
          paddingTop: 'max(5rem, calc(env(safe-area-inset-top) + 3rem))',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="w-full max-w-lg">
          {/* Title */}
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: theme.textSecondary }}>
            Megrendelés
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: theme.textPrimary }}>
            Kinek szól?
          </h1>

          {/* Search input */}
          <div
            className="flex items-center gap-3 px-4 rounded-2xl"
            style={{ ...cardStyle, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <Search size={18} strokeWidth={1.8} style={{ color: theme.textSecondary, flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Cégnév, ügyfélnév vagy város..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 py-4 text-base bg-transparent focus:outline-none"
              style={{ color: theme.textPrimary }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {loading && (
              <div
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                style={{ borderColor: theme.textSecondary, borderTopColor: 'transparent' }}
              />
            )}
          </div>

          {/* Results */}
          {searched && (
            <div
              className="mt-2 rounded-2xl overflow-hidden"
              style={{ ...cardStyle, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            >
              {!hasResults && !loading ? (
                <div className="px-5 py-8 text-center text-sm" style={{ color: theme.textSecondary }}>
                  Nincs találat
                </div>
              ) : (
                <>
                  {companies.length > 0 && (
                    <>
                      {contacts.length > 0 && (
                        <div
                          className="px-5 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest"
                          style={{ color: theme.textSecondary }}
                        >
                          Cégek
                        </div>
                      )}
                      {companies.map((c, i) => (
                        <ResultRow
                          key={c.id}
                          icon={<Building2 size={16} strokeWidth={1.8} />}
                          primary={c.name}
                          secondary={[c.city, c.country].filter(Boolean).join(', ')}
                          badge={c.classification ?? undefined}
                          isLast={i === companies.length - 1 && contacts.length === 0}
                          onClick={() => selectCompany(c)}
                          theme={theme}
                        />
                      ))}
                    </>
                  )}

                  {contacts.length > 0 && (
                    <>
                      {companies.length > 0 && (
                        <div
                          className="px-5 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest"
                          style={{ color: theme.textSecondary, borderTop: `1px solid ${theme.cardBorder}` }}
                        >
                          Magánszemélyek
                        </div>
                      )}
                      {contacts.map((c, i) => (
                        <ResultRow
                          key={c.id}
                          icon={<User size={16} strokeWidth={1.8} />}
                          primary={`${c.firstName} ${c.lastName}`.trim()}
                          secondary={c.email ?? ''}
                          isLast={i === contacts.length - 1}
                          onClick={() => selectContact(c)}
                          theme={theme}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Skip */}
          <button
            onClick={() => router.push('/products')}
            className="mt-6 w-full flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-xl transition active:opacity-70"
            style={{ color: theme.textSecondary }}
          >
            Tovább megrendelő nélkül
            <ArrowRight size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </>
  )
}

function ResultRow({
  icon, primary, secondary, badge, isLast, onClick, theme,
}: {
  icon: React.ReactNode
  primary: string
  secondary?: string
  badge?: string
  isLast: boolean
  onClick: () => void
  theme: ReturnType<typeof useTheme>['theme']
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition active:opacity-60"
      style={{
        borderBottom: isLast ? 'none' : `1px solid ${theme.cardBorder}`,
      }}
    >
      <span style={{ color: theme.textSecondary, flexShrink: 0 }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: theme.textPrimary }}>{primary}</p>
        {secondary && (
          <p className="text-xs mt-0.5 truncate" style={{ color: theme.textSecondary }}>{secondary}</p>
        )}
      </div>
      {badge && (
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: theme.inputBg, color: theme.textSecondary }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
