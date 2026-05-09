'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, CheckCircle } from 'lucide-react'
import { Background } from '@/components/Background'
import { useTheme } from '@/contexts/ThemeContext'
import { useCart } from '@/contexts/CartContext'

export default function CartPage() {
  const { theme } = useTheme()
  const { cart, removeItem, clearCart, saveCartToDB, saving } = useCart()
  const router = useRouter()
  const [done, setDone] = useState(false)

  const subtotal = cart.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const vatAmount = cart.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
  const total = subtotal + vatAmount

  async function handleSubmit() {
    const ok = await saveCartToDB()
    if (ok) {
      clearCart()
      setDone(true)
    }
  }

  const cardStyle = {
    background: theme.cardBg,
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: `1px solid ${theme.cardBorder}`,
  }

  if (done) {
    return (
      <>
        <Background />
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
          <CheckCircle size={56} strokeWidth={1.2} style={{ color: theme.textPrimary }} />
          <div>
            <h2 className="text-2xl font-bold" style={{ color: theme.textPrimary }}>Megrendelés rögzítve</h2>
            <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>Bekerült a CRM-be feldolgozásra.</p>
          </div>
          <button
            onClick={() => router.push('/home')}
            className="px-8 py-3.5 rounded-2xl font-semibold text-base"
            style={{ background: theme.buttonBg, color: theme.buttonText }}
          >
            Vissza a főoldalra
          </button>
        </div>
      </>
    )
  }

  if (!cart.items.length) {
    return (
      <>
        <Background />
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-semibold" style={{ color: theme.textPrimary }}>A kosár üres</p>
          <button onClick={() => router.back()} className="text-sm" style={{ color: theme.textSecondary }}>
            ← Vissza a termékekhez
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <Background />
      <div
        className="min-h-screen flex flex-col px-4 md:px-8 lg:px-12 pb-8"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        {/* Partner info */}
        {cart.partnerName && (
          <div className="mb-4 pt-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.textSecondary }}>Megrendelő</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: theme.textPrimary }}>{cart.partnerName}</p>
            {cart.partnerCity && (
              <p className="text-sm" style={{ color: theme.textSecondary }}>{cart.partnerCity}{cart.partnerCountry ? `, ${cart.partnerCountry}` : ''}</p>
            )}
          </div>
        )}

        {/* Items */}
        <div className="rounded-2xl overflow-hidden mb-4" style={cardStyle}>
          {cart.items.map((item, i) => (
            <div
              key={item.productId}
              className="flex items-center gap-3 px-4 py-3.5"
              style={{ borderBottom: i < cart.items.length - 1 ? `1px solid ${theme.cardBorder}` : 'none' }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: theme.textPrimary }}>{item.name}</p>
                <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                  {item.quantity} {item.unit} × €{item.unitPrice.toFixed(2)}
                </p>
              </div>
              <p className="font-bold text-sm flex-shrink-0" style={{ color: theme.textPrimary }}>
                €{(item.quantity * item.unitPrice).toFixed(2)}
              </p>
              <button
                onClick={() => removeItem(item.productId)}
                className="flex-shrink-0 ml-1 p-1.5 rounded-lg"
                style={{ color: theme.textSecondary }}
              >
                <Trash2 size={15} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="rounded-2xl overflow-hidden mb-6" style={cardStyle}>
          <div className="flex justify-between px-4 py-3" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
            <p className="text-sm" style={{ color: theme.textSecondary }}>Nettó összesen</p>
            <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>€{subtotal.toFixed(2)}</p>
          </div>
          <div className="flex justify-between px-4 py-3" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
            <p className="text-sm" style={{ color: theme.textSecondary }}>ÁFA</p>
            <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>€{vatAmount.toFixed(2)}</p>
          </div>
          <div className="flex justify-between px-4 py-4">
            <p className="text-base font-bold" style={{ color: theme.textPrimary }}>Bruttó összesen</p>
            <p className="text-base font-bold" style={{ color: theme.textPrimary }}>€{total.toFixed(2)}</p>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-4 rounded-2xl font-bold text-base transition disabled:opacity-50"
          style={{ background: theme.buttonBg, color: theme.buttonText }}
        >
          {saving ? 'Mentés...' : 'Megrendelés rögzítése a CRM-be'}
        </button>
      </div>
    </>
  )
}
