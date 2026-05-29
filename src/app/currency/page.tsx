'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, ArrowRightLeft, Euro, DollarSign, Banknote } from 'lucide-react'

interface Rates {
  date: string
  eurHuf: number
  usdHuf: number
  eurUsd: number
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('hu-HU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtRate(n: number) {
  return n.toLocaleString('hu-HU', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

type CalcMode = 'huf-to-eur' | 'eur-to-huf' | 'huf-to-usd' | 'usd-to-huf'

export default function CurrencyPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [rates, setRates] = useState<Rates | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<CalcMode>('huf-to-eur')

  const fetchRates = useCallback(async (d: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/currency-rates?date=${d}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Hiba történt')
        setRates(null)
      } else {
        const data = await res.json()
        setRates(data)
      }
    } catch {
      setError('Hálózati hiba, kérjük próbálja újra.')
      setRates(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRates(date) }, [date, fetchRates])

  function calcResult(): string {
    if (!rates || !amount) return ''
    const n = parseFloat(amount.replace(',', '.').replace(/\s/g, ''))
    if (isNaN(n)) return ''
    switch (mode) {
      case 'huf-to-eur': return fmt(n / rates.eurHuf) + ' EUR'
      case 'eur-to-huf': return fmt(n * rates.eurHuf, 0) + ' HUF'
      case 'huf-to-usd': return fmt(n / rates.usdHuf) + ' USD'
      case 'usd-to-huf': return fmt(n * rates.usdHuf, 0) + ' HUF'
    }
  }

  const modes: { key: CalcMode; label: string; from: string; to: string }[] = [
    { key: 'huf-to-eur', label: 'HUF → EUR', from: 'HUF', to: 'EUR' },
    { key: 'eur-to-huf', label: 'EUR → HUF', from: 'EUR', to: 'HUF' },
    { key: 'huf-to-usd', label: 'HUF → USD', from: 'HUF', to: 'USD' },
    { key: 'usd-to-huf', label: 'USD → HUF', from: 'USD', to: 'HUF' },
  ]

  const result = calcResult()
  const isWeekend = rates && rates.date !== date

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Árfolyam</h1>
          <p className="text-xs md:text-sm text-gray-400 mt-0.5">MNB hivatalos középárfolyam</p>
        </div>
        <button
          onClick={() => fetchRates(date)}
          disabled={loading}
          className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Dátum választó */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
          Dátum
        </label>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={today}
            onChange={e => setDate(e.target.value)}
            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {date !== today && (
            <button
              onClick={() => setDate(today)}
              className="px-3 py-2.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              Mai nap
            </button>
          )}
        </div>
        {isWeekend && (
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-3 py-1.5 rounded-lg">
            A választott napra nincs MNB adat (hétvége / munkaszüneti nap). Legutolsó banki nap: {rates!.date}
          </p>
        )}
      </div>

      {/* Árfolyam kártyák */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
              <div className="h-7 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {rates && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {/* EUR/HUF */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Euro size={14} className="text-blue-600" />
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">EUR / HUF</p>
            </div>
            <p className="text-2xl font-bold text-blue-800 leading-none mb-1">
              {fmt(rates.eurHuf, 2)}
            </p>
            <p className="text-xs text-blue-500">Ft / 1 euró</p>
          </div>

          {/* USD/HUF */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign size={14} className="text-green-600" />
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">USD / HUF</p>
            </div>
            <p className="text-2xl font-bold text-green-800 leading-none mb-1">
              {fmt(rates.usdHuf, 2)}
            </p>
            <p className="text-xs text-green-500">Ft / 1 dollár</p>
          </div>

          {/* EUR/USD */}
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border border-purple-100 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={14} className="text-purple-600" />
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">EUR / USD</p>
            </div>
            <p className="text-2xl font-bold text-purple-800 leading-none mb-1">
              {fmtRate(rates.eurUsd)}
            </p>
            <p className="text-xs text-purple-500">USD / 1 euró</p>
          </div>
        </div>
      )}

      {/* Kalkulátor */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft size={15} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">Átváltó</h2>
        </div>

        {/* Mód gombok */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-4">
          {modes.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                mode === m.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Banknote size={16} className="text-gray-400" />
          </div>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder={`Összeg (${modes.find(m => m.key === mode)?.from})`}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Eredmény */}
        <div className={`rounded-xl px-4 py-3 transition-all ${result ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
          {result ? (
            <div>
              <p className="text-xs text-blue-600 font-medium mb-0.5">
                {amount} {modes.find(m => m.key === mode)?.from} =
              </p>
              <p className="text-2xl font-bold text-blue-800">{result}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              {!rates ? 'Árfolyam betöltése...' : 'Írj be egy összeget a számításhoz'}
            </p>
          )}
        </div>

        {rates && (
          <p className="text-xs text-gray-400 mt-3 text-center">
            Forrás: Magyar Nemzeti Bank · {rates.date}
          </p>
        )}
      </div>
    </div>
  )
}
