// Tölcsér-KPI számítás (FÁZIS 2) — B2B értékesítési tölcsér havi/heti mutatói.
// Egyetlen lekérdezésből kiolvasható: outreach, follow-up, mintakérés, konverzió,
// új partnerek, reorderek, rendelési volumen — plusz terv/tény összevetés.
// Közös forrás az MCP tool és a REST endpoint számára.

import {
  startOfMonth, endOfMonth, subMonths, startOfYear,
  startOfWeek, endOfWeek, subWeeks,
  format,
} from 'date-fns'
import { hu } from 'date-fns/locale'
import { prisma as defaultPrisma } from './prisma'
import { DEAL_STAGES, normalizeStage, type DealStage } from './dealStages'
import { loadFunnelTargets, type FunnelTargetValues } from './funnelTargets'

// Follow-up = tényleges ügyfélérintés (a belső 'note' feljegyzés nem számít).
export const FOLLOWUP_ACTIVITY_TYPES = ['call', 'email', 'whatsapp', 'meeting']

// A tölcsér aktív sorrendje (won a cél, lost a kiesés — külön kezeljük).
const ACTIVE_FUNNEL: DealStage[] = ['outreach_sent', 'follow_up', 'sample_requested', 'sample_sent', 'trial_order', 'won']
const STAGE_INDEX: Record<string, number> = Object.fromEntries(ACTIVE_FUNNEL.map((s, i) => [s, i]))
const SAMPLE_INDEX = STAGE_INDEX['sample_requested']

// Egy létrehozott deal "mintakérésnek" számít, ha (jelenleg) legalább a
// mintakérés szakaszig eljutott. A lost dealek mélysége ismeretlen — kimaradnak.
function reachedSampleRequest(stage: string): boolean {
  const n = normalizeStage(stage)
  return n !== 'lost' && (STAGE_INDEX[n] ?? -1) >= SAMPLE_INDEX
}

export type Granularity = 'month' | 'week'

export interface FunnelPeriod {
  key: string
  label: string
  start: string
  end: string
  newOutreachDeals: number      // az adott időszakban létrehozott dealek (a tölcsérbe belépők)
  followUpActivities: number    // follow-up érintések száma (call/email/whatsapp/meeting)
  sampleRequests: number        // mintakérésig eljutott, az időszakban létrehozott dealek
  newPartners: number           // won dealek az időszakban (lezárás dátuma szerint)
  reorderCount: number          // partner 2.+ rendelései az időszakban
  reorderValueEur: number       // ezek összértéke EUR-ban
  orderVolumeEur: number        // összes (nem lemondott) rendelés volumene EUR-ban
}

export interface FunnelSnapshotStage {
  key: DealStage
  label: string
  count: number                 // jelenleg ebben a szakaszban lévő dealek
  reached: number               // idáig (vagy tovább) eljutott dealek — snapshot
  conversionFromPrev: number | null  // átlépési arány az előző szakaszból, % (1 tizedes)
}

// terv/tény egy mutatóra
export interface MetricComparison {
  actual: number
  plan: number | null
  variancePct: number | null    // (tény − terv) / terv * 100, 1 tizedes; null ha nincs terv
}

export interface PlanVsActualMonth {
  yearMonth: string
  label: string
  hasPlan: boolean
  month: Record<string, MetricComparison>  // az adott hónap terv/tény
  ytd: Record<string, MetricComparison>    // év elejétől kumulált terv/tény
}

export interface FunnelStats {
  generatedAt: string
  granularity: Granularity
  rangeStart: string
  periods: FunnelPeriod[]
  funnelSnapshot: {
    stages: FunnelSnapshotStage[]
    totalActive: number
    totalWon: number
    totalLost: number
    note: string
  }
  planVsActual: {
    year: number
    metrics: string[]
    months: PlanVsActualMonth[]
    note: string
  }
}

interface Bucket { key: string; label: string; start: Date; end: Date }

function buildBuckets(granularity: Granularity, count: number, now: Date): Bucket[] {
  const buckets: Bucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    if (granularity === 'month') {
      const d = subMonths(now, i)
      const start = startOfMonth(d)
      buckets.push({
        key: format(start, 'yyyy-MM'),
        label: format(start, 'yyyy MMM', { locale: hu }),
        start,
        end: endOfMonth(d),
      })
    } else {
      const d = subWeeks(now, i)
      const start = startOfWeek(d, { weekStartsOn: 1 })
      const end = endOfWeek(d, { weekStartsOn: 1 })
      buckets.push({
        key: format(start, "yyyy-'W'II"),
        label: `${format(start, 'MMM d', { locale: hu })}–${format(end, 'd', { locale: hu })}`,
        start,
        end,
      })
    }
  }
  return buckets
}

function bucketIndexFor(date: Date, buckets: Bucket[]): number {
  const t = date.getTime()
  for (let i = 0; i < buckets.length; i++) {
    if (t >= buckets[i].start.getTime() && t <= buckets[i].end.getTime()) return i
  }
  return -1
}

// Az egyes mutatók: felszíni kulcs → FunnelPeriod mező (actual) + FunnelTarget mező (plan)
const METRICS: Array<{ key: string; actual: keyof FunnelPeriod; target: keyof FunnelTargetValues }> = [
  { key: 'outreach',       actual: 'newOutreachDeals',   target: 'outreach' },
  { key: 'followup',       actual: 'followUpActivities', target: 'followup' },
  { key: 'sampleRequests', actual: 'sampleRequests',     target: 'sampleRequests' },
  { key: 'newPartners',    actual: 'newPartners',        target: 'newPartners' },
  { key: 'reorders',       actual: 'reorderCount',       target: 'reorders' },
  { key: 'volumeEur',      actual: 'orderVolumeEur',     target: 'volumeEur' },
]

function variancePct(actual: number, plan: number | null): number | null {
  if (plan == null || plan === 0) return null
  return Math.round(((actual - plan) / plan) * 1000) / 10
}

interface RawData {
  createdDeals: Array<{ createdAt: Date; stage: string }>
  wonDeals: Array<{ closeDate: Date | null; updatedAt: Date }>
  activities: Array<{ activityDate: Date }>
  ordersWithFlag: Array<{ date: Date; total: number; isReorder: boolean }>
}

// Egy tetszőleges bucket-halmazra kiszámolja a nyers tény-mutatókat.
function aggregate(buckets: Bucket[], raw: RawData): FunnelPeriod[] {
  const periods: FunnelPeriod[] = buckets.map((b) => ({
    key: b.key, label: b.label, start: b.start.toISOString(), end: b.end.toISOString(),
    newOutreachDeals: 0, followUpActivities: 0, sampleRequests: 0,
    newPartners: 0, reorderCount: 0, reorderValueEur: 0, orderVolumeEur: 0,
  }))

  for (const d of raw.createdDeals) {
    const i = bucketIndexFor(new Date(d.createdAt), buckets)
    if (i < 0) continue
    periods[i].newOutreachDeals++
    if (reachedSampleRequest(d.stage)) periods[i].sampleRequests++
  }
  for (const a of raw.activities) {
    const i = bucketIndexFor(new Date(a.activityDate), buckets)
    if (i >= 0) periods[i].followUpActivities++
  }
  for (const d of raw.wonDeals) {
    const closedAt = d.closeDate ? new Date(d.closeDate) : new Date(d.updatedAt)
    const i = bucketIndexFor(closedAt, buckets)
    if (i >= 0) periods[i].newPartners++
  }
  for (const o of raw.ordersWithFlag) {
    const i = bucketIndexFor(new Date(o.date), buckets)
    if (i < 0) continue
    periods[i].orderVolumeEur += o.total
    if (o.isReorder) {
      periods[i].reorderCount++
      periods[i].reorderValueEur += o.total
    }
  }
  for (const p of periods) {
    p.orderVolumeEur = Math.round(p.orderVolumeEur * 100) / 100
    p.reorderValueEur = Math.round(p.reorderValueEur * 100) / 100
  }
  return periods
}

/**
 * Kiszámolja a tölcsér-KPI-kat havi vagy heti bontásban, egy pillanatnyi
 * (snapshot) tölcsér-konverziót, valamint a havi + év eleji kumulált
 * terv/tény összevetést. A snapshot-konverzió a jelenlegi pipeline
 * állapotán alapul (nincs szakasz-history), ezt a note-ok jelzik.
 */
export async function computeFunnelStats(
  opts: { granularity?: Granularity; periods?: number } = {},
  db: typeof defaultPrisma = defaultPrisma
): Promise<FunnelStats> {
  const prisma = db
  const granularity: Granularity = opts.granularity ?? 'month'
  const count = Math.min(Math.max(opts.periods ?? (granularity === 'month' ? 6 : 8), 1), 24)
  const now = new Date()

  const periodBuckets = buildBuckets(granularity, count, now)
  // A terv/tény év elejétől kumulál — a nyers adatokat legalább január 1-jétől kell lekérni.
  const ytdBuckets = buildBuckets('month', now.getMonth() + 1, now)
  const dataStart = new Date(Math.min(periodBuckets[0].start.getTime(), ytdBuckets[0].start.getTime()))

  const [createdDeals, wonDeals, activities, allOrders, stageGroups, targets] = await Promise.all([
    prisma.deal.findMany({
      where: { createdAt: { gte: dataStart } },
      select: { createdAt: true, stage: true },
    }),
    prisma.deal.findMany({
      where: {
        stage: 'won',
        OR: [{ closeDate: { gte: dataStart } }, { updatedAt: { gte: dataStart } }],
      },
      select: { closeDate: true, updatedAt: true },
    }),
    prisma.activity.findMany({
      where: { activityDate: { gte: dataStart }, type: { in: FOLLOWUP_ACTIVITY_TYPES } },
      select: { activityDate: true },
    }),
    // Minden nem-lemondott rendelés (a reorder-detektáláshoz a range előtti előzmény is kell).
    prisma.order.findMany({
      where: { status: { not: 'cancelled' } },
      select: { companyId: true, date: true, total: true },
      orderBy: [{ companyId: 'asc' }, { date: 'asc' }],
    }),
    prisma.deal.groupBy({ by: ['stage'], _count: true }),
    loadFunnelTargets(prisma),
  ]) as [
    Array<{ createdAt: Date; stage: string }>,
    Array<{ closeDate: Date | null; updatedAt: Date }>,
    Array<{ activityDate: Date }>,
    Array<{ companyId: string | null; date: Date; total: number }>,
    Array<{ stage: string; _count: number }>,
    Record<string, FunnelTargetValues>,
  ]

  // Reorder-flag cégenkénti sorrend alapján (egyszer, mindkét bucket-halmazhoz).
  const seenPerCompany: Record<string, number> = {}
  const ordersWithFlag = allOrders.map((o) => {
    const seq = o.companyId ? (seenPerCompany[o.companyId] = (seenPerCompany[o.companyId] ?? 0) + 1) : 1
    return { date: o.date, total: o.total, isReorder: o.companyId != null && seq >= 2 }
  })

  const raw: RawData = { createdDeals, wonDeals, activities, ordersWithFlag }

  const periods = aggregate(periodBuckets, raw)
  const monthActuals = aggregate(ytdBuckets, raw)

  // ── Snapshot tölcsér-konverzió (jelenlegi pipeline állapot) ──
  const countByStage: Record<string, number> = {}
  for (const g of stageGroups) countByStage[normalizeStage(g.stage)] = (countByStage[normalizeStage(g.stage)] ?? 0) + g._count
  const totalLost = countByStage['lost'] ?? 0
  const totalWon = countByStage['won'] ?? 0

  const reachedAt = (idx: number) =>
    ACTIVE_FUNNEL.reduce((sum, s) => (STAGE_INDEX[s] >= idx ? sum + (countByStage[s] ?? 0) : sum), 0) +
    (idx === 0 ? totalLost : 0)

  const stages: FunnelSnapshotStage[] = ACTIVE_FUNNEL.map((key, idx) => {
    const reached = reachedAt(idx)
    const prevReached = idx === 0 ? reached : reachedAt(idx - 1)
    const conversionFromPrev = idx === 0 ? null : prevReached > 0 ? Math.round((reached / prevReached) * 1000) / 10 : 0
    return { key, label: DEAL_STAGES.find((s) => s.key === key)!.label, count: countByStage[key] ?? 0, reached, conversionFromPrev }
  })

  const totalActive = ACTIVE_FUNNEL.filter((s) => s !== 'won').reduce((sum, s) => sum + (countByStage[s] ?? 0), 0)

  // ── Terv/tény: havi + év elejétől kumulált ──
  const ytdAccum: Record<string, number> = {}          // kumulált tény metrikánként
  const ytdPlanAccum: Record<string, number> = {}       // kumulált terv metrikánként
  let ytdHasPlan = false

  const planMonths: PlanVsActualMonth[] = ytdBuckets.map((b, idx) => {
    const actual = monthActuals[idx]
    const plan = targets[b.key] ?? null
    if (plan) ytdHasPlan = true

    const month: Record<string, MetricComparison> = {}
    const ytd: Record<string, MetricComparison> = {}

    for (const m of METRICS) {
      const aVal = actual[m.actual] as number
      const pVal = plan ? plan[m.target] : null
      month[m.key] = { actual: aVal, plan: pVal, variancePct: variancePct(aVal, pVal) }

      ytdAccum[m.key] = (ytdAccum[m.key] ?? 0) + aVal
      if (pVal != null) ytdPlanAccum[m.key] = (ytdPlanAccum[m.key] ?? 0) + pVal
      const ytdActual = Math.round(ytdAccum[m.key] * 100) / 100
      const ytdPlan = m.key in ytdPlanAccum ? (ytdHasPlan ? ytdPlanAccum[m.key] : null) : null
      ytd[m.key] = { actual: ytdActual, plan: ytdPlan, variancePct: variancePct(ytdActual, ytdPlan) }
    }

    return { yearMonth: b.key, label: b.label, hasPlan: plan != null, month, ytd }
  })

  return {
    generatedAt: now.toISOString(),
    granularity,
    rangeStart: periodBuckets[0].start.toISOString(),
    periods,
    funnelSnapshot: {
      stages,
      totalActive,
      totalWon,
      totalLost,
      note: 'A konverzió a pipeline jelenlegi állapotán alapul (nincs szakasz-history). A lost dealek az outreach szinten számítanak.',
    },
    planVsActual: {
      year: now.getFullYear(),
      metrics: METRICS.map((m) => m.key),
      months: planMonths,
      note: 'A tény/terv/eltérés az adott hónapra és év elejétől kumuláltan. Terv nélküli hónapoknál a plan null. A tervszámok a FunnelTarget táblából, hiányában a beépített defaultokból jönnek.',
    },
  }
}
