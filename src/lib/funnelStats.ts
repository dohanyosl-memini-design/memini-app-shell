// Tölcsér-KPI számítás (FÁZIS 2) — B2B értékesítési tölcsér havi/heti mutatói.
// Egyetlen lekérdezésből kiolvasható: outreach, follow-up, konverzió, új partnerek,
// reorderek és rendelési volumen. Közös forrás az MCP tool és a REST endpoint számára.

import {
  startOfMonth, endOfMonth, subMonths,
  startOfWeek, endOfWeek, subWeeks,
  format,
} from 'date-fns'
import { hu } from 'date-fns/locale'
import { prisma as defaultPrisma } from './prisma'
import { DEAL_STAGES, normalizeStage, type DealStage } from './dealStages'

// Follow-up = tényleges ügyfélérintés (a belső 'note' feljegyzés nem számít).
export const FOLLOWUP_ACTIVITY_TYPES = ['call', 'email', 'whatsapp', 'meeting']

// A tölcsér aktív sorrendje (won a cél, lost a kiesés — külön kezeljük).
const ACTIVE_FUNNEL: DealStage[] = ['outreach_sent', 'follow_up', 'sample_requested', 'sample_sent', 'trial_order', 'won']
const STAGE_INDEX: Record<string, number> = Object.fromEntries(ACTIVE_FUNNEL.map((s, i) => [s, i]))

export type Granularity = 'month' | 'week'

export interface FunnelPeriod {
  key: string
  label: string
  start: string
  end: string
  newOutreachDeals: number      // az adott időszakban létrehozott dealek (a tölcsérbe belépők)
  followUpActivities: number    // follow-up érintések száma (call/email/whatsapp/meeting)
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

/**
 * Kiszámolja a tölcsér-KPI-kat havi vagy heti bontásban + egy pillanatnyi
 * (snapshot) tölcsér-konverziót. A konverzió a jelenlegi pipeline állapotán
 * alapul (nincs szakasz-history), ezt a snapshot.note jelzi.
 */
export async function computeFunnelStats(
  opts: { granularity?: Granularity; periods?: number } = {},
  db: typeof defaultPrisma = defaultPrisma
): Promise<FunnelStats> {
  const prisma = db
  const granularity: Granularity = opts.granularity ?? 'month'
  const count = Math.min(Math.max(opts.periods ?? (granularity === 'month' ? 6 : 8), 1), 24)
  const now = new Date()
  const buckets = buildBuckets(granularity, count, now)
  const rangeStart = buckets[0].start

  const [createdDeals, wonDeals, activities, allOrders, stageGroups] = await Promise.all([
    prisma.deal.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { createdAt: true, closeDate: true, updatedAt: true, stage: true },
    }),
    prisma.deal.findMany({
      where: {
        stage: 'won',
        OR: [{ closeDate: { gte: rangeStart } }, { updatedAt: { gte: rangeStart } }],
      },
      select: { createdAt: true, closeDate: true, updatedAt: true, stage: true },
    }),
    prisma.activity.findMany({
      where: { activityDate: { gte: rangeStart }, type: { in: FOLLOWUP_ACTIVITY_TYPES } },
      select: { activityDate: true, type: true },
    }),
    // Minden nem-lemondott rendelés (a reorder-detektáláshoz a range előtti előzmény is kell).
    prisma.order.findMany({
      where: { status: { not: 'cancelled' } },
      select: { companyId: true, date: true, total: true, status: true },
      orderBy: [{ companyId: 'asc' }, { date: 'asc' }],
    }),
    prisma.deal.groupBy({ by: ['stage'], _count: true }),
  ]) as [
    Array<{ createdAt: Date; closeDate: Date | null; updatedAt: Date; stage: string }>,
    Array<{ createdAt: Date; closeDate: Date | null; updatedAt: Date; stage: string }>,
    Array<{ activityDate: Date; type: string }>,
    Array<{ companyId: string | null; date: Date; total: number; status: string }>,
    Array<{ stage: string; _count: number }>,
  ]

  // Üres periódusok inicializálása
  const periods: FunnelPeriod[] = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    start: b.start.toISOString(),
    end: b.end.toISOString(),
    newOutreachDeals: 0,
    followUpActivities: 0,
    newPartners: 0,
    reorderCount: 0,
    reorderValueEur: 0,
    orderVolumeEur: 0,
  }))

  // 1. Új outreach dealek (létrehozás időszaka szerint)
  for (const d of createdDeals) {
    const i = bucketIndexFor(new Date(d.createdAt), buckets)
    if (i >= 0) periods[i].newOutreachDeals++
  }

  // 2. Follow-up aktivitások
  for (const a of activities) {
    const i = bucketIndexFor(new Date(a.activityDate), buckets)
    if (i >= 0) periods[i].followUpActivities++
  }

  // 4. Új partnerek (won az időszakban — lezárás dátuma, hiányában updatedAt)
  for (const d of wonDeals) {
    const closedAt = d.closeDate ? new Date(d.closeDate) : new Date(d.updatedAt)
    const i = bucketIndexFor(closedAt, buckets)
    if (i >= 0) periods[i].newPartners++
  }

  // 5–6. Reorderek + volumen. Céghez kötött rendelések sorszámozása időrendben.
  const seenPerCompany: Record<string, number> = {}
  for (const o of allOrders) {
    const seq = o.companyId ? (seenPerCompany[o.companyId] = (seenPerCompany[o.companyId] ?? 0) + 1) : 1
    const isReorder = o.companyId != null && seq >= 2
    const i = bucketIndexFor(new Date(o.date), buckets)
    if (i < 0) continue
    periods[i].orderVolumeEur += o.total
    if (isReorder) {
      periods[i].reorderCount++
      periods[i].reorderValueEur += o.total
    }
  }

  // Kerekítés az EUR összegeknél
  for (const p of periods) {
    p.orderVolumeEur = Math.round(p.orderVolumeEur * 100) / 100
    p.reorderValueEur = Math.round(p.reorderValueEur * 100) / 100
  }

  // 3. Snapshot tölcsér-konverzió (jelenlegi pipeline állapot)
  const countByStage: Record<string, number> = {}
  for (const g of stageGroups) countByStage[normalizeStage(g.stage)] = (countByStage[normalizeStage(g.stage)] ?? 0) + g._count
  const totalLost = countByStage['lost'] ?? 0
  const totalWon = countByStage['won'] ?? 0

  // reached[N] = hány deal jutott el legalább az N. szakaszig (lost dealt outreach-nél számoljuk).
  const reachedAt = (idx: number) =>
    ACTIVE_FUNNEL.reduce((sum, s) => (STAGE_INDEX[s] >= idx ? sum + (countByStage[s] ?? 0) : sum), 0) +
    (idx === 0 ? totalLost : 0)

  const stages: FunnelSnapshotStage[] = ACTIVE_FUNNEL.map((key, idx) => {
    const reached = reachedAt(idx)
    const prevReached = idx === 0 ? reached : reachedAt(idx - 1)
    const conversionFromPrev = idx === 0 ? null : prevReached > 0 ? Math.round((reached / prevReached) * 1000) / 10 : 0
    return {
      key,
      label: DEAL_STAGES.find((s) => s.key === key)!.label,
      count: countByStage[key] ?? 0,
      reached,
      conversionFromPrev,
    }
  })

  const totalActive = ACTIVE_FUNNEL.filter((s) => s !== 'won').reduce((sum, s) => sum + (countByStage[s] ?? 0), 0)

  return {
    generatedAt: now.toISOString(),
    granularity,
    rangeStart: rangeStart.toISOString(),
    periods,
    funnelSnapshot: {
      stages,
      totalActive,
      totalWon,
      totalLost,
      note: 'A konverzió a pipeline jelenlegi állapotán alapul (nincs szakasz-history). A lost dealek az outreach szinten számítanak.',
    },
  }
}
