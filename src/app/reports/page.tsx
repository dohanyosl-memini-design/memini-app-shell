'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

interface StatsData {
  totalContacts: number
  totalCompanies: number
  totalDeals: number
  pendingTasks: number
  wonRevenue: number
  dealsByStage: { stage: string; _count: number; _sum: { value: number | null } }[]
  contactsByStatus: { status: string; _count: number }[]
  allDeals: { value: number; stage: string; createdAt: string }[]
}

const STAGE_LABELS: Record<string, string> = {
  prospect: 'Érdeklődő',
  qualified: 'Minősített',
  proposal: 'Ajánlat',
  negotiation: 'Tárgyalás',
  closed_won: 'Nyert',
  closed_lost: 'Elveszett',
}

const STAGE_COLORS: Record<string, string> = {
  prospect: '#94a3b8',
  qualified: '#60a5fa',
  proposal: '#a78bfa',
  negotiation: '#fbbf24',
  closed_won: '#4ade80',
  closed_lost: '#f87171',
}

const STATUS_LABELS: Record<string, string> = {
  lead: 'Érdeklődő',
  active: 'Aktív',
  inactive: 'Inaktív',
}

const STATUS_COLORS = ['#fbbf24', '#4ade80', '#94a3b8']

function formatCurrency(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}e`
  return `${value}`
}

function formatCurrencyFull(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M €`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k €`
  return `${value.toFixed(2)} €`
}

export default function ReportsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        setStats(data)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-gray-400">Betöltés...</div>
      </div>
    )
  }

  if (!stats) return null

  const dealsByStageChart = stats.dealsByStage.map((d) => ({
    name: STAGE_LABELS[d.stage] || d.stage,
    érték: d._sum.value || 0,
    darab: d._count,
    color: STAGE_COLORS[d.stage] || '#94a3b8',
  }))

  const contactsByStatusChart = stats.contactsByStatus.map((c, i) => ({
    name: STATUS_LABELS[c.status] || c.status,
    value: c._count,
    color: STATUS_COLORS[i % STATUS_COLORS.length],
  }))

  const wonDeals = stats.dealsByStage.find((d) => d.stage === 'closed_won')
  const lostDeals = stats.dealsByStage.find((d) => d.stage === 'closed_lost')
  const activeDeals = stats.dealsByStage.filter(
    (d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost'
  )
  const pipelineValue = activeDeals.reduce((sum, d) => sum + (d._sum.value || 0), 0)

  const winRate = stats.totalDeals > 0
    ? Math.round(((wonDeals?._count || 0) / stats.totalDeals) * 100)
    : 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Riportok & Statisztikák</h1>
        <p className="text-gray-500 mt-1">Értékesítési teljesítmény áttekintése</p>
      </div>

      {/* KPI kártyák */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Nyert bevétel', value: formatCurrencyFull(stats.wonRevenue), color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Pipeline értéke', value: formatCurrencyFull(pipelineValue), color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Nyerési arány', value: `${winRate}%`, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Elveszett dealek', value: lostDeals?._count || 0, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-5`}>
            <p className="text-sm text-gray-600">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Deal értékek stádiumonként */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Deal értékek stádiumonként</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dealsByStageChart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrencyFull(value), 'Értéke']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Bar dataKey="érték" radius={[4, 4, 0, 0]}>
                {dealsByStageChart.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ügyfelek státusz szerint */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Ügyfelek státusz szerint</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={contactsByStatusChart}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                dataKey="value"
                paddingAngle={3}
              >
                {contactsByStatusChart.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Legend
                formatter={(value) => <span style={{ fontSize: '12px', color: '#64748b' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Deal darabszám stádiumonként */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Deal darabszám stádiumonként</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dealsByStageChart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [value, 'Dealek száma']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            />
            <Bar dataKey="darab" radius={[4, 4, 0, 0]}>
              {dealsByStageChart.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Összefoglaló táblázat */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Stádium összefoglaló</h2>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 rounded-lg">
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Stádium</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Darab</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Összérték</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Átlag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {dealsByStageChart.map((row) => (
              <tr key={row.name}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="text-sm text-gray-900">{row.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">{row.darab}</td>
                <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                  {formatCurrencyFull(row.érték)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  {row.darab > 0 ? formatCurrencyFull(row.érték / row.darab) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
