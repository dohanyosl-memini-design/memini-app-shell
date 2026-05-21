'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, FileText, Clock, Package, Users, Target,
  ShoppingCart, ChevronLeft, ChevronRight, Euro, Receipt, Percent,
  Star, BarChart2,
} from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface MonthRow {
  month: string
  monthKey: string
  income: number
  grossIncome: number
  netIncome: number
  expenses: number
  balance: number
}

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
  yearlyNetIncome: number
  yearlyNetBalance: number
  yearlyExpenses: number
  yearlyCogs: number
  yearlyOtherExpenses: number
  yearlyBalance: number
  receivedThisYear: number
  invoiceCountThisYear: number
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

function SkeletonCell() {
  return <div className="h-3 bg-gray-100 rounded w-16 ml-auto animate-pulse" />
}

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/stats?year=${year}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [year])

  function handleTouchStart(e: React.TouchEvent) { setTouchStartX(e.touches[0].clientX) }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return
    const diff = touchStartX - e.changedTouches[0].clientX
    if (Math.abs(diff) > 60) diff > 0 ? setYear(y => y + 1) : setYear(y => y - 1)
    setTouchStartX(null)
  }

  const now = new Date()
  const currentYear = now.getFullYear()

  if (error) return <div className="p-6 flex items-center justify-center h-64 text-red-400">Hiba a statisztikák betöltésekor.</div>

  const incomePct = stats ? pct(stats.combinedMonthlyIncome, stats.combinedLastMonthIncome) : null
  const expPct = stats ? pct(stats.combinedMonthlyExpenses, stats.combinedLastMonthExpenses) : null

  // Cashflow area chart data
  const chartData = Array.from({ length: 12 }, (_, m) => {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`
    const label = new Date(year, m, 1).toLocaleDateString('hu-HU', { month: 'short' })
    const entries = stats?.allCashflowEntries ?? []
    const income = entries.filter(e => e.type === 'income' && e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0)
    const expenses = entries.filter(e => e.type === 'expense' && e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0)
    return { month: label, 'Bruttó bev.': income, Kiadás: expenses }
  })

  // Derived metrics
  const collectionRate = stats && stats.yearlyIncome > 0
    ? Math.round((stats.receivedThisYear / stats.yearlyIncome) * 100) : 0
  const vatObligation = stats ? stats.yearlyIncome - (stats.yearlyNetIncome ?? stats.yearlyIncome) : 0
  const avgInvoiceValue = stats && (stats.invoiceCountThisYear ?? 0) > 0
    ? stats.yearlyIncome / stats.invoiceCountThisYear : 0
  const expenseRatio = stats && (stats.yearlyNetIncome ?? 0) > 0
    ? Math.round((stats.yearlyExpenses / stats.yearlyNetIncome) * 100) : 0
  const bestMonth = stats
    ? stats.monthlyBreakdown.reduce((best, row) => row.netIncome > (best?.netIncome ?? 0) ? row : best, stats.monthlyBreakdown[0])
    : null
  const profitMargin = stats && (stats.yearlyNetIncome ?? 0) > 0
    ? Math.round(((stats.yearlyNetBalance ?? stats.yearlyBalance) / stats.yearlyNetIncome) * 100) : 0

  return (
    <div className="p-4 md:p-6 space-y-6" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* ── Fejléc + évnavigáció ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riportok & Statisztikák</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {year === currentYear
              ? `${year}. éves áttekintés · ${format(now, 'yyyy. MMMM', { locale: hu })}`
              : `${year}. éves áttekintés · historikus riport`}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm select-none">
          <button onClick={() => setYear(y => y - 1)} className="text-gray-400 hover:text-gray-700 transition-colors p-0.5">
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-bold text-gray-900 mx-2 tabular-nums">{year}</span>
          <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear}
            className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* ── Éves összesítő KPI kártyák ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{year}. Éves összesítő</h2>

        {/* 5 kártya: Bruttó · Nettó · Termékköltség · Egyéb kiadás · Haszon */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

          {/* Bruttó bevétel */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
              <TrendingUp size={13} className="text-green-600" />
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Bruttó bevétel</p>
            <p className="text-xl font-black text-green-600 mt-1 tabular-nums">
              {loading ? <span className="text-gray-300 animate-pulse">––</span> : fmtEur(stats?.yearlyIncome ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {year === currentYear && incomePct
                ? <><span className={incomePct.up ? 'text-green-500' : 'text-red-400'}>{incomePct.up ? '↑' : '↓'}{incomePct.value}%</span> vs. előző hó</>
                : `ÁFÁ-val · ${year}`}
            </p>
          </div>

          {/* Nettó bevétel */}
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100 rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center">
              <Euro size={13} className="text-teal-600" />
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Nettó bevétel</p>
            <p className="text-xl font-black text-teal-700 mt-1 tabular-nums">
              {loading ? <span className="text-gray-300 animate-pulse">––</span> : fmtEur(stats?.yearlyNetIncome ?? stats?.yearlyIncome ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">ÁFA nélkül · {year}</p>
          </div>

          {/* Termékköltség (COGS) */}
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
              <Package size={13} className="text-red-500" />
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Termékköltség</p>
            <p className="text-xl font-black text-red-600 mt-1 tabular-nums">
              {loading ? <span className="text-gray-300 animate-pulse">––</span> : fmtEur(stats?.yearlyCogs ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {!loading && (stats?.yearlyNetIncome ?? 0) > 0
                ? `${Math.round(((stats?.yearlyCogs ?? 0) / stats!.yearlyNetIncome) * 100)}% nettó bev.`
                : 'Alapanyag · Gyártás'}
            </p>
          </div>

          {/* Egyéb kiadás */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
              <TrendingDown size={13} className="text-amber-600" />
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Egyéb kiadás</p>
            <p className="text-xl font-black text-amber-700 mt-1 tabular-nums">
              {loading ? <span className="text-gray-300 animate-pulse">––</span> : fmtEur(stats?.yearlyOtherExpenses ?? stats?.yearlyExpenses ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {!loading && (stats?.yearlyNetIncome ?? 0) > 0
                ? `${Math.round(((stats?.yearlyOtherExpenses ?? 0) / stats!.yearlyNetIncome) * 100)}% nettó bev.`
                : `Működési ktg. · ${year}`}
            </p>
          </div>

          {/* Haszon */}
          <div className={`rounded-2xl p-4 relative overflow-hidden border ${
            !loading && (stats?.yearlyNetBalance ?? 0) < 0
              ? 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-100'
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'}`}>
            <div className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center ${
              !loading && (stats?.yearlyNetBalance ?? 0) < 0 ? 'bg-orange-100' : 'bg-blue-100'}`}>
              <Star size={13} className={!loading && (stats?.yearlyNetBalance ?? 0) < 0 ? 'text-orange-600' : 'text-blue-600'} />
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">Éves haszon</p>
            <p className={`text-xl font-black mt-1 tabular-nums ${!loading && (stats?.yearlyNetBalance ?? 0) < 0 ? 'text-orange-600' : 'text-blue-600'}`}>
              {loading ? <span className="text-gray-300 animate-pulse">––</span>
                : <>{(stats?.yearlyNetBalance ?? 0) >= 0 ? '+' : ''}{fmtEur(stats?.yearlyNetBalance ?? stats?.yearlyBalance ?? 0)}</>}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {loading ? '' : `Margin: ${profitMargin}%`}
            </p>
          </div>
        </div>

        {/* ── Bevétel-összetétel skála ── */}
        {!loading && stats && (stats.yearlyNetIncome ?? 0) > 0 && (() => {
          const net = stats.yearlyNetIncome ?? stats.yearlyIncome
          const cogs = stats.yearlyCogs ?? 0
          const other = stats.yearlyOtherExpenses ?? (stats.yearlyExpenses - cogs)
          const profit = Math.max(0, net - cogs - other)
          const overflow = Math.max(0, cogs + other - net)
          const cogsW  = Math.min(100, Math.round((cogs  / net) * 100))
          const otherW = Math.min(100 - cogsW, Math.round((other / net) * 100))
          const profitW = Math.max(0, 100 - cogsW - otherW)
          return (
            <div className="mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nettó bevétel összetétele</p>
                <p className="text-xs text-gray-400">{fmtEur(net)} = 100%</p>
              </div>
              <div className="flex rounded-xl overflow-hidden h-7 gap-px">
                {cogsW > 0 && (
                  <div className="bg-red-400 flex items-center justify-center" style={{ width: `${cogsW}%` }}>
                    {cogsW >= 8 && <span className="text-white text-xs font-bold">{cogsW}%</span>}
                  </div>
                )}
                {otherW > 0 && (
                  <div className="bg-amber-400 flex items-center justify-center" style={{ width: `${otherW}%` }}>
                    {otherW >= 8 && <span className="text-white text-xs font-bold">{otherW}%</span>}
                  </div>
                )}
                {profitW > 0 && (
                  <div className="bg-blue-400 flex items-center justify-center" style={{ width: `${profitW}%` }}>
                    {profitW >= 8 && <span className="text-white text-xs font-bold">{profitW}%</span>}
                  </div>
                )}
                {overflow > 0 && (
                  <div className="bg-gray-200 flex-1 flex items-center justify-center">
                    <span className="text-gray-500 text-xs font-bold">−{Math.round((overflow/net)*100)}%</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-2.5">
                <span className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-400 shrink-0" />
                  Termékköltség {fmtEur(cogs)}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 shrink-0" />
                  Egyéb kiadás {fmtEur(other)}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 shrink-0" />
                  Haszon {fmtEur(profit)}
                </span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── Cashflow area chart ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{year}. évi havi cashflow</h2>
        {loading ? (
          <div className="h-52 flex items-center justify-center text-gray-300 text-sm animate-pulse">Betöltés...</div>
        ) : chartData.every(d => d['Bruttó bev.'] === 0 && d.Kiadás === 0) ? (
          <p className="text-sm text-gray-400 py-10 text-center">Még nincs elegendő adat ehhez az évhez.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradBev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradKiad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip formatter={(v: number) => [`€${v.toFixed(2)}`]} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend formatter={v => <span style={{ fontSize: '12px' }}>{v}</span>} />
              <Area type="monotone" dataKey="Bruttó bev." stroke="#4ade80" fill="url(#gradBev)" strokeWidth={2} />
              <Area type="monotone" dataKey="Kiadás" stroke="#f87171" fill="url(#gradKiad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Havi részletezés (teljes szélesség, 5 oszlop) ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Havi részletezés — {year}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Bruttó = ÁFÁ-val · Nettó = ÁFA nélkül · Haszon = Nettó − Kiadás</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Hónap</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Bruttó bev.</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Nettó bev.</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Kiadás</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Haszon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5"><div className="h-3 bg-gray-100 rounded w-12 animate-pulse" /></td>
                      {[1,2,3,4].map(j => <td key={j} className="px-4 py-2.5"><SkeletonCell /></td>)}
                    </tr>
                  ))
                : (stats?.monthlyBreakdown ?? []).map(row => {
                    const isCurrent = row.monthKey === format(now, 'yyyy-MM')
                    const netBalance = row.netIncome - row.expenses
                    return (
                      <tr key={row.monthKey} className={`hover:bg-gray-50/80 transition-colors ${isCurrent ? 'bg-blue-50/50' : ''}`}>
                        <td className={`px-4 py-2.5 font-medium capitalize ${isCurrent ? 'text-blue-700' : 'text-gray-700'}`}>
                          {row.month}{isCurrent && <span className="ml-1.5 text-xs text-blue-400 font-normal">← aktuális</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-green-600 tabular-nums">
                          {row.grossIncome > 0 ? fmtEur(row.grossIncome) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-emerald-700 tabular-nums font-medium">
                          {row.netIncome > 0 ? fmtEur(row.netIncome) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-red-500 tabular-nums">
                          {row.expenses > 0 ? fmtEur(row.expenses) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                          netBalance > 0 ? 'text-blue-600' : netBalance < 0 ? 'text-red-600' : 'text-gray-300'}`}>
                          {row.netIncome === 0 && row.expenses === 0 ? '—'
                            : (netBalance >= 0 ? '+' : '') + fmtEur(netBalance)}
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
            {!loading && stats && (
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Összesen</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700 tabular-nums">{fmtEur(stats.yearlyIncome)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">{fmtEur(stats.yearlyNetIncome ?? stats.yearlyIncome)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600 tabular-nums">{fmtEur(stats.yearlyExpenses)}</td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums ${(stats.yearlyNetBalance ?? stats.yearlyBalance) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {(stats.yearlyNetBalance ?? stats.yearlyBalance) >= 0 ? '+' : ''}{fmtEur(stats.yearlyNetBalance ?? stats.yearlyBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Éves összesítő boxok a táblázat alatt ── */}
        {!loading && stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-gray-100 border-t border-gray-100">
            <div className="p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Éves bruttó bevétel</p>
              <p className="text-xl font-black text-green-600">{fmtEur(stats.yearlyIncome)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stats.invoiceCountThisYear ?? '—'} számla · {year}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Éves nettó bevétel</p>
              <p className="text-xl font-black text-emerald-700">{fmtEur(stats.yearlyNetIncome ?? stats.yearlyIncome)}</p>
              <p className="text-xs text-gray-400 mt-0.5">ÁFA nélkül · {year}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Éves teljes kiadás</p>
              <p className="text-xl font-black text-red-600">{fmtEur(stats.yearlyExpenses)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Könyvelési kiadások · {year}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Éves haszon</p>
              <p className={`text-xl font-black ${(stats.yearlyNetBalance ?? stats.yearlyBalance) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {(stats.yearlyNetBalance ?? stats.yearlyBalance) >= 0 ? '+' : ''}{fmtEur(stats.yearlyNetBalance ?? stats.yearlyBalance)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Margin: {profitMargin}% · {year}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Kiegészítő mutatók ── */}
      {!loading && stats && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Kiegészítő mutatók — {year}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt size={14} className="text-indigo-500" />
                <p className="text-xs text-gray-500 font-medium">Behajtási ráta</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{collectionRate}<span className="text-sm font-normal text-gray-400 ml-0.5">%</span></p>
              <div className="h-1.5 bg-gray-100 rounded-full mt-2">
                <div className="h-1.5 rounded-full bg-indigo-400 transition-all" style={{ width: `${Math.min(collectionRate, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">Befolyt / Kiállított</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Percent size={14} className="text-amber-500" />
                <p className="text-xs text-gray-500 font-medium">Kiadás arány</p>
              </div>
              <p className={`text-2xl font-bold ${expenseRatio > 80 ? 'text-red-600' : expenseRatio > 60 ? 'text-amber-600' : 'text-gray-900'}`}>
                {expenseRatio}<span className="text-sm font-normal text-gray-400 ml-0.5">%</span>
              </p>
              <div className="h-1.5 bg-gray-100 rounded-full mt-2">
                <div className={`h-1.5 rounded-full transition-all ${expenseRatio > 80 ? 'bg-red-400' : expenseRatio > 60 ? 'bg-amber-400' : 'bg-green-400'}`}
                  style={{ width: `${Math.min(expenseRatio, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">Kiadás / Nettó bev.</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Euro size={14} className="text-blue-500" />
                <p className="text-xs text-gray-500 font-medium">Átl. számlaérték</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{avgInvoiceValue > 0 ? fmtEur(avgInvoiceValue) : '—'}</p>
              <p className="text-xs text-gray-400 mt-1">{stats.invoiceCountThisYear ?? 0} kiállított számla</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star size={14} className="text-yellow-500" />
                <p className="text-xs text-gray-500 font-medium">Legjobb hónap</p>
              </div>
              {bestMonth && bestMonth.netIncome > 0 ? (
                <>
                  <p className="text-lg font-bold text-gray-900 capitalize">{bestMonth.month}</p>
                  <p className="text-xs text-gray-400 mt-1">{fmtEur(bestMonth.netIncome)} nettó</p>
                </>
              ) : <p className="text-sm text-gray-400">Nincs adat</p>}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart2 size={14} className="text-purple-500" />
                <p className="text-xs text-gray-500 font-medium">ÁFA kötelezettség</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{vatObligation > 0 ? fmtEur(vatObligation) : '—'}</p>
              <p className="text-xs text-gray-400 mt-1">Bruttó − Nettó bev.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Raktár & Értékesítés ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Raktár & Értékesítés — {year}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><ShoppingCart size={15} className="text-blue-500" /><p className="text-xs text-gray-500 font-medium">Eladott db</p></div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '—' : (stats?.stockSoldThisYear ?? 0).toLocaleString('hu-HU')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{year}-ben kiszállított</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><Package size={15} className="text-amber-500" /><p className="text-xs text-gray-500 font-medium">Vásárolt db</p></div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '—' : (stats?.stockPurchasedThisYear ?? 0).toLocaleString('hu-HU')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{year}-ben beérkezett</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><Package size={15} className="text-purple-500" /><p className="text-xs text-gray-500 font-medium">Készlet (db)</p></div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '—' : (stats?.totalStockCount ?? 0).toLocaleString('hu-HU')}</p>
            <p className="text-xs text-gray-400 mt-0.5">jelenlegi készlet</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp size={15} className="text-green-500" /><p className="text-xs text-gray-500 font-medium">Készlet (érték)</p></div>
            <p className="text-lg font-bold text-gray-900">{loading ? '—' : fmtEur(stats?.totalStockSalesValue ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Önköltség: {loading ? '—' : fmtEur(stats?.totalStockCostValue ?? 0)}</p>
          </div>
        </div>
        {!loading && (stats?.topSellingProducts?.length ?? 0) > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Legjobban fogyó termékek — {year}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {stats!.topSellingProducts.map((p, i) => {
                const max = stats!.topSellingProducts[0]?.qty || 1
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users size={15} className="text-blue-500" /> Top 5 ügyfél
          </h2>
          {loading ? <p className="text-xs text-gray-300 animate-pulse">Betöltés...</p>
            : (stats?.topCustomers?.length ?? 0) === 0 ? <p className="text-xs text-gray-400">Nincs adat</p>
            : (
              <div className="space-y-2.5">
                {stats!.topCustomers.map((c, i) => {
                  const max = stats!.topCustomers[0]?.total || 1
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText size={15} className="text-blue-500" /> Nyitott számlák
          </h2>
          {loading ? <p className="text-xs text-gray-300 animate-pulse">Betöltés...</p>
            : (stats?.openInvoicesList?.length ?? 0) === 0 ? <p className="text-xs text-gray-400">Nincs nyitott számla.</p>
            : (
              <div className="space-y-2">
                {stats!.openInvoicesList.map(inv => {
                  const overdue = new Date(inv.dueDate) < now
                  return (
                    <div key={inv.number} className={`flex items-center justify-between p-2.5 rounded-xl ${overdue ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Target size={15} className="text-purple-500" /> Deal konverzió
            </h2>
            {loading ? <p className="text-xs text-gray-300 animate-pulse">Betöltés...</p>
              : stats?.dealWinRate !== null && stats?.dealWinRate !== undefined ? (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Nyert / Elveszett</span>
                    <span className="font-bold text-gray-900">{stats.dealWinRate}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-2 bg-green-400 rounded-full transition-all duration-500" style={{ width: `${stats.dealWinRate}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{stats.dealsWon} nyert · {stats.dealsLost} elveszett</p>
                </div>
              ) : <p className="text-xs text-gray-400">Nincs lezárt deal</p>}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
              <Clock size={15} className="text-amber-500" /> Átlagos fizetési idő
            </h2>
            {loading ? <p className="text-xs text-gray-300 animate-pulse">Betöltés...</p>
              : stats?.avgPaymentDays !== null && stats?.avgPaymentDays !== undefined
              ? <p className="text-2xl font-bold text-gray-900">{stats.avgPaymentDays} <span className="text-sm font-normal text-gray-400">nap</span></p>
              : <p className="text-xs text-gray-400">Nincs elég adat</p>}
          </div>
        </div>
      </div>

      {/* ── Inaktív partnerek ── */}
      {!loading && (stats?.dormantCompanies?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Inaktív partnerek</h2>
          <p className="text-xs text-gray-400 mb-3">90+ napja nem volt aktivitás</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats!.dormantCompanies.map(c => (
              <div key={c.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
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
