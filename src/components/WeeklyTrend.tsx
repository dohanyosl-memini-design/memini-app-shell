'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { TrendingUp, Table2, LineChart } from 'lucide-react'

interface WeekPoint {
  week: string
  label: string
  bevetelEur: number
  rendelesek: number
  ajanlatok: number
  aktivitasok: number
  feladatokKesz: number
}

interface TrendData {
  weeks: WeekPoint[]
  totals: { bevetelEur: number; rendelesek: number; ajanlatok: number; aktivitasok: number; feladatokKesz: number }
  sparse: boolean
}

/** A három sorozat rögzített sorrendben — a szín az entitást követi, nem a rangsort. */
const SERIES = [
  { key: 'ajanlatok'     as const, name: 'Kiküldött ajánlat', slot: 1 },
  { key: 'aktivitasok'   as const, name: 'Egyeztetés',        slot: 2 },
  { key: 'feladatokKesz' as const, name: 'Elvégzett feladat', slot: 3 },
]

const W = 760
const H = 200
const PAD = { top: 16, right: 16, bottom: 26, left: 46 }

function eur(n: number) {
  return `€${Math.round(n).toLocaleString('de-DE')}`
}

/** Kerek felső skálahatár, hogy a rács ne tört számokon álljon. */
function niceMax(v: number): number {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const norm = v / mag
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * mag
}

export default function WeeklyTrend() {
  const [data, setData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [weeks, setWeeks] = useState(12)
  const [tableView, setTableView] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const barsRef = useRef<SVGSVGElement>(null)
  const linesRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/trends/weekly?weeks=${weeks}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: TrendData | null) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [weeks])

  // A célkereszt megkeresi az X-et: a mutatóhoz legközelebbi hétre pattan,
  // így nem kell egy 2px-es vonalat eltalálni.
  const pick = useCallback((el: SVGSVGElement | null, clientX: number, n: number) => {
    if (!el || n === 0) return null
    const r = el.getBoundingClientRect()
    const x = ((clientX - r.left) / r.width) * W
    const plotW = W - PAD.left - PAD.right
    const i = Math.floor(((x - PAD.left) / plotW) * n)
    return Math.max(0, Math.min(n - 1, i))
  }, [])

  if (loading && !data) {
    return <div className="py-12 text-center text-gray-400 text-sm">Betöltés...</div>
  }
  if (!data || data.weeks.length === 0) {
    return <div className="py-12 text-center text-gray-400 text-sm">Nincs adat.</div>
  }

  const pts = data.weeks
  const n = pts.length
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  // Sávközépre igazítunk (nem a plot széleire): így az első oszlop nem lóg rá a
  // tengelyfeliratra, és a két grafikon pontjai egymás fölött állnak.
  const band = plotW / n
  const xAt = (i: number) => PAD.left + (i + 0.5) * band

  const revMax = niceMax(Math.max(...pts.map(p => p.bevetelEur)))
  const cntMax = niceMax(Math.max(1, ...pts.flatMap(p => SERIES.map(s => p[s.key]))))

  const yRev = (v: number) => PAD.top + plotH - (v / revMax) * plotH
  const yCnt = (v: number) => PAD.top + plotH - (v / cntMax) * plotH

  const barW = Math.max(4, Math.min(28, band - 2)) // 2px rés a felületnek
  const hovered = hover != null ? pts[hover] : null

  return (
    <div className="viz-root max-w-4xl">
      <style>{`
        .viz-root {
          --surface-1: #ffffff;
          --text-primary: #0b0b0b;
          --text-secondary: #52514e;
          --muted: #898781;
          --grid: #e1e0d9;
          --baseline: #c3c2b7;
          --series-1: #2a78d6;
          --series-2: #eb6834;
          --series-3: #1baf7a;
        }
        .dark .viz-root {
          --surface-1: #1a1a19;
          --text-primary: #ffffff;
          --text-secondary: #c3c2b7;
          --muted: #898781;
          --grid: #2c2c2a;
          --baseline: #383835;
          --series-1: #3987e5;
          --series-2: #d95926;
          --series-3: #199e70;
        }
      `}</style>

      {/* Szűrősor — egy sorban, a diagramok felett */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
          {[8, 12, 26].map(w => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                weeks === w ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {w} hét
            </button>
          ))}
        </div>
        <button
          onClick={() => setTableView(v => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {tableView ? <LineChart size={13} /> : <Table2 size={13} />}
          {tableView ? 'Diagram' : 'Táblázat'}
        </button>
        <span className="text-xs text-gray-400 ml-auto">
          Összesen: {eur(data.totals.bevetelEur)} · {data.totals.rendelesek} rendelés
        </span>
      </div>

      {data.sparse && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 mb-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Kevés az adat ehhez az időszakhoz — a trendből még nem érdemes következtetést levonni.
          </p>
        </div>
      )}

      {tableView ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="px-3 py-2 font-medium text-gray-500">Hét</th>
                <th className="px-3 py-2 font-medium text-gray-500 text-right">Bevétel</th>
                <th className="px-3 py-2 font-medium text-gray-500 text-right">Rendelés</th>
                {SERIES.map(s => (
                  <th key={s.key} className="px-3 py-2 font-medium text-gray-500 text-right">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pts.map(p => (
                <tr key={p.week} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{p.label}</td>
                  <td className="px-3 py-1.5 text-right text-gray-900 dark:text-gray-100">{p.bevetelEur > 0 ? eur(p.bevetelEur) : '—'}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{p.rendelesek || '—'}</td>
                  {SERIES.map(s => (
                    <td key={s.key} className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{p[s.key] || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 1. BEVÉTEL — egy sorozat, oszlopok. A jelmagyarázatot a cím helyettesíti. */}
          <figure className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a19] p-3">
            <figcaption className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">
              Befolyt bevétel hetente
            </figcaption>
            <div className="relative">
              <svg
                ref={barsRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }}
                onPointerMove={e => setHover(pick(barsRef.current, e.clientX, n))}
                onPointerLeave={() => setHover(null)}
              >
                {[0, 0.5, 1].map(f => (
                  <g key={f}>
                    <line x1={PAD.left} x2={W - PAD.right} y1={yRev(revMax * f)} y2={yRev(revMax * f)}
                      stroke="var(--grid)" strokeWidth={1} />
                    <text x={PAD.left - 6} y={yRev(revMax * f) + 3} textAnchor="end"
                      fill="var(--muted)" fontSize={10} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {eur(revMax * f)}
                    </text>
                  </g>
                ))}
                {pts.map((p, i) => {
                  const h = p.bevetelEur > 0 ? Math.max(2, plotH - (yRev(p.bevetelEur) - PAD.top)) : 0
                  return h > 0 ? (
                    <rect key={p.week} x={xAt(i) - barW / 2} y={PAD.top + plotH - h}
                      width={barW} height={h} rx={4}
                      fill="var(--series-1)" opacity={hover == null || hover === i ? 1 : 0.45} />
                  ) : null
                })}
                <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH}
                  stroke="var(--baseline)" strokeWidth={1} />
                {pts.map((p, i) =>
                  i % Math.ceil(n / 8) === 0 ? (
                    <text key={p.week} x={xAt(i)} y={H - 8} textAnchor="middle" fill="var(--muted)" fontSize={10}>
                      {p.label}
                    </text>
                  ) : null
                )}
              </svg>
            </div>
          </figure>

          {/* 2. AKTIVITÁS — három sorozat, vonalak. Külön grafikon: soha nem kettős tengely. */}
          <figure className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a19] p-3">
            <figcaption className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">
              Aktivitás hetente
            </figcaption>
            <div className="flex flex-wrap gap-3 mb-1">
              {SERIES.map(s => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <svg width="14" height="4" aria-hidden>
                    <line x1="0" y1="2" x2="14" y2="2" stroke={`var(--series-${s.slot})`} strokeWidth={2} strokeLinecap="round" />
                  </svg>
                  {s.name}
                </span>
              ))}
            </div>
            <svg
              ref={linesRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }}
              onPointerMove={e => setHover(pick(linesRef.current, e.clientX, n))}
              onPointerLeave={() => setHover(null)}
            >
              {[0, 0.5, 1].map(f => (
                <g key={f}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={yCnt(cntMax * f)} y2={yCnt(cntMax * f)}
                    stroke="var(--grid)" strokeWidth={1} />
                  <text x={PAD.left - 6} y={yCnt(cntMax * f) + 3} textAnchor="end"
                    fill="var(--muted)" fontSize={10} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(cntMax * f)}
                  </text>
                </g>
              ))}
              {hover != null && (
                <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={PAD.top + plotH}
                  stroke="var(--baseline)" strokeWidth={1} />
              )}
              {SERIES.map(s => (
                <polyline key={s.key} fill="none" stroke={`var(--series-${s.slot})`} strokeWidth={2}
                  strokeLinejoin="round" strokeLinecap="round"
                  points={pts.map((p, i) => `${xAt(i)},${yCnt(p[s.key])}`).join(' ')} />
              ))}
              {hover != null && SERIES.map(s => (
                <circle key={s.key} cx={xAt(hover)} cy={yCnt(pts[hover][s.key])} r={4}
                  fill={`var(--series-${s.slot})`} stroke="var(--surface-1)" strokeWidth={2} />
              ))}
              <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH}
                stroke="var(--baseline)" strokeWidth={1} />
              {pts.map((p, i) =>
                i % Math.ceil(n / 8) === 0 ? (
                  <text key={p.week} x={xAt(i)} y={H - 8} textAnchor="middle" fill="var(--muted)" fontSize={10}>
                    {p.label}
                  </text>
                ) : null
              )}
            </svg>
          </figure>

          {/* Egy tooltip, minden sorozat — az érték vezet, a név követi. */}
          {hovered && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a19] px-3 py-2 text-sm">
              <p className="text-xs text-gray-400 mb-1">{hovered.label} hete</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {eur(hovered.bevetelEur)}
                  <span className="text-gray-500 dark:text-gray-400 font-normal"> bevétel</span>
                </span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {hovered.rendelesek}
                  <span className="text-gray-500 dark:text-gray-400 font-normal"> rendelés</span>
                </span>
                {SERIES.map(s => (
                  <span key={s.key} className="inline-flex items-center gap-1.5">
                    <svg width="12" height="4" aria-hidden>
                      <line x1="0" y1="2" x2="12" y2="2" stroke={`var(--series-${s.slot})`} strokeWidth={2} strokeLinecap="round" />
                    </svg>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{hovered[s.key]}</span>
                    <span className="text-gray-500 dark:text-gray-400">{s.name.toLowerCase()}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3 flex items-start gap-1.5">
        <TrendingUp size={13} className="mt-0.5 shrink-0" />
        <span>
          Heti bontás — napi görbén a legtöbb nap nulla lenne, és a véletlen ugrálásban
          nem létező mintákat lehetne meglátni. A bevétel a befolyt (kifizetett) számlákból
          jön, nem a kiállítottakból.
        </span>
      </p>
    </div>
  )
}
