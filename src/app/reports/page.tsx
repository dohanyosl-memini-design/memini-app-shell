'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, FileText, Clock, Package, Users, Target, ShoppingCart,
} from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface MonthRow { month: string; monthKey: string; income: number; expenses: number; balance: number }

interface StatsData {
  openInvoicesTotal: number
  openInvoicesCount: number
  overdueInvoices: number
  openInvoicesList: { total: number; number: string; dueDate: string; company: { name: string } | null }[]
  totalStockCostValue: number
  totalStockSalesValue: number
  totalStockCount: number
  combinedMonthlyIncome: number
  combinedMonthlyExpenses: number
  combinedLastMonthIncome: number
  combinedLastMonthExpenses: number
  allCashflowEntries: { type: string; amount: number; date: string; category: string | null }[]
  dormantCompanies: { id: string; name: string; classification: string | null; city: string | null }[]
  yearlyIncome: number
  yearlyExpenses: number
  yearlyBalance: number
  monthlyBreakdown: MonthRow[]
  stockSoldThisYear: number
  stockPurchasedThisYear: number
  topCustomers: { name: string; total: number; count: number }[]
  dealWinRate: number | null
  dealsWon: number
  dealsLost: number
  avgPaymentDays: number | null
  topSellingProducts: { name: string; sku: string; qty: number }[]
  topProductsByValue: { name: string; sku: string; stock: number; salesPrice: number; costPrice: number }[]
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) return <div className="p-6 flex items-center justify-center h-64 text-gray-400">Betöltés...</div>
  if (error || !stats) return <div className="p-6 flex items-center justify-center h-64 text-red-400">Hiba a statisztikák betöltésekor.</div>

  const now = new Date()
  const currentYear = now.getFullYear()
  const incomePct = pct(stats.combinedMonthlyIncome, stats.combinedLastMonthIncome)
  const expPct = pct(stats.combinedMonthlyExpenses, stats.combinedLastMonthExpenses)
  const chartData = stats.monthlyBreakdown.map(m => ({ month: m.month, Bevétel: m.income, Kiadás: m.expenses }))

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Riportok & Statisztikák</h1>
        <p className="text-gray-500 mt-1">{currentYear}. éves áttekintés · {format(now, 'yyyy. MMMM', { locale: hu })}</p>
      </div>

      {/* ── Éves összesítő ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{currentYear}. Éves összesítő</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-green-50 border border-green-100 rounded-xl p-5">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Éves bevétel</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{fmtEur(stats.yearlyIncome)}</p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <TrendingUp size={11} /> Havi: {fmtEur(stats.combinedMonthlyIncome)}
              {incomePct && <span className={incomePct.up ? 'text-green-500' : 'text-red-400'}> ({incomePct.up ? '+' : '-'}{incomePct.value}%)</span>}
            </p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-5">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Éves kiadás</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{fmtEur(stats.yearlyExpenses)}</p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <TrendingDown size={11} /> Havi: {fmtEur(stats.combinedMonthlyExpenses)}
              {expPct && <span className={!expPct.up ? 'text-green-500' : 'text-red-400'}> ({expPct.up ? '+' : '-'}{expPct.value}%)</span>}
            </p>
          </div>
          <div className={`border rounded-xl p-5 ${stats.yearlyBalance >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Éves egyenleg</p>
            <p className={`text-2xl font-bold mt-1 ${stats.yearlyBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {stats.yearlyBalance >= 0 ? '+' : ''}{fmtEur(stats.yearlyBalance)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Nettó profit {currentYear}</p>
          </div>
          <div className={`border rounded-xl p-5 ${stats.overdueInvoices > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nyitott számlák</p>
            <p className={`text-2xl font-bold mt-1 ${stats.overdueInvoices > 0 ? 'text-red-600' : 'text-gray-800'}`}>{fmtEur(stats.openInvoicesTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {stats.openInvoicesCount} db{stats.overdueInvoices > 0 && <span className="text-red-500 font-medium ml-1">· {stats.overdueInvoices} lejárt!</span>}
            </p>
          </div>
        </div>
      </div>

      {/* ── Havi cashflow grafikon ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{currentYear}. évi havi cashflow</h2>
        {chartData.every(d => d.Bevétel === 0 && d.Kiadás === 0) ? (
          <p className="text-sm text-gray-400 py-10 text-center">Még nincs elegendő adat.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`€${v.toFixed(2)}`]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend formatter={v => <span style={{ fontSize: '12px' }}>{v}</span>} />
              <Bar dataKey="Bevétel" fill="#4ade80" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Kiadás" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Havi bontás táblázat ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Havi részletezés — {currentYear}</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Hónap</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Bevétel</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Kiadás</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Egyenleg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {stats.monthlyBreakdown.map(row => (
              <tr key={row.monthKey} className={`hover:bg-gray-50 ${row.monthKey === format(now, 'yyyy-MM') ? 'bg-blue-50/40 font-medium' : ''}`}>
                <td className="px-5 py-2.5 text-gray-700 capitalize">{row.month}</td>
                <td className="px-5 py-2.5 text-right text-green-600">{row.income > 0 ? fmtEur(row.income) : '—'}</td>
                <td className="px-5 py-2.5 text-right text-red-500">{row.expenses > 0 ? fmtEur(row.expenses) : '—'}</td>
                <td className={`px-5 py-2.5 text-right font-medium ${row.balance > 0 ? 'text-green-700' : row.balance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {row.income === 0 && row.expenses === 0 ? '—' : (row.balance >= 0 ? '+' : '') + fmtEur(row.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td className="px-5 py-2.5 text-xs font-bold text-gray-700 uppercase">Összesen</td>
              <td className="px-5 py-2.5 text-right font-bold text-green-700">{fmtEur(stats.yearlyIncome)}</td>
              <td className="px-5 py-2.5 text-right font-bold text-red-600">{fmtEur(stats.yearlyExpenses)}</td>
              <td className={`px-5 py-2.5 text-right font-bold ${stats.yearlyBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {stats.yearlyBalance >= 0 ? '+' : ''}{fmtEur(stats.yearlyBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Raktár & Értékesítés ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Raktár & Értékesítés — {currentYear}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><ShoppingCart size={15} className="text-blue-500" /><p className="text-xs text-gray-500 font-medium">Eladott db</p></div>
            <p className="text-2xl font-bold text-gray-900">{stats.stockSoldThisYear.toLocaleString('hu-HU')}</p>
            <p className="text-xs text-gray-400 mt-0.5">idén kiszállított</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><Package size={15} className="text-amber-500" /><p className="text-xs text-gray-500 font-medium">Vásárolt db</p></div>
            <p className="text-2xl font-bold text-gray-900">{stats.stockPurchasedThisYear.toLocaleString('hu-HU')}</p>
            <p className="text-xs text-gray-400 mt-0.5">idén beérkezett</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><Package size={15} className="text-purple-500" /><p className="text-xs text-gray-500 font-medium">Készlet (db)</p></div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalStockCount.toLocaleString('hu-HU')}</p>
            <p className="text-xs text-gray-400 mt-0.5">jelenlegi készlet</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp size={15} className="text-green-500" /><p className="text-xs text-gray-500 font-medium">Készlet (érték)</p></div>
            <p className="text-lg font-bold text-gray-900">{fmtEur(stats.totalStockSalesValue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Önköltség: {fmtEur(stats.totalStockCostValue)}</p>
          </div>
        </div>
        {stats.topSellingProducts.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Legjobban fogyó termékek — {currentYear}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {stats.topSellingProducts.map((p, i) => {
                const max = stats.topSellingProducts[0]?.qty || 1
                return (
                  <div key={p.sku} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-700 truncate">{p.name}</span>
                        <span className="font-semibold text-gray-900 ml-2 shrink-0">{p.qty.toLocaleString('hu-HU')} db</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-blue-400 rounded-full" style={{ width: `${(p.qty / max) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Üzleti mutatók ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users size={15} className="text-blue-500" /> Top 5 ügyfél
          </h2>
          {stats.topCustomers.length === 0 ? (
            <p className="text-xs text-gray-400">Nincs adat</p>
          ) : (
            <div className="space-y-2.5">
              {stats.topCustomers.map((c, i) => {
                const max = stats.topCustomers[0]?.total || 1
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-700 truncate max-w-[60%]">{c.name}</span>
                      <span className="font-semibold text-gray-900">{fmtEur(c.total)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 bg-green-400 rounded-full" style={{ width: `${(c.total / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText size={15} className="text-blue-500" /> Nyitott számlák
          </h2>
          {stats.openInvoicesList.length === 0 ? (
            <p className="text-xs text-gray-400">Nincs nyitott számla.</p>
          ) : (
            <div className="space-y-2">
              {stats.openInvoicesList.map(inv => {
                const overdue = new Date(inv.dueDate) < now
                return (
                  <div key={inv.number} className={`flex items-center justify-between p-2.5 rounded-lg ${overdue ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                    <div>
                      <p className="text-xs font-mono font-semibold text-gray-800">{inv.number}</p>
                      <p className="text-xs text-gray-500">{inv.company?.name || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{fmtEur(inv.total)}</p>
                      <p className={`text-xs flex items-center gap-1 justify-end ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        {overdue && <Clock size={10} />}{format(new Date(inv.dueDate), 'MM.dd.')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Target size={15} className="text-purple-500" /> Deal konverzió
            </h2>
            {stats.dealWinRate !== null ? (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Nyert / Elveszett</span>
                  <span className="font-bold text-gray-900">{stats.dealWinRate}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-2 bg-green-400 rounded-full" style={{ width: `${stats.dealWinRate}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{stats.dealsWon} nyert · {stats.dealsLost} elveszett</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Nincs lezárt deal</p>
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
              <Clock size={15} className="text-amber-500" /> Átlagos fizetési idő
            </h2>
            {stats.avgPaymentDays !== null ? (
              <p className="text-2xl font-bold text-gray-900">{stats.avgPaymentDays} <span className="text-sm font-normal text-gray-400">nap</span></p>
            ) : (
              <p className="text-xs text-gray-400">Nincs elég adat</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Inaktív partnerek ── */}
      {stats.dormantCompanies.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Inaktív partnerek</h2>
          <p className="text-xs text-gray-400 mb-3">90+ napja nem volt aktivitás</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.dormantCompanies.map(c => (
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
