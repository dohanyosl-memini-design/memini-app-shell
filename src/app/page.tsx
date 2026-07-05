'use client'

import { useState, useEffect } from 'react'
import {
  Building2, TrendingUp, FileText, AlertTriangle, TrendingDown,
  Clock, Euro, CheckSquare, CheckCircle2, Circle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import KpiGaugeWidget from '@/components/KpiGaugeWidget'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { hu } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS, CLOSED_STAGES, normalizeStage } from '@/lib/dealStages'

interface Stats {
  totalContacts: number
  totalCompanies: number
  totalDeals: number
  pendingTasks: number
  openInvoicesTotal: number
  openInvoicesCount: number
  overdueInvoices: number
  lowStockProducts: { id: string; name: string; sku: string; stock: number; minStock: number }[]
  monthlyIncome: number
  monthlyExpenses: number
  lastMonthIncome: number
  lastMonthExpenses: number
  combinedMonthlyIncome: number
  combinedMonthlyExpenses: number
  combinedLastMonthIncome: number
  combinedLastMonthExpenses: number
  totalRevenue: number
  dealsByStage: { stage: string; _count: number; _sum: { value: number | null } }[]
  upcomingTasks: {
    id: string; title: string; dueDate: string | null; priority: string
    contact: { firstName: string; lastName: string } | null
  }[]
  recentContacts: {
    id: string; firstName: string; lastName: string; status: string
    company: { name: string } | null; createdAt: string
  }[]
  allTransactions: { type: string; amount: number; date: string; category: string | null }[]
  allCashflowEntries: { type: string; amount: number; date: string; category: string | null }[]
  topProducts: { name: string; sku: string; stock: number; salesPrice: number }[]
  dormantCompanies: { id: string; name: string; classification: string | null; partnerType: string | null; city: string | null }[]
  partnersByType: { partnerType: string | null; _count: number }[]
  partnersByClassification: { classification: string | null; _count: number }[]
  yearlyIncome: number
  yearlyExpenses: number
  yearlyBalance: number
}

const STAGE_LABELS = DEAL_STAGE_LABELS
const STAGE_COLORS = DEAL_STAGE_COLORS

function fmtEur(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildYearlyChart(transactions: Stats['allCashflowEntries'], year: number) {
  const months: Record<string, { month: string; Bevétel: number; Kiadás: number }> = {}
  for (let m = 0; m < 12; m++) {
    const date = new Date(year, m, 1)
    const key = format(date, 'yyyy-MM')
    months[key] = { month: format(date, 'MMM', { locale: hu }), Bevétel: 0, Kiadás: 0 }
  }
  transactions.forEach((t) => {
    const key = format(new Date(t.date), 'yyyy-MM')
    if (months[key]) {
      if (t.type === 'income') months[key].Bevétel += t.amount
      else months[key].Kiadás += t.amount
    }
  })
  return Object.values(months)
}

const PRIORITY_COLOR: Record<string, string> = {
  high: 'text-red-500',
  medium: 'text-amber-500',
  low: 'text-gray-300',
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set())
  const [year, setYear] = useState(new Date().getFullYear())
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/stats?year=${year}`).then((r) => r.json()).then((d) => { setStats(d); setLoading(false) })
  }, [year])

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64 text-gray-400">Betöltés...</div>
  }
  if (!stats) return null

  const combinedMonthlyIncome = stats.combinedMonthlyIncome ?? stats.monthlyIncome
  const combinedMonthlyExpenses = stats.combinedMonthlyExpenses ?? stats.monthlyExpenses
  const combinedLastMonthIncome = stats.combinedLastMonthIncome ?? stats.lastMonthIncome
  const combinedLastMonthExpenses = stats.combinedLastMonthExpenses ?? stats.lastMonthExpenses
  const monthBalance = combinedMonthlyIncome - combinedMonthlyExpenses
  const chartData = buildYearlyChart(stats.allCashflowEntries ?? stats.allTransactions, year)
  const activeDeals = stats.dealsByStage.filter((s) => !CLOSED_STAGES.includes(normalizeStage(s.stage)))
  const pipelineValue = activeDeals.reduce((s, d) => s + (d._sum.value || 0), 0)

  const todayTasks = stats.upcomingTasks.filter((t) => t.dueDate && isToday(new Date(t.dueDate)))
  const upcomingOther = stats.upcomingTasks.filter((t) => !t.dueDate || !isToday(new Date(t.dueDate)))

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX)
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return
    const diff = touchStartX - e.changedTouches[0].clientX
    if (Math.abs(diff) > 60) {
      if (diff > 0) setYear(y => y + 1)
      else setYear(y => y - 1)
    }
    setTouchStartX(null)
  }

  return (
    <div className="p-4 md:p-6 space-y-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Memini Design · Ulm, Deutschland · {format(new Date(), 'yyyy. MMMM d., EEEE', { locale: hu })}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm select-none">
          <button onClick={() => setYear(y => y - 1)} className="text-gray-400 hover:text-gray-700 transition-colors p-0.5">
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-bold text-gray-900 mx-2 tabular-nums">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="text-gray-400 hover:text-gray-700 transition-colors p-0.5">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Figyelmeztetések */}
      {(stats.overdueInvoices > 0 || stats.dormantCompanies.length > 0) && (
        <div className="space-y-2">
          {stats.overdueInvoices > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={15} className="shrink-0" />
              <span><strong>{stats.overdueInvoices} lejárt számla</strong> vár fizetésre — ellenőrizd a Számlák menüben!</span>
            </div>
          )}
          {stats.dormantCompanies.length > 0 && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
              <Building2 size={15} className="mt-0.5 shrink-0" />
              <div>
                <strong>{stats.dormantCompanies.length} szunnyadó partner</strong> — több mint 90 napja nem rendelt:{' '}
                {stats.dormantCompanies.slice(0, 4).map((c) => c.name).join(', ')}
                {stats.dormantCompanies.length > 4 && ` +${stats.dormantCompanies.length - 4} további`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Fő 60/40 elrendezés ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 items-start">

        {/* ═══ BAL OLDAL — Pénzügy (60%) ═══ */}
        <div className="lg:col-span-3 space-y-4">

          {/* Éves cashflow diagram */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Éves cashflow — {year} (havi bontás)
            </h2>
            <ResponsiveContainer width="100%" height={200}>
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
                <YAxis tickFormatter={(v) => `€${v}`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip formatter={(v: number) => [`€${v.toFixed(2)}`]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Area type="monotone" dataKey="Bevétel" stroke="#4ade80" fill="url(#gradBev)" strokeWidth={2} />
                <Area type="monotone" dataKey="Kiadás" stroke="#f87171" fill="url(#gradKiad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Éves KPI-ok */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl shadow-sm border border-green-100 p-4">
              <p className="text-xs text-gray-500 mb-1">Éves bevétel</p>
              <p className="text-lg font-bold text-green-600">{fmtEur(stats.yearlyIncome ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{year} összesen</p>
            </div>
            <div className="bg-red-50 rounded-xl shadow-sm border border-red-100 p-4">
              <p className="text-xs text-gray-500 mb-1">Éves kiadás</p>
              <p className="text-lg font-bold text-red-500">{fmtEur(stats.yearlyExpenses ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{year} összesen</p>
            </div>
            <div className={`rounded-xl shadow-sm border p-4 ${(stats.yearlyBalance ?? 0) >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
              <p className="text-xs text-gray-500 mb-1">Éves egyenleg</p>
              <p className={`text-lg font-bold ${(stats.yearlyBalance ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtEur(stats.yearlyBalance ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{year} nettó</p>
            </div>
          </div>

          {/* Kintlévőségek */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Kintlévőségek</h2>
            <div className="flex gap-4">
              <div className="flex-1 border border-gray-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-black text-gray-900">{fmtEur(stats.openInvoicesTotal)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Összes nyitott számla</p>
              </div>
              <div className="flex-1 border border-gray-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-black text-gray-900">{stats.openInvoicesCount}</p>
                <p className="text-xs text-gray-400 mt-0.5">Db nyitott számla</p>
              </div>
              <div className={`flex-1 rounded-lg p-3 text-center ${stats.overdueInvoices > 0 ? 'border border-red-200 bg-red-50' : 'border border-gray-100'}`}>
                <p className={`text-2xl font-black ${stats.overdueInvoices > 0 ? 'text-red-600' : 'text-gray-900'}`}>{stats.overdueInvoices}</p>
                <p className="text-xs text-gray-400 mt-0.5">Lejárt számla</p>
              </div>
            </div>
          </div>

          {/* Sales pipeline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Sales pipeline</h2>
              <span className="text-xs text-gray-400">{fmtEur(pipelineValue)} összesen</span>
            </div>
            <div className="space-y-2.5">
              {activeDeals.map((stage) => (
                <div key={stage.stage} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STAGE_COLORS[stage.stage] }} />
                  <span className="text-xs text-gray-500 w-20 shrink-0">{STAGE_LABELS[stage.stage]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${pipelineValue > 0 ? Math.min(((stage._sum.value || 0) / pipelineValue) * 100, 100) : 0}%`,
                        backgroundColor: STAGE_COLORS[stage.stage],
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 text-right w-24">
                    {stage._count} · {fmtEur(stage._sum.value || 0)}
                  </span>
                </div>
              ))}
              {activeDeals.length === 0 && <p className="text-gray-400 text-sm">Nincs aktív deal</p>}
            </div>
          </div>
        </div>

        {/* ═══ JOBB OLDAL — Feladatok (40%) ═══ */}
        <div className="lg:col-span-2 space-y-4">

          {/* Mai feladatok */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Mai feladatok
              </h2>
              <span className="text-xs bg-blue-100 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
                {todayTasks.length} db
              </span>
            </div>

            {todayTasks.length === 0 ? (
              <div className="py-6 text-center">
                <CheckCircle2 size={32} className="text-green-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Nincs mai feladat</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => {
                  const done = doneTaskIds.has(task.id)
                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        done ? 'border-gray-100 bg-gray-50 opacity-50' : 'border-gray-100 hover:border-blue-100 hover:bg-blue-50/30'
                      }`}
                    >
                      <button
                        onClick={() => setDoneTaskIds(prev => {
                          const next = new Set(prev)
                          if (next.has(task.id)) next.delete(task.id)
                          else next.add(task.id)
                          return next
                        })}
                        className="mt-0.5 shrink-0"
                      >
                        {done
                          ? <CheckCircle2 size={16} className="text-green-500" />
                          : <Circle size={16} className={PRIORITY_COLOR[task.priority]} />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {task.title}
                        </p>
                        {task.contact && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {task.contact.firstName} {task.contact.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Közelgő feladatok */}
          {upcomingOther.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Közelgő feladatok</h2>
              <div className="space-y-2">
                {upcomingOther.slice(0, 8).map((task) => {
                  const d = task.dueDate ? new Date(task.dueDate) : null
                  const isOverdue = d && isPast(d) && !isToday(d)
                  const isTomor = d && isTomorrow(d)
                  return (
                    <div key={task.id} className="flex items-center gap-3 py-1.5">
                      <Circle size={14} className={`shrink-0 ${PRIORITY_COLOR[task.priority]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{task.title}</p>
                        {task.contact && (
                          <p className="text-xs text-gray-400">{task.contact.firstName} {task.contact.lastName}</p>
                        )}
                      </div>
                      {d && (
                        <span className={`text-xs shrink-0 flex items-center gap-0.5 font-medium ${
                          isOverdue ? 'text-red-500' : isTomor ? 'text-amber-500' : 'text-gray-400'
                        }`}>
                          <Clock size={10} />
                          {isOverdue ? 'Lejárt' : isTomor ? 'Holnap' : format(d, 'MMM d.', { locale: hu })}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* KPI Monitor widget */}
          <KpiGaugeWidget />

          {/* Egyéb KPI-ok */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mb-2">
                <TrendingUp size={15} className="text-white" />
              </div>
              <p className="text-lg font-bold text-gray-900">{fmtEur(pipelineValue)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Pipeline érték</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center mb-2">
                <CheckSquare size={15} className="text-white" />
              </div>
              <p className="text-lg font-bold text-gray-900">{stats.pendingTasks}</p>
              <p className="text-xs text-gray-400 mt-0.5">Nyitott feladat</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mb-2">
                <Euro size={15} className="text-white" />
              </div>
              <p className="text-lg font-bold text-gray-900">{stats.openInvoicesCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Nyitott számla db</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mb-2">
                <FileText size={15} className="text-white" />
              </div>
              <p className="text-lg font-bold text-gray-900">{stats.totalDeals}</p>
              <p className="text-xs text-gray-400 mt-0.5">Aktív deal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
