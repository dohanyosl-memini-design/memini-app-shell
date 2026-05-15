'use client'

import { useState, useEffect } from 'react'
import {
  Users, Building2, TrendingUp, CheckSquare,
  FileText, AlertTriangle, TrendingDown,
  Clock, Euro,
} from 'lucide-react'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { hu } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

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
  topProducts: { name: string; sku: string; stock: number; salesPrice: number }[]
  dormantCompanies: { id: string; name: string; classification: string | null; partnerType: string | null; city: string | null }[]
  partnersByType: { partnerType: string | null; _count: number }[]
  partnersByClassification: { classification: string | null; _count: number }[]
}

const STAGE_LABELS: Record<string, string> = {
  prospect: 'Érdeklődő', qualified: 'Minősített', proposal: 'Ajánlat',
  negotiation: 'Tárgyalás', closed_won: 'Nyert', closed_lost: 'Elveszett',
}
const STAGE_COLORS: Record<string, string> = {
  prospect: '#94a3b8', qualified: '#60a5fa', proposal: '#a78bfa',
  negotiation: '#fbbf24', closed_won: '#4ade80', closed_lost: '#f87171',
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildMonthlyChart(transactions: Stats['allTransactions']) {
  const months: Record<string, { month: string; Bevétel: number; Kiadás: number }> = {}
  transactions.forEach((t) => {
    const key = format(new Date(t.date), 'yyyy-MM')
    const label = format(new Date(t.date), 'MMM', { locale: hu })
    if (!months[key]) months[key] = { month: label, Bevétel: 0, Kiadás: 0 }
    if (t.type === 'income') months[key].Bevétel += t.amount
    else months[key].Kiadás += t.amount
  })
  return Object.values(months).slice(-6)
}

function dueBadge(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isToday(d)) return { text: 'Ma', red: true }
  if (isTomorrow(d)) return { text: 'Holnap', red: false }
  if (isPast(d)) return { text: 'Lejárt', red: true }
  return { text: format(d, 'MMM d.', { locale: hu }), red: false }
}

const PRIORITY_ICON: Record<string, string> = { high: '🔴', medium: '🟡', low: '⚪' }

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then((d) => { setStats(d); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-gray-400">
        Betöltés...
      </div>
    )
  }
  if (!stats) return null

  const monthBalance = stats.monthlyIncome - stats.monthlyExpenses
  const chartData = buildMonthlyChart(stats.allTransactions)
  const activeDeals = stats.dealsByStage.filter((s) => !['closed_won', 'closed_lost'].includes(s.stage))
  const pipelineValue = activeDeals.reduce((s, d) => s + (d._sum.value || 0), 0)

  const kpis = [
    { label: 'Nyitott számlák', value: fmtEur(stats.openInvoicesTotal), sub: `${stats.openInvoicesCount} db`, icon: FileText, color: 'bg-blue-500', alert: stats.overdueInvoices > 0 ? `${stats.overdueInvoices} lejárt` : null },
    { label: 'Havi bevétel', value: fmtEur(stats.monthlyIncome), sub: stats.lastMonthIncome > 0 ? `Előző hó: ${fmtEur(stats.lastMonthIncome)}` : '', icon: Euro, color: 'bg-green-500', alert: null },
    { label: 'Havi kiadás', value: fmtEur(stats.monthlyExpenses), sub: `Egyenleg: ${fmtEur(monthBalance)}`, icon: TrendingDown, color: 'bg-red-500', alert: null },
    { label: 'Pipeline értéke', value: fmtEur(pipelineValue), sub: `${stats.totalDeals} aktív deal`, icon: TrendingUp, color: 'bg-purple-500', alert: null },
    { label: 'Ügyfelek', value: stats.totalContacts, sub: `${stats.totalCompanies} partner cég`, icon: Users, color: 'bg-indigo-500', alert: null },
    { label: 'Nyitott feladatok', value: stats.pendingTasks, sub: '', icon: CheckSquare, color: 'bg-amber-500', alert: null },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Memini Design · Ulm, Deutschland · {format(new Date(), 'yyyy. MMMM d.', { locale: hu })}</p>
      </div>

      {/* Figyelmeztetések */}
      {(stats.overdueInvoices > 0 || stats.dormantCompanies.length > 0) && (
        <div className="space-y-2">
          {stats.overdueInvoices > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} />
              <span><strong>{stats.overdueInvoices} lejárt számla</strong> vár fizetésre — ellenőrizd a Számlák menüben!</span>
            </div>
          )}
{stats.dormantCompanies.length > 0 && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
              <Building2 size={16} className="mt-0.5 shrink-0" />
              <div>
                <strong>{stats.dormantCompanies.length} szunnyadó partner</strong> — több mint 90 napja nem rendelt:{' '}
                {stats.dormantCompanies.slice(0, 4).map((c) => c.name).join(', ')}
                {stats.dormantCompanies.length > 4 && ` +${stats.dormantCompanies.length - 4} további`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI kártyák */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, color, alert }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center`}>
                <Icon size={18} className="text-white" />
              </div>
              {alert && (
                <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded-full">{alert}</span>
              )}
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Cashflow grafikon */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Havi cashflow (utolsó 6 hónap)</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `€${v}`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [`€${v.toFixed(2)}`]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Area type="monotone" dataKey="Bevétel" stroke="#4ade80" fill="#dcfce7" strokeWidth={2} />
                <Area type="monotone" dataKey="Kiadás" stroke="#f87171" fill="#fee2e2" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm py-10 text-center">Még nincs tranzakciós adat</p>
          )}
        </div>

        {/* Közelgő feladatok */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Közelgő feladatok</h2>
          <div className="space-y-3">
            {stats.upcomingTasks.slice(0, 6).map((task) => {
              const due = dueBadge(task.dueDate)
              return (
                <div key={task.id} className="flex items-start gap-2">
                  <span className="text-xs mt-0.5">{PRIORITY_ICON[task.priority]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate font-medium">{task.title}</p>
                    {task.contact && (
                      <p className="text-xs text-gray-400">{task.contact.firstName} {task.contact.lastName}</p>
                    )}
                  </div>
                  {due && (
                    <span className={`text-xs shrink-0 flex items-center gap-0.5 ${due.red ? 'text-red-600' : 'text-gray-400'}`}>
                      <Clock size={10} />{due.text}
                    </span>
                  )}
                </div>
              )
            })}
            {stats.upcomingTasks.length === 0 && <p className="text-gray-400 text-sm">Nincs közelgő feladat</p>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Sales pipeline</h2>
          <div className="space-y-2.5">
            {activeDeals.map((stage) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: STAGE_COLORS[stage.stage] }}
                />
                <span className="text-sm text-gray-600 w-24 shrink-0">{STAGE_LABELS[stage.stage]}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${pipelineValue > 0 ? Math.min(((stage._sum.value || 0) / pipelineValue) * 100, 100) : 0}%`,
                      backgroundColor: STAGE_COLORS[stage.stage],
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 shrink-0 w-28 text-right">
                  {stage._count} deal · {fmtEur(stage._sum.value || 0)}
                </span>
              </div>
            ))}
            {activeDeals.length === 0 && <p className="text-gray-400 text-sm">Nincs aktív deal</p>}
          </div>
      </div>
    </div>
  )
}
