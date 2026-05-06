'use client'

import { useState, useEffect } from 'react'
import { Users, Building2, TrendingUp, CheckSquare, DollarSign, Clock, AlertCircle } from 'lucide-react'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { hu } from 'date-fns/locale'

interface Stats {
  totalContacts: number
  totalCompanies: number
  totalDeals: number
  pendingTasks: number
  wonRevenue: number
  dealsByStage: { stage: string; _count: number; _sum: { value: number | null } }[]
  recentContacts: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    status: string
    company: { name: string } | null
    createdAt: string
  }[]
  upcomingTasks: {
    id: string
    title: string
    dueDate: string | null
    priority: string
    contact: { firstName: string; lastName: string } | null
  }[]
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
  prospect: 'bg-gray-100 text-gray-700',
  qualified: 'bg-blue-100 text-blue-700',
  proposal: 'bg-purple-100 text-purple-700',
  negotiation: 'bg-amber-100 text-amber-700',
  closed_won: 'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-700',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  lead: { label: 'Érdeklődő', color: 'bg-yellow-100 text-yellow-800' },
  active: { label: 'Aktív', color: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inaktív', color: 'bg-gray-100 text-gray-600' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: 'Magas', color: 'text-red-600' },
  medium: { label: 'Közepes', color: 'text-amber-600' },
  low: { label: 'Alacsony', color: 'text-gray-400' },
}

function formatDueDate(dateStr: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isToday(date)) return { text: 'Ma', urgent: true }
  if (isTomorrow(date)) return { text: 'Holnap', urgent: false }
  if (isPast(date)) return { text: format(date, 'MMM d.', { locale: hu }), urgent: true }
  return { text: format(date, 'MMM d.', { locale: hu }), urgent: false }
}

function formatCurrency(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)} M Ft`
  if (value >= 1000) return `${(value / 1000).toFixed(0)} e Ft`
  return `${value} Ft`
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
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

  const statCards = [
    {
      label: 'Ügyfelek',
      value: stats.totalContacts,
      icon: Users,
      color: 'bg-blue-500',
      href: '/contacts',
    },
    {
      label: 'Cégek',
      value: stats.totalCompanies,
      icon: Building2,
      color: 'bg-purple-500',
      href: '/companies',
    },
    {
      label: 'Aktív dealek',
      value: stats.totalDeals,
      icon: TrendingUp,
      color: 'bg-amber-500',
      href: '/deals',
    },
    {
      label: 'Nyílt feladatok',
      value: stats.pendingTasks,
      icon: CheckSquare,
      color: 'bg-green-500',
      href: '/tasks',
    },
    {
      label: 'Nyert bevétel',
      value: formatCurrency(stats.wonRevenue),
      icon: DollarSign,
      color: 'bg-emerald-600',
      href: '/reports',
    },
  ]

  const activeStages = stats.dealsByStage.filter(
    (s) => s.stage !== 'closed_won' && s.stage !== 'closed_lost'
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Üdvözöljük a Memini CRM-ben</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
                <Icon size={20} className="text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-sm text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Pipeline áttekintő */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Pipeline stádiumok</h2>
          <div className="space-y-3">
            {activeStages.map((stage) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STAGE_COLORS[stage.stage]}`}>
                    {STAGE_LABELS[stage.stage]}
                  </span>
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min((stage._count / stats.totalDeals) * 100, 100)}%` }}
                  />
                </div>
                <div className="w-32 text-right text-sm text-gray-600 shrink-0">
                  {stage._count} deal · {formatCurrency(stage._sum.value || 0)}
                </div>
              </div>
            ))}
            {activeStages.length === 0 && (
              <p className="text-gray-400 text-sm">Nincs aktív deal</p>
            )}
          </div>
        </div>

        {/* Közelgő feladatok */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Közelgő feladatok</h2>
          <div className="space-y-3">
            {stats.upcomingTasks.slice(0, 5).map((task) => {
              const due = formatDueDate(task.dueDate)
              const priority = PRIORITY_CONFIG[task.priority]
              return (
                <div key={task.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 ${priority.color}`}>
                    <AlertCircle size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    {task.contact && (
                      <p className="text-xs text-gray-500">
                        {task.contact.firstName} {task.contact.lastName}
                      </p>
                    )}
                  </div>
                  {due && (
                    <div className={`flex items-center gap-1 text-xs shrink-0 ${due.urgent ? 'text-red-600' : 'text-gray-400'}`}>
                      <Clock size={11} />
                      {due.text}
                    </div>
                  )}
                </div>
              )
            })}
            {stats.upcomingTasks.length === 0 && (
              <p className="text-gray-400 text-sm">Nincs közelgő feladat</p>
            )}
          </div>
        </div>
      </div>

      {/* Legújabb ügyfelek */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Legújabb ügyfelek</h2>
        <div className="divide-y divide-gray-50">
          {stats.recentContacts.map((contact) => {
            const status = STATUS_CONFIG[contact.status]
            return (
              <div key={contact.id} className="flex items-center gap-4 py-3">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
                  {contact.firstName[0]}{contact.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{contact.firstName} {contact.lastName}</p>
                  <p className="text-sm text-gray-500 truncate">{contact.company?.name || contact.email || '-'}</p>
                </div>
                {status && (
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 ${status.color}`}>
                    {status.label}
                  </span>
                )}
                <span className="text-xs text-gray-400 shrink-0">
                  {format(new Date(contact.createdAt), 'MMM d.', { locale: hu })}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
