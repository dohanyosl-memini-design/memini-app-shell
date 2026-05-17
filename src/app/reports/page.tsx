'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, Package, FileText, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface StatsData {
  openInvoicesTotal: number
  openInvoicesCount: number
  overdueInvoices: number
  openInvoicesList: { total: number; number: string; dueDate: string; company: { name: string } | null }[]
  lowStockProducts: { id: string; name: string; sku: string; stock: number; minStock: number }[]
  topProductsByValue: { name: string; sku: string; stock: number; salesPrice: number; costPrice: number }[]
  totalStockCostValue: number
  totalStockSalesValue: number
  monthlyIncome: number
  monthlyExpenses: number
  lastMonthIncome: number
  lastMonthExpenses: number
  totalRevenue: number
  allTransactions: { type: string; amount: number; date: string; category: string | null }[]
  dormantCompanies: { id: string; name: string; classification: string | null; city: string | null }[]
  combinedMonthlyIncome: number
  combinedMonthlyExpenses: number
  combinedLastMonthIncome: number
  combinedLastMonthExpenses: number
  allCashflowEntries: { type: string; amount: number; date: string; category: string | null }[]
}

function buildMonthlyCashflow(transactions: StatsData['allTransactions']) {
  const months: Record<string, { month: string; Bevétel: number; Kiadás: number }> = {}
  transactions.forEach((t) => {
    const key = format(new Date(t.date), 'yyyy-MM')
    const label = format(new Date(t.date), 'MMM yy', { locale: hu })
    if (!months[key]) months[key] = { month: label, Bevétel: 0, Kiadás: 0 }
    if (t.type === 'income') months[key].Bevétel += t.amount
    else months[key].Kiadás += t.amount
  })
  const sorted = Object.entries(months).sort(([a], [b]) => a.localeCompare(b))
  return sorted.slice(-6).map(([, v]) => v)
}

function pct(current: number, prev: number) {
  if (!prev) return null
  const d = ((current - prev) / prev) * 100
  return { value: Math.abs(d).toFixed(0), up: d >= 0 }
}

export default function ReportsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => { setStats(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) return <div className="p-4 md:p-6 flex items-center justify-center h-64 text-gray-400">Betöltés...</div>
  if (error || !stats) return <div className="p-4 md:p-6 flex items-center justify-center h-64 text-red-400">Hiba a statisztikák betöltésekor.</div>

  const thisMonthBalance = stats.combinedMonthlyIncome - stats.combinedMonthlyExpenses
  const lastMonthBalance = stats.combinedLastMonthIncome - stats.combinedLastMonthExpenses
  const incomePct = pct(stats.combinedMonthlyIncome, stats.combinedLastMonthIncome)
  const expPct = pct(stats.combinedMonthlyExpenses, stats.combinedLastMonthExpenses)
  const monthlyData = buildMonthlyCashflow(stats.allCashflowEntries)
  const now = new Date()

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Riportok & Statisztikák</h1>
        <p className="text-gray-500 mt-1">{format(now, 'yyyy. MMMM', { locale: hu })} – aktuális üzleti áttekintés</p>
      </div>

      {/* ── KPI sor ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Havi bevétel */}
        <div className="bg-green-50 border border-green-100 rounded-xl p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Havi bevétel</p>
          <p className="text-2xl font-bold text-green-600 mt-1">€{stats.combinedMonthlyIncome.toFixed(2)}</p>
          {incomePct && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${incomePct.up ? 'text-green-600' : 'text-red-500'}`}>
              {incomePct.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {incomePct.value}% előző hónaphoz képest
            </p>
          )}
        </div>

        {/* Havi kiadás */}
        <div className="bg-red-50 border border-red-100 rounded-xl p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Havi kiadás</p>
          <p className="text-2xl font-bold text-red-500 mt-1">€{stats.combinedMonthlyExpenses.toFixed(2)}</p>
          {expPct && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${!expPct.up ? 'text-green-600' : 'text-red-500'}`}>
              {expPct.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {expPct.value}% előző hónaphoz képest
            </p>
          )}
        </div>

        {/* Havi egyenleg */}
        <div className={`border rounded-xl p-5 ${thisMonthBalance >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Havi egyenleg</p>
          <p className={`text-2xl font-bold mt-1 ${thisMonthBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            €{thisMonthBalance.toFixed(2)}
          </p>
          {lastMonthBalance !== 0 && (
            <p className="text-xs text-gray-400 mt-1">Előző hó: €{lastMonthBalance.toFixed(0)}</p>
          )}
        </div>

        {/* Nyitott számlák */}
        <div className={`border rounded-xl p-5 ${stats.overdueInvoices > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nyitott számlák</p>
          <p className={`text-2xl font-bold mt-1 ${stats.overdueInvoices > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            €{stats.openInvoicesTotal.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.openInvoicesCount} db · {stats.overdueInvoices > 0
              ? <span className="text-red-500 font-medium">{stats.overdueInvoices} lejárt!</span>
              : 'mind határidőn belül'}
          </p>
        </div>
      </div>

      {/* ── Cashflow grafikon ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Havi cashflow (utolsó 6 hónap)</h2>
        {monthlyData.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">Még nincs elegendő adat a grafikonhoz.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `€${v}`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`€${v.toFixed(2)}`]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend formatter={(v) => <span style={{ fontSize: '12px' }}>{v}</span>} />
              <Bar dataKey="Bevétel" fill="#4ade80" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Kiadás" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* ── Nyitott számlák listája ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-blue-500" /> Nyitott számlák
          </h2>
          {stats.openInvoicesList.length === 0 ? (
            <p className="text-sm text-gray-400">Nincs nyitott számla.</p>
          ) : (
            <div className="space-y-2">
              {stats.openInvoicesList.map((inv) => {
                const overdue = new Date(inv.dueDate) < now
                return (
                  <div key={inv.number} className={`flex items-center justify-between p-3 rounded-lg ${overdue ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                    <div>
                      <p className="text-sm font-mono font-semibold text-gray-800">{inv.number}</p>
                      <p className="text-xs text-gray-500">{inv.company?.name || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">€{inv.total.toFixed(2)}</p>
                      <p className={`text-xs flex items-center gap-1 justify-end ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        {overdue && <Clock size={10} />}
                        {format(new Date(inv.dueDate), 'MM.dd.')} határidő
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Top termékek készletérték szerint ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Package size={16} className="text-blue-500" /> Top termékek készletértéke
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Önköltség: €{stats.totalStockCostValue.toFixed(0)} · Eladási érték: €{stats.totalStockSalesValue.toFixed(0)}
          </p>
          <div className="space-y-2">
            {stats.topProductsByValue.map((p) => {
              const val = p.stock * p.salesPrice
              const maxVal = stats.topProductsByValue[0]?.stock * stats.topProductsByValue[0]?.salesPrice || 1
              return (
                <div key={p.sku}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 truncate max-w-[60%]">{p.name}</span>
                    <span className="font-semibold text-gray-900 shrink-0">€{val.toFixed(0)} <span className="text-gray-400 font-normal text-xs">({p.stock} db)</span></span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5">
                    <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${(val / maxVal) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Alacsony készlet ── */}
      {stats.lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-red-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> Alacsony készlet – rendelj utána!
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.lowStockProducts.map((p) => (
              <div key={p.id} className="bg-white border border-red-100 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                <p className="text-sm font-bold text-red-600 mt-1">{p.stock} db <span className="text-xs font-normal text-gray-400">(min: {p.minStock})</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Inaktív partnerek ── */}
      {stats.dormantCompanies.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Inaktív partnerek</h2>
          <p className="text-xs text-gray-400 mb-4">90+ napja nem volt aktivitás</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.dormantCompanies.map((c) => (
              <div key={c.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                <p className="text-xs text-gray-400">{c.city || '—'}</p>
                {c.classification && (
                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded mt-1 inline-block">{c.classification}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
