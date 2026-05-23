'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'

interface KpiSummary {
  annualRevenue: number
  monthlyRevenue: number
  activePartners: number
  openInvoicesValue: number
  calculatedAt: string
}

interface Targets {
  annual_revenue: number
  monthly_revenue: number
  active_partners: number
}

const AUTO_REFRESH_MS = 24 * 60 * 60 * 1000 // 24 hours

function pct(v: number, t: number) { return t > 0 ? Math.min(100, (v / t) * 100) : 0 }

function MiniGauge({ percent, size = 52 }: { percent: number; size?: number }) {
  const p = Math.min(100, Math.max(0, percent))
  const cx = 50, cy = 50, r = 38
  const angle = Math.PI * (1 - p / 100)
  const endX = cx + r * Math.cos(angle)
  const endY = cy - r * Math.sin(angle)
  const largeArc = p > 50 ? 1 : 0
  const strokeColor = p >= 70 ? '#22c55e' : p >= 25 ? '#f59e0b' : '#ef4444'

  return (
    <svg viewBox="0 0 100 58" width={size} height={size * 0.58}>
      <path d={`M 12 50 A ${r} ${r} 0 0 1 88 50`} fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
      {p > 0 && p < 100 && (
        <path
          d={`M 12 50 A ${r} ${r} 0 ${largeArc} 1 ${endX.toFixed(1)} ${endY.toFixed(1)}`}
          fill="none" stroke={strokeColor} strokeWidth="8" strokeLinecap="round"
        />
      )}
      {p >= 100 && (
        <path d={`M 12 50 A ${r} ${r} 0 0 1 88 50`} fill="none" stroke={strokeColor} strokeWidth="8" strokeLinecap="round" />
      )}
    </svg>
  )
}

export default function KpiGaugeWidget() {
  const [data, setData] = useState<KpiSummary | null>(null)
  const [targets, setTargets] = useState<Targets | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<number>(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiRes, tRes] = await Promise.all([
        fetch('/api/kpi/current'),
        fetch('/api/kpi/targets'),
      ])
      const kpi = await kpiRes.json()
      const t = await tRes.json()
      setData(kpi)
      setTargets(t)
      const now = Date.now()
      setLastRefresh(now)
      localStorage.setItem('kpi_last_refresh', String(now))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const stored = parseInt(localStorage.getItem('kpi_last_refresh') ?? '0')
    if (Date.now() - stored > AUTO_REFRESH_MS) {
      load()
    } else {
      load() // always load on mount (data fetching is cheap)
    }
  }, [load])

  if (loading || !data || !targets) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
        <div className="h-16 bg-gray-50 rounded" />
      </div>
    )
  }

  const annualPct = pct(data.annualRevenue, targets.annual_revenue)
  const monthlyPct = pct(data.monthlyRevenue, targets.monthly_revenue)
  const partnersPct = pct(data.activePartners, targets.active_partners)

  const gaugeColor = annualPct >= 70 ? 'text-green-600' : annualPct >= 25 ? 'text-amber-600' : 'text-red-500'
  const TrendIcon = annualPct >= 70 ? TrendingUp : annualPct >= 25 ? Minus : TrendingDown

  function fmt(n: number) { return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-indigo-500" />
          <span className="text-xs font-semibold text-gray-700">KPI Monitor</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={load}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            title="Frissítés"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link href="/kpi" className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
            Részletek →
          </Link>
        </div>
      </div>

      {/* Main gauge */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Éves bevétel cél</p>
            <p className={`text-2xl font-bold ${gaugeColor}`}>{Math.round(annualPct)}%</p>
            <p className="text-xs text-gray-500">€{fmt(data.annualRevenue)} / €{fmt(targets.annual_revenue)}</p>
          </div>
          <div className="flex flex-col items-center">
            <MiniGauge percent={annualPct} size={72} />
            <div className={`flex items-center gap-1 text-xs font-medium ${gaugeColor} mt-1`}>
              <TrendIcon size={11} />
              {annualPct >= 70 ? 'Jó úton' : annualPct >= 25 ? 'Fejlesztendő' : 'Lemaradás'}
            </div>
          </div>
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-3 gap-px bg-gray-100 border-t border-gray-100">
        {[
          { label: 'Havi bev.', pct: monthlyPct, val: `€${fmt(data.monthlyRevenue)}` },
          { label: 'Partnerek', pct: partnersPct, val: String(data.activePartners) },
          { label: 'Nyitott szla', pct: -1, val: `€${fmt(data.openInvoicesValue)}` },
        ].map(({ label, pct: p, val }) => {
          const c = p >= 0 ? (p >= 70 ? 'text-green-600' : p >= 25 ? 'text-amber-600' : 'text-red-500') : 'text-blue-600'
          return (
            <div key={label} className="bg-white px-3 py-2 last:rounded-br-xl first:rounded-bl-xl">
              <p className="text-xs text-gray-400">{label}</p>
              <p className={`text-xs font-semibold ${c}`}>{val}</p>
              {p >= 0 && <p className="text-xs text-gray-300">{Math.round(p)}%</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
