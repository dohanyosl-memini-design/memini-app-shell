'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface CartItem {
  productId: string
  name: string
  sku: string
  quantity: number
  unitPrice: number
  baseUnitPrice: number
  vatRate: number
  unit: string
  imageUrl: string | null
  city: string | null
}

export interface CartState {
  partnerId: string | null
  partnerName: string | null
  partnerCity: string | null
  partnerCountry: string | null
  items: CartItem[]
}

interface CartContextValue {
  cart: CartState
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  setPartner: (id: string, name: string, city?: string, country?: string) => void
  totalItems: number
  subtotal: number
  saveCartToDB: () => Promise<boolean>
  saving: boolean
}

const STORAGE_KEY = 'memini-sales-cart'

const empty: CartState = {
  partnerId: null, partnerName: null, partnerCity: null, partnerCountry: null, items: [],
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>(empty)
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setCart(JSON.parse(raw))
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
  }, [cart, hydrated])

  const addItem = useCallback((item: CartItem) => {
    setCart((prev) => {
      const idx = prev.items.findIndex((i) => i.productId === item.productId)
      if (idx >= 0) {
        const items = [...prev.items]
        items[idx] = item
        return { ...prev, items }
      }
      return { ...prev, items: [...prev.items, item] }
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => ({ ...prev, items: prev.items.filter((i) => i.productId !== productId) }))
  }, [])

  const clearCart = useCallback(() => {
    setCart(empty)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  const setPartner = useCallback((id: string, name: string, city?: string, country?: string) => {
    setCart((prev) => ({ ...prev, partnerId: id, partnerName: name, partnerCity: city ?? null, partnerCountry: country ?? null }))
  }, [])

  const saveCartToDB = useCallback(async (): Promise<boolean> => {
    if (!cart.items.length || !cart.partnerId) return true
    setSaving(true)
    try {
      const subtotal = cart.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
      const vatAmount = cart.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: cart.partnerId,
          subtotal,
          vatAmount,
          total: subtotal + vatAmount,
          items: cart.items.map((item) => ({
            productId: item.productId,
            description: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            total: item.quantity * item.unitPrice,
          })),
        }),
      })
      setSaving(false)
      return res.ok
    } catch {
      setSaving(false)
      return false
    }
  }, [cart])

  const totalItems = cart.items.length
  const subtotal = cart.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, clearCart, setPartner, totalItems, subtotal, saveCartToDB, saving }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
