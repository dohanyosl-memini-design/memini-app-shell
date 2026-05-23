'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3, RefreshCw, Camera, TrendingUp, TrendingDown, Minus,
  Euro, Users, Calendar, UserPlus, ShoppingCart, FileText, Repeat2,
  Edit3, Check, X,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  annualRevenue: number
  monthlyRevenue: number
  openInvoicesValue: number
  openInvoicesCount: number
  activePartners: number
  newPartnersMonth: number
  avgOrderValue: number
  reorderRate: number
  monthlyBreakdown: { m: number; revenue: number }[]
  year: number
  month: number
  calculatedAt: string
}

interface Targets {
  annual_revenue: number
  monthly_revenue: number
  active_partners: number
  new_partners_month: number
  avg_order_value: number
  reorder_rate: number
}

interface Snapshot {
  id: string
  month: string
  data: KpiData
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(value: number, target: number) {
  if (!target) return 0
  return Math.min(999, (value / target) * 100)
}

function color(p: number): { bg: string; bar: string; text: string; badge: string } {
  if (p >= 70) return { bg: 'bg-green-50', bar: 'bg-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800' }
  if (p >= 25) return { bg: 'bg-amber-50', bar: 'bg-amber-400', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' }
  return { bg: 'bg-red-50', bar: 'bg-red-400', text: 'text-red-700', badge: 'bg-red-100 text-red-800' }
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtEur(n: number) {
  return `€${fmt(Math.round(n))}`
}

const MONTH_NAMES = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec']

// ─── Semicircle Gauge ─────────────────────────────────────────────────────────

function SemiGauge({ percent, label, value }: { percent: number; label: string; value: string }) {
  const p = Math.min(100, Math.max(0, percent))
  const cx = 100, cy = 100, r = 75
  const angle = Math.PI * (1 - p / 100)
  const endX = cx + r * Math.cos(angle)
  const endY = cy - r * Math.sin(angle)
  const largeArc = p > 50 ? 1 : 0
  const c = color(p)
  const strokeColor = p >= 70 ? '#22c55e' : p >= 25 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 115" className="w-44">
        <path d={`M 25 100 A ${r} ${r} 0 0 1 175 100`} fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round" />
        {p > 0 && p < 100 && (
          <path
            d={`M 25 100 A ${r} ${r} 0 ${largeArc} 1 ${endX.toFixed(1)} ${endY.toFixed(1)}`}
            fill="none" stroke={strokeColor} strokeWidth="14" strokeLinecap="round"
          />
        )}
        {p >= 100 && (
          <path d={`M 25 100 A ${r} ${r} 0 0 1 175 100`} fill="none" stroke={strokeColor} strokeWidth="14" strokeLinecap="round" />
        )}
        <text x="100" y="85" textAnchor="middle" fontSize="22" fontWeight="700" fill="#111827">
          {Math.round(p)}%
        </text>
        <text x="100" y="102" textAnchor="middle" fontSize="10" fill="#6b7280">{value}</text>
      </svg>
      <p className={`text-xs font-medium mt-1 ${c.text}`}>{label}</p>
    </div>
  )
}

// ─── KPI Row ──────────────────────────────────────────────────────────────────

function KpiRow({
  icon: Icon, label, value, target, hasTarget, editingKey, thisKey,
  onEditStart, onEditSave, onEditCancel,
}: {
  icon: React.ElementType
  label: string
  value: string
  rawValue: number
  target: number
  hasTarget: boolean
  editingKey: string | null
  thisKey: string
  onEditStart: () => void
  onEditSave: (v: number) => void
  onEditCancel: () => void
}) {
  const [editVal, setEditVal] = useState(String(target))
  const p = hasTarget ? pct(parseFloat(value.replace(/[^0-9.]/g, '')), target) : 0
  const c = hasTarget ? color(p) : { bg: '', bar: 'bg-gray-300', text: 'text-gray-500', badge: 'bg-gray-100 text-gray-600' }
  const isEditing = editingKey === thisKey

  useEffect(() => { setEditVal(String(target)) }, [target])

  return (
    <tr className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${hasTarget ? c.bg + '/30' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${hasTarget ? c.badge : 'bg-gray-100 text-gray-500'}`}>
            <Icon size={14} />
          </div>
          <span className="text-sm font-medium text-gray-800">{label}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-semibold text-gray-900">{value}</span>
      </td>
      <td className="px-4 py-3 text-right">
        {hasTarget ? (
          isEditing ? (
            <div className="flex items-center justify-end gap-1">
              <input
                autoFocus
                type="number"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onEditSave(parseFloat(editVal))
                  if (e.key === 'Escape') onEditCancel()
                }}
                className="w-24 px-2 py-0.5 border border-blue-400 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button onClick={() => onEditSave(parseFloat(editVal))} className="text-green-600 hover:text-green-700"><Check size={13} /></button>
              <button onClick={onEditCancel} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1 group">
              <span className="text-sm text-gray-500">{typeof target === 'number' && target >= 100 ? fmt(target) : fmt(target, 0)}</span>
              <button onClick={onEditStart} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-600">
                <Edit3 size={12} />
              </button>
            </div>
          )
        ) : (
          <span className="text-xs text-gray-400 italic">—</span>
        )}
      </td>
      <td className="px-4 py-3 w-36">
        {hasTarget ? (
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
              style={{ width: `${Math.min(100, p)}%` }}
            />
          </div>
        ) : (
          <div className="h-2 bg-gray-100 rounded-full" />
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {hasTarget ? (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
            {Math.round(p)}%
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center w-8">
        {hasTarget && (
          p >= 70 ? <TrendingUp size={14} className="text-green-500 mx-auto" /> :
          p >= 25 ? <Minus size={14} className="text-amber-500 mx-auto" /> :
          <TrendingDown size={14} className="text-red-500 mx-auto" />
        )}
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KpiPage() {
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [targets, setTargets] = useState<Targets | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiRes, targetsRes, snapshotsRes] = await Promise.all([
        fetch('/api/kpi/current'),
        fetch('/api/kpi/targets'),
        fetch('/api/kpi/snapshots'),
      ])
      setKpi(await kpiRes.json())
      setTargets(await targetsRes.json())
      setSnapshots(await snapshotsRes.json())
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveTarget(key: string, value: number) {
    if (!targets || isNaN(value) || value <= 0) return
    setSaving(true)
    const updated = { ...targets, [key]: value }
    const res = await fetch('/api/kpi/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setTargets(await res.json())
    setSaving(false)
    setEditingKey(null)
  }

  async function saveSnapshot() {
    if (!kpi) return
    setSaving(true)
    const month = `${kpi.year}-${String(kpi.month).padStart(2, '0')}`
    await fetch('/api/kpi/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, data: kpi }),
    })
    const res = await fetch('/api/kpi/snapshots')
    setSnapshots(await res.json())
    setSaving(false)
  }

  // Build trend chart data: merge snapshots + current year monthly breakdown
  const trendData = (() => {
    if (!kpi || !targets) return []
    const monthlyTarget = targets.monthly_revenue
    const byMonth: Record<number, number> = {}
    for (const b of kpi.monthlyBreakdown) byMonth[b.m] = b.revenue
    // Also overlay snapshot data for previous months if available
    for (const snap of snapshots) {
      const [y, m] = snap.month.split('-').map(Number)
      if (y === kpi.year && m < kpi.month) {
        const d = snap.data as KpiData
        if (d?.monthlyRevenue !== undefined) byMonth[m] = d.monthlyRevenue
      }
    }
    return Array.from({ length: kpi.month }, (_, i) => ({
      name: MONTH_NAMES[i],
      bevétel: Math.round(byMonth[i + 1] ?? 0),
      cél: monthlyTarget,
    }))
  })()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">KPI adatok betöltése...</span>
        </div>
      </div>
    )
  }

  if (!kpi || !targets) return null

  const rows = [
    {
      key: 'annual_revenue', icon: Euro, label: 'Éves bevétel',
      value: fmtEur(kpi.annualRevenue), rawValue: kpi.annualRevenue,
      target: targets.annual_revenue, hasTarget: true,
    },
    {
      key: 'monthly_revenue', icon: Calendar, label: 'Havi bevétel',
      value: fmtEur(kpi.monthlyRevenue), rawValue: kpi.monthlyRevenue,
      target: targets.monthly_revenue, hasTarget: true,
    },
    {
      key: 'active_partners', icon: Users, label: 'Aktív partnerek',
      value: String(kpi.activePartners), rawValue: kpi.activePartners,
      target: targets.active_partners, hasTarget: true,
    },
    {
      key: 'new_partners_month', icon: UserPlus, label: 'Új partner / hónap',
      value: String(kpi.newPartnersMonth), rawValue: kpi.newPartnersMonth,
      target: targets.new_partners_month, hasTarget: true,
    },
    {
      key: 'avg_order_value', icon: ShoppingCart, label: 'Átlagos rendelési érték',
      value: fmtEur(kpi.avgOrderValue), rawValue: kpi.avgOrderValue,
      target: targets.avg_order_value, hasTarget: true,
    },
    {
      key: 'open_invoices', icon: FileText, label: 'Nyitott számlák értéke',
      value: `${fmtEur(kpi.openInvoicesValue)} (${kpi.openInvoicesCount} db)`,
      rawValue: kpi.openInvoicesValue,
      target: 0, hasTarget: false,
    },
    {
      key: 'reorder_rate', icon: Repeat2, label: 'Visszatérő ügyfél arány',
      value: `${fmt(kpi.reorderRate, 1)}%`, rawValue: kpi.reorderRate,
      target: targets.reorder_rate, hasTarget: true,
    },
  ]

  const annualPct = pct(kpi.annualRevenue, targets.annual_revenue)
  const monthlyPct = pct(kpi.monthlyRevenue, targets.monthly_revenue)
  const partnersPct = pct(kpi.activePartners, targets.active_partners)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">KPI Monitor {kpi.year}</h1>
            <p className="text-xs text-gray-400">
              Utolsó frissítés: {lastRefresh?.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveSnapshot}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Camera size={14} />
            Snapshot
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Frissítés
          </button>
        </div>
      </div>

      {/* Gauges row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center">
          <p className="text-xs text-gray-500 font-medium mb-2">Éves bevétel haladás</p>
          <SemiGauge percent={annualPct} label={annualPct >= 70 ? 'Jó úton' : annualPct >= 25 ? 'Fejlesztendő' : 'Lemaradás'} value={`${fmtEur(kpi.annualRevenue)} / ${fmtEur(targets.annual_revenue)}`} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center">
          <p className="text-xs text-gray-500 font-medium mb-2">Havi bevétel haladás</p>
          <SemiGauge percent={monthlyPct} label={monthlyPct >= 70 ? 'Célnál' : monthlyPct >= 25 ? 'Közeledik' : 'Lemaradás'} value={`${fmtEur(kpi.monthlyRevenue)} / ${fmtEur(targets.monthly_revenue)}`} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center">
          <p className="text-xs text-gray-500 font-medium mb-2">Aktív partnerek</p>
          <SemiGauge percent={partnersPct} label={`${kpi.activePartners} / ${targets.active_partners} partner`} value={`${kpi.activePartners} aktív`} />
        </div>
      </div>

      {/* KPI Table + Trend Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Table */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">KPI Táblázat — {kpi.year}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Célokat a ✎ ikonnal szerkesztheted</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">KPI</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Aktuális</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Cél</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase w-36">Haladás</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">%</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <KpiRow
                  key={row.key}
                  icon={row.icon}
                  label={row.label}
                  value={row.value}
                  rawValue={row.rawValue}
                  target={row.target}
                  hasTarget={row.hasTarget}
                  editingKey={editingKey}
                  thisKey={row.key}
                  onEditStart={() => setEditingKey(row.key)}
                  onEditSave={v => saveTarget(row.key, v)}
                  onEditCancel={() => setEditingKey(null)}
                />
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≥ 70%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />25–69%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{'< 25%'}</span>
          </div>
        </div>

        {/* Trend chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Havi bevétel trend</h2>
          <p className="text-xs text-gray-400 mb-4">{kpi.year} — célvonal: {fmtEur(targets.monthly_revenue)}/hó</p>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `€${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip formatter={(v: number, name: string) => [fmtEur(v), name === 'bevétel' ? 'Bevétel' : 'Cél']} />
                <Legend formatter={v => v === 'bevétel' ? 'Bevétel' : 'Havi cél'} wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={targets.monthly_revenue} stroke="#e5e7eb" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="cél" stroke="#e5e7eb" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="bevétel" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-gray-300 text-sm">
              Még nincs adat ebből az évből
            </div>
          )}

          {/* Snapshot history */}
          {snapshots.length > 0 && (
            <div className="mt-4 border-t border-gray-50 pt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Mentett snapshotok</p>
              <div className="flex flex-wrap gap-1.5">
                {snapshots.slice(-12).map(s => (
                  <span key={s.id} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-mono">
                    {s.month}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <RefreshCw size={14} className="animate-spin" />
          Mentés...
        </div>
      )}
    </div>
  )
}
