'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, TrendingUp, TrendingDown, Edit2, Trash2 } from 'lucide-react'
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
  amount: number
  currency: string
  date: string
  description: string
  category: string | null
  reference: string | null
}

const CATEGORY_COLORS: Record<string, string> = {
  Értékesítés: 'bg-green-100 text-green-700',
  Előleg: 'bg-teal-100 text-teal-700',
  Gyártás: 'bg-blue-100 text-blue-700',
  Alapanyag: 'bg-purple-100 text-purple-700',
  Szállítás: 'bg-amber-100 text-amber-700',
  Marketing: 'bg-pink-100 text-pink-700',
  Szoftver: 'bg-indigo-100 text-indigo-700',
  Iroda: 'bg-gray-100 text-gray-600',
  Egyéb: 'bg-gray-100 text-gray-600',
}

function buildMonthlyCashflow(transactions: { type: string; amount: number; date: string }[]) {
  const months: Record<string, { month: string; bevétel: number; kiadás: number }> = {}

  transactions.forEach((t) => {
    const key = format(new Date(t.date), 'yyyy-MM')
    const label = format(new Date(t.date), 'MMM', { locale: hu })
    if (!months[key]) months[key] = { month: label, bevétel: 0, kiadás: 0 }
    if (t.type === 'income') months[key].bevétel += t.amount
    else months[key].kiadás += t.amount
  })

  return Object.values(months).slice(-6)
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cashflow, setCashflow] = useState<CashflowEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
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

  const totalIncome = cashflow.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = cashflow.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpenses
  const monthlyData = buildMonthlyCashflow(cashflow)

  const expenseByCategory = cashflow
    .filter((t) => t.type === 'expense' && t.category)
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category!] = (acc[t.category!] || 0) + t.amount
      return acc
    }, {})

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pénzügy & Cashflow</h1>
          <p className="text-gray-500 mt-1">Bevételek és kiadások nyilvántartása</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setDefaultType('income'); setEditTransaction(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <TrendingUp size={16} />
            Bevétel
          </button>
          <button
            onClick={() => { setDefaultType('expense'); setEditTransaction(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <TrendingDown size={16} />
            Kiadás
          </button>
        </div>
      </div>

      {/* KPI sáv */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 rounded-xl border border-green-100 p-5">
          <p className="text-sm text-gray-600">Összes bevétel</p>
          <p className="text-2xl font-bold text-green-600 mt-1">€{totalIncome.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-5">
          <p className="text-sm text-gray-600">Összes kiadás</p>
          <p className="text-2xl font-bold text-red-600 mt-1">€{totalExpenses.toFixed(2)}</p>
        </div>
        <div className={`rounded-xl border p-5 ${balance >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
          <p className="text-sm text-gray-600">Egyenleg</p>
          <p className={`text-2xl font-bold mt-1 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            €{balance.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Cashflow grafikon */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Havi cashflow</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `€${v}`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`€${v.toFixed(2)}`]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend formatter={(v) => <span style={{ fontSize: '12px' }}>{v}</span>} />
              <Bar dataKey="bevétel" fill="#4ade80" radius={[3, 3, 0, 0]} />
              <Bar dataKey="kiadás" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Kiadás kategóriák */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Kiadás kategóriák</h2>
          <div className="space-y-2">
            {Object.entries(expenseByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{cat}</span>
                    <span className="font-medium text-gray-900">€{amount.toFixed(0)}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-red-400 h-1.5 rounded-full"
                      style={{ width: `${Math.min((amount / totalExpenses) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            {Object.keys(expenseByCategory).length === 0 && (
              <p className="text-gray-400 text-sm">Nincs kiadás</p>
            )}
          </div>
        </div>
      </div>

      {/* Szűrők */}
      <div className="flex gap-3 mb-4">
        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
          {[['all', 'Összes'], ['income', 'Bevételek'], ['expense', 'Kiadások']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTypeFilter(val)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${typeFilter === val ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tranzakció lista */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Dátum</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Leírás</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Forrás</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Kategória</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Referencia</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Összeg</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Műveletek</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Betöltés...</td></tr>
            ) : cashflow.filter(t => typeFilter === 'all' || t.type === typeFilter).length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Nincs bejegyzés</td></tr>
            ) : cashflow.filter(t => typeFilter === 'all' || t.type === typeFilter).map((t) => (
              <tr key={`${t.source}-${t.id}`} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 text-sm text-gray-600">
                  {format(new Date(t.date), 'yyyy.MM.dd')}
                </td>
                <td className="px-5 py-3.5">
                  <p className="text-sm font-medium text-gray-900">{t.description}</p>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    t.source === 'invoice' ? 'bg-green-100 text-green-700' :
                    t.source === 'expense' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {t.source === 'invoice' ? 'Számla' : t.source === 'expense' ? 'Könyvelés' : 'Manuális'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {t.category && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category] || 'bg-gray-100 text-gray-600'}`}>
                      {t.category}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-400 font-mono">{t.reference || '-'}</td>
                <td className="px-5 py-3.5 text-right">
                  <span className={`text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}€{t.amount.toFixed(2)}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-center gap-2">
                    {t.source === 'transaction' && (
                      <>
                        <button onClick={() => { const tx = transactions.find(x => x.id === t.id); if (tx) { setEditTransaction(tx); setShowModal(true) } }} className="text-gray-400 hover:text-blue-600 transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
