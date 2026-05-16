'use client'

import { useState, useEffect } from 'react'
import { Bot, Calendar, BarChart3, TrendingUp, RefreshCw, FileText, ChevronDown, ChevronUp } from 'lucide-react'

interface Report {
  id: string
  type: 'daily' | 'weekly' | 'monthly'
  title: string
  summary: string
  drafts: { type: string; count: number; note: string }[]
  createdAt: string
}

const TYPE_CONFIG = {
  daily:   { label: 'Napi',   icon: Calendar,   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  weekly:  { label: 'Heti',   icon: BarChart3,   color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  monthly: { label: 'Havi',   icon: TrendingUp,  color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
}

function ReportCard({ report }: { report: Report }) {
  const [open, setOpen] = useState(false)
  const cfg = TYPE_CONFIG[report.type]
  const Icon = cfg.icon

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${cfg.color}`}>
          <Icon size={12} />
          {cfg.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{report.title}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {new Date(report.createdAt).toLocaleString('hu-HU')}
          </p>
        </div>
        {report.drafts.length > 0 && (
          <span className="shrink-0 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs px-2 py-0.5 rounded-full">
            {report.drafts.reduce((s, d) => s + d.count, 0)} vázlat
          </span>
        )}
        {open ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
              {report.summary}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ArthurPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all')
  const [triggering, setTriggering] = useState<string | null>(null)

  async function fetchReports() {
    setLoading(true)
    const res = await fetch('/api/arthur/reports')
    const data = await res.json()
    setReports(data)
    setLoading(false)
  }

  async function triggerReport(type: string) {
    setTriggering(type)
    await fetch(`/api/cron/${type}`)
    await fetchReports()
    setTriggering(null)
  }

  useEffect(() => { fetchReports() }, [])

  const filtered = filter === 'all' ? reports : reports.filter(r => r.type === filter)

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Fejléc */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
          <Bot size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Arthur jelentései</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Automatikus napi · heti · havi elemzések</p>
        </div>
      </div>

      {/* Manuális indítás */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(['daily', 'weekly', 'monthly'] as const).map(type => {
          const cfg = TYPE_CONFIG[type]
          const Icon = cfg.icon
          return (
            <button
              key={type}
              onClick={() => triggerReport(type)}
              disabled={triggering === type}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-400 transition-colors disabled:opacity-50"
            >
              {triggering === type
                ? <RefreshCw size={18} className="text-indigo-500 animate-spin" />
                : <Icon size={18} className="text-indigo-500" />
              }
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {triggering === type ? 'Készül...' : `${cfg.label} most`}
              </span>
            </button>
          )
        })}
      </div>

      {/* Szűrő */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['all', 'daily', 'weekly', 'monthly'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f === 'all' ? 'Mind' : TYPE_CONFIG[f].label}
          </button>
        ))}
      </div>

      {/* Jelentések */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-indigo-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Még nincs jelentés. Kattints a fenti gombokra az első generáláshoz.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  )
}
