'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, PhoneCall, Building2, User, Calendar, Clock, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface ReorderItem {
  companyId: string
  companyName: string
  contactName: string | null
  lastOrderDate: string
  lastOrderValueEur: number
  monthsSinceLastOrder: number
  fulfilledOrderCount: number
  isDue: boolean
  isSeasonCall: boolean
}

interface ReorderData {
  thresholdMonths: number
  reorderRate: {
    reorderedEstablished: number
    establishedPartners: number
    ratePct: number | null
    targetPct: number
    meetsTarget: boolean
    label: string
  }
  season: { inWindow: boolean; note: string }
  reliability: { reliable: boolean; reason: string | null }
  totals: { wonPartners: number; partnersWithoutFulfilledOrders: number; listed: number }
  items: ReorderItem[]
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function ReordersPage() {
  const [data, setData] = useState<ReorderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [scheduled, setScheduled] = useState<Record<string, 'loading' | 'done' | 'error'>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/reorder-due')
    setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function scheduleCall(companyId: string) {
    setScheduled((s) => ({ ...s, [companyId]: 'loading' }))
    try {
      const res = await fetch('/api/reorder-due/schedule-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      setScheduled((s) => ({ ...s, [companyId]: res.ok ? 'done' : 'error' }))
    } catch {
      setScheduled((s) => ({ ...s, [companyId]: 'error' }))
    }
  }

  const rate = data?.reorderRate

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw size={22} className="text-blue-600" />
            Esedékes reorder lista
          </h1>
          <p className="text-gray-500 mt-1">
            Won partnerek, akiknek {data?.thresholdMonths ?? 9}+ hónapja volt az utolsó teljesített rendelése.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={15} /> Frissítés
        </button>
      </div>

      {/* Megbízhatósági figyelmeztetés — ha nincs won partner / rendelési előzmény */}
      {data && !data.reliability.reliable && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4 flex items-start gap-2">
          <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">A reorder-lista jelenleg nem megbízható</p>
            <p className="text-sm text-red-700 mt-0.5">{data.reliability.reason}</p>
          </div>
        </div>
      )}

      {/* Reorder-arány KPI */}
      {rate && (
        <div className={`rounded-xl border p-4 mb-4 flex items-center justify-between ${rate.meetsTarget ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reorder-arány (established partnerek)</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {rate.label}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Számláló: 2+ teljesített rendeléssel · Nevező: első rendelés 12+ hónapja · Cél: {rate.targetPct}%+
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold ${rate.meetsTarget ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {rate.meetsTarget ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {rate.meetsTarget ? 'Cél teljesül' : 'Cél alatt'}
          </div>
        </div>
      )}

      {/* Szezon-ablak banner */}
      {data?.season.inWindow && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 mb-4 flex items-start gap-2">
          <Sparkles size={18} className="text-purple-600 mt-0.5 shrink-0" />
          <p className="text-sm text-purple-800">{data.season.note}</p>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Betöltés...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="py-12 text-center text-gray-400">Nincs esedékes partner. 🎉</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Cég</th>
                  <th className="text-left font-medium px-4 py-3">Kapcsolattartó</th>
                  <th className="text-left font-medium px-4 py-3">Utolsó rendelés</th>
                  <th className="text-right font-medium px-4 py-3">Érték</th>
                  <th className="text-right font-medium px-4 py-3">Eltelt</th>
                  <th className="text-left font-medium px-4 py-3">Jelölés</th>
                  <th className="text-right font-medium px-4 py-3">Akció</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => {
                  const st = scheduled[item.companyId]
                  return (
                    <tr key={item.companyId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-gray-900">
                          <Building2 size={14} className="text-gray-400 shrink-0" />
                          {item.companyName}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{item.fulfilledOrderCount} teljesített rendelés</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.contactName ? (
                          <span className="flex items-center gap-1"><User size={13} className="text-gray-400" />{item.contactName}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-gray-400" />
                          {format(new Date(item.lastOrderDate), 'yyyy. MMM d.', { locale: hu })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtEur(item.lastOrderValueEur)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          <Clock size={13} className="text-gray-400" />{item.monthsSinceLastOrder} hó
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.isDue && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Esedékes</span>
                          )}
                          {item.isSeasonCall && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Szezon-hívás</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => scheduleCall(item.companyId)}
                          disabled={st === 'loading' || st === 'done'}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            st === 'done'
                              ? 'bg-green-100 text-green-700 cursor-default'
                              : st === 'error'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                          }`}
                        >
                          {st === 'done' ? <><CheckCircle2 size={14} /> Ütemezve</>
                            : st === 'loading' ? <>Ütemezés...</>
                            : st === 'error' ? <>Hiba — újra</>
                            : <><PhoneCall size={14} /> Hívás ütemezése</>}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && (
        <p className="text-xs text-gray-400 mt-3">
          {data.totals.listed} listázott partner · {data.totals.wonPartners} won partner összesen
          {data.totals.partnersWithoutFulfilledOrders > 0 && ` · ${data.totals.partnersWithoutFulfilledOrders} még nem rendelt`}
        </p>
      )}
    </div>
  )
}
