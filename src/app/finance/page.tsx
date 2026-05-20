'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, TrendingUp, TrendingDown, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from '@/components/Modal'
import TransactionForm from '@/components/TransactionForm'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface Transaction {
  id: string
  type: string
  amount: number
  currency: string
  date: string
  description: string
  category: string | null
  reference: string | null
}

interface CashflowEntry {
  id: string
  source: 'transaction' | 'invoice' | 'expense'
  type: 'income' | 'expense'
  status: string | null
  amount: number
  currency: string
  date: string
  description: string
  category: string | null
  reference: string | null
}

function buildMonthlyCashflow(entries: { type: string; amount: number; date: string }[], year: string) {
  const months: Record<string, { month: string; bevétel: number; kiadás: number }> = {}
  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`
    const label = format(new Date(parseInt(year), m, 1), 'MMM', { locale: hu })
    months[key] = { month: label, bevétel: 0, kiadás: 0 }
  }
  entries.forEach((t) => {
    const key = format(new Date(t.date), 'yyyy-MM')
    if (months[key]) {
      if (t.type === 'income') months[key].bevétel += t.amount
      else months[key].kiadás += t.amount
    }
  })
  return Object.values(months)
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function sourceLabel(t: CashflowEntry) {
  if (t.status === 'overdue') return { text: 'Lejárt', cls: 'bg-red-100 text-red-700' }
  if (t.source === 'invoice' && t.status !== 'paid') return { text: 'Nyitott', cls: 'bg-amber-100 text-amber-700' }
  if (t.source === 'invoice') return { text: 'Befizetett', cls: 'bg-green-100 text-green-700' }
  if (t.source === 'expense') return { text: 'Könyvelés', cls: 'bg-red-100 text-red-600' }
  return { text: 'Manuális', cls: 'bg-gray-100 text-gray-600' }
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cashflow, setCashflow] = useState<CashflowEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))
  const [showModal, setShowModal] = useState(false)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null)
  const [defaultType, setDefaultType] = useState('income')

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/transactions${typeFilter !== 'all' ? `?type=${typeFilter}` : ''}`)
    const data = await res.json()
    setTransactions(data)
    setLoading(false)
  }, [typeFilter])

  const fetchCashflow = useCallback(async () => {
    const res = await fetch('/api/cashflow')
    const data = await res.json()
    setCashflow(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { fetchTransactions(); fetchCashflow() }, [fetchTransactions, fetchCashflow])

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törli ezt a tranzakciót?')) return
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    fetchTransactions()
    fetchCashflow()
  }

  const filteredByYear = yearFilter === 'all'
    ? cashflow
    : cashflow.filter(t => t.date.startsWith(yearFilter))

  const totalIncome = filteredByYear.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const receivedIncome = filteredByYear.filter(t => t.type === 'income' && t.status === 'paid').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = filteredByYear.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpenses

  const pendingInvoiceTotal = cashflow
    .filter(t => t.source === 'invoice' && t.status !== 'paid')
    .reduce((s, t) => s + t.amount, 0)

  const chartEntries = filteredByYear.filter(t => t.source !== 'invoice' || t.status === 'paid')
  const monthlyData = buildMonthlyCashflow(chartEntries, yearFilter === 'all' ? String(new Date().getFullYear()) : yearFilter)

  const expenseByCategory = filteredByYear
    .filter(t => t.type === 'expense' && t.category)
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category!] = (acc[t.category!] || 0) + t.amount
      return acc
    }, {})

  const currentYearStr = String(new Date().getFullYear())
  const availableYears = Array.from(new Set([currentYearStr, ...cashflow.map(t => t.date.slice(0, 4))])).sort().reverse()
  const yearIdx = availableYears.indexOf(yearFilter)

  const rows = filteredByYear
    .filter(t => typeFilter === 'all' || t.type === typeFilter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Cashflow</h1>
          <p className="text-xs md:text-sm text-gray-400 mt-0.5">Bevételek és kiadások</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setDefaultType('income'); setEditTransaction(null); setShowModal(true) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <TrendingUp size={15} />
            <span className="hidden sm:inline">Bevétel</span>
          </button>
          <button
            onClick={() => { setDefaultType('expense'); setEditTransaction(null); setShowModal(true) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm font-medium"
          >
            <TrendingDown size={15} />
            <span className="hidden sm:inline">Kiadás</span>
          </button>
          <button
            onClick={() => { setDefaultType('income'); setEditTransaction(null); setShowModal(true) }}
            className="sm:hidden flex items-center justify-center w-9 h-9 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* ── ÉV NAVIGÁCIÓ ── */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => yearIdx < availableYears.length - 1 && setYearFilter(availableYears[yearIdx + 1])}
          disabled={yearFilter === 'all' || yearIdx >= availableYears.length - 1}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={16} className="text-gray-500" />
        </button>
        <div className="flex flex-1 overflow-x-auto gap-1 scrollbar-hide">
          {['all', ...availableYears].map(y => (
            <button key={y}
              onClick={() => setYearFilter(y)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${yearFilter === y ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {y === 'all' ? 'Összes' : y}
            </button>
          ))}
        </div>
        <button
          onClick={() => yearIdx > 0 && setYearFilter(availableYears[yearIdx - 1])}
          disabled={yearFilter === 'all' || yearIdx <= 0}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={16} className="text-gray-500" />
        </button>
      </div>

      {/* ── KPI KÁRTYÁK ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={13} className="text-green-600" />
            <p className="text-xs text-green-700 font-medium">Számlázott</p>
          </div>
          <p className="text-lg md:text-xl font-bold text-green-700 leading-none">{fmtEur(totalIncome)}</p>
          <p className="text-xs text-green-500 mt-1">Beérkezett: {fmtEur(receivedIncome)}</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl border border-red-100 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown size={13} className="text-red-500" />
            <p className="text-xs text-red-600 font-medium">Kiadások</p>
          </div>
          <p className="text-lg md:text-xl font-bold text-red-600 leading-none">{fmtEur(totalExpenses)}</p>
          <p className="text-xs text-red-400 mt-1">Összes</p>
        </div>

        <div className={`rounded-2xl border p-4 ${balance >= 0 ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100' : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100'}`}>
          <p className="text-xs font-medium mb-2 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}">Egyenleg</p>
          <p className={`text-lg md:text-xl font-bold leading-none ${balance >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
            {balance >= 0 ? '+' : ''}{fmtEur(balance)}
          </p>
          <p className="text-xs mt-1 text-gray-400">Nettó</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 p-4">
          <p className="text-xs text-amber-700 font-medium mb-2">Kintlévőség</p>
          <p className="text-lg md:text-xl font-bold text-amber-600 leading-none">{fmtEur(pendingInvoiceTotal)}</p>
          <p className="text-xs text-amber-400 mt-1">Nyitott számlák</p>
        </div>
      </div>

      {/* ── GRAFIKON + KATEGÓRIÁK ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">

        {/* Grafikon — 2/3 desktop */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">
            Havi cashflow{yearFilter !== 'all' ? ` — ${yearFilter}` : ''}
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `€${v}`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`€${v.toFixed(2)}`]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Legend formatter={(v) => <span style={{ fontSize: '12px', color: '#64748b' }}>{v}</span>} />
              <Bar dataKey="bevétel" fill="#4ade80" radius={[4, 4, 0, 0]} />
              <Bar dataKey="kiadás" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Kategóriák — 1/3 desktop */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Kiadás kategóriák</h2>
          {Object.keys(expenseByCategory).length === 0 ? (
            <p className="text-gray-400 text-sm">Nincs kiadás</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(expenseByCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, amount]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 truncate">{cat}</span>
                      <span className="font-semibold text-gray-800 ml-2 shrink-0">{fmtEur(amount)}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-1.5">
                      <div className="bg-red-400 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min((amount / totalExpenses) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── SZŰRŐ ── */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {[['all', 'Összes'], ['income', 'Bevételek'], ['expense', 'Kiadások']].map(([val, label]) => (
            <button key={val} onClick={() => setTypeFilter(val)}
              className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors ${typeFilter === val ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{rows.length} tétel</span>
      </div>

      {/* ── TRANZAKCIÓ LISTA ── */}
      {loading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Betöltés...</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">Nincs bejegyzés</div>
      ) : (
        <>
          {/* Desktop: tábla */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Dátum</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Leírás</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Forrás</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Kategória</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Ref.</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Összeg</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((t) => {
                  const isPending = t.source === 'invoice' && t.status !== 'paid'
                  const isOverdue = t.status === 'overdue'
                  const src = sourceLabel(t)
                  return (
                    <tr key={`${t.source}-${t.id}`}
                      className={`transition-colors ${isOverdue ? 'bg-red-50/60 hover:bg-red-50' : isPending ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-gray-50/80'}`}>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{format(new Date(t.date), 'yyyy.MM.dd')}</td>
                      <td className="px-5 py-3.5">
                        <p className={`text-sm font-medium ${isPending ? 'text-gray-400' : 'text-gray-900'}`}>{t.description}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${src.cls}`}>{src.text}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {t.category && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{t.category}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 font-mono">{t.reference || '—'}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`text-sm font-bold ${isPending ? 'text-amber-500' : t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                          {t.type === 'income' ? '+' : '−'}{fmtEur(t.amount)}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        {t.source === 'transaction' && (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => { const tx = transactions.find(x => x.id === t.id); if (tx) { setEditTransaction(tx); setShowModal(true) } }}
                              className="p-1 text-gray-300 hover:text-blue-500 transition-colors"><Edit2 size={13} /></button>
                            <button onClick={() => handleDelete(t.id)}
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobil: kártyák */}
          <div className="md:hidden space-y-2">
            {rows.map((t) => {
              const isPending = t.source === 'invoice' && t.status !== 'paid'
              const src = sourceLabel(t)
              return (
                <div key={`${t.source}-${t.id}`}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex">
                  {/* Bal oldali szín sáv */}
                  <div className={`w-1 shrink-0 ${isPending ? 'bg-amber-400' : t.type === 'income' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="flex-1 px-3.5 py-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{t.description}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400">{format(new Date(t.date), 'yyyy. MMM d.', { locale: hu })}</span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${src.cls}`}>{src.text}</span>
                          {t.category && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{t.category}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-base font-bold ${isPending ? 'text-amber-500' : t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                          {t.type === 'income' ? '+' : '−'}{fmtEur(t.amount)}
                        </p>
                        {t.source === 'transaction' && (
                          <div className="flex items-center gap-1 justify-end mt-1">
                            <button onClick={() => { const tx = transactions.find(x => x.id === t.id); if (tx) { setEditTransaction(tx); setShowModal(true) } }}
                              className="p-1 text-gray-300 hover:text-blue-500"><Edit2 size={12} /></button>
                            <button onClick={() => handleDelete(t.id)}
                              className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {showModal && (
        <Modal title={editTransaction ? 'Tranzakció szerkesztése' : 'Új tranzakció'} onClose={() => { setShowModal(false); setEditTransaction(null) }}>
          <TransactionForm
            transaction={editTransaction}
            defaultType={defaultType}
            onSave={() => { setShowModal(false); setEditTransaction(null); fetchTransactions() }}
            onCancel={() => { setShowModal(false); setEditTransaction(null) }}
          />
        </Modal>
      )}
    </div>
  )
}
