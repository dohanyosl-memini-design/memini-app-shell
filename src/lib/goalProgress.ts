// Cél-haladás számítás (V1) — a Goal-fa tény-értékei NEM tárolódnak,
// minden lekérésnél a CRM-adatokból számítódnak:
//   1. metricKey + targetValue → funnel-tény az adott naptári időszakra
//   2. különben, ha vannak gyerek-célok → azok haladásának átlaga
//   3. különben, ha vannak hozzákötött feladatok → kész-arányuk
//   4. különben → kézi státusz (achieved = 100%)
// A metrika-definíciók a funnelStats-szal közösek (egy igazságforrás).

import { prisma as defaultPrisma } from './prisma'
import { FOLLOWUP_ACTIVITY_TYPES, reachedSampleRequest } from './funnelStats'

export { GOAL_LEVELS, GOAL_METRICS, type GoalLevel } from './goalConstants'

export interface GoalRecord {
  id: string
  title: string
  description: string | null
  level: string
  year: number | null
  quarter: number | null
  month: number | null
  status: string
  strategicArea: string | null
  metricKey: string | null
  targetValue: number | null
  sortOrder: number
  archivedAt: Date | null
  parentId: string | null
}

export interface GoalProgress {
  percent: number | null       // 0-100, null ha nem számítható
  source: 'metric' | 'children' | 'tasks' | 'manual'
  actualValue: number | null   // metrika-alapú célnál a tény
  taskStats: { total: number; completed: number } | null
}

export interface GoalTreeNode extends GoalRecord {
  progress: GoalProgress
  children: GoalTreeNode[]
  taskCount: number
  completedTaskCount: number
}

// A cél naptári időszaka a strukturált mezőkből. Vision szinten nincs
// időhatár — a metrika (ha van) minden idők összesenjét méri.
export function goalRange(goal: Pick<GoalRecord, 'level' | 'year' | 'quarter' | 'month'>): { start: Date; end: Date } | null {
  if (goal.level === 'yearly' && goal.year) {
    return { start: new Date(goal.year, 0, 1), end: new Date(goal.year, 11, 31, 23, 59, 59, 999) }
  }
  if (goal.level === 'quarterly' && goal.year && goal.quarter) {
    const m0 = (goal.quarter - 1) * 3
    return { start: new Date(goal.year, m0, 1), end: new Date(goal.year, m0 + 3, 0, 23, 59, 59, 999) }
  }
  if (goal.level === 'monthly' && goal.year && goal.month) {
    return { start: new Date(goal.year, goal.month - 1, 1), end: new Date(goal.year, goal.month, 0, 23, 59, 59, 999) }
  }
  return null
}

interface MetricRawData {
  createdDeals: Array<{ createdAt: Date; stage: string }>
  wonDeals: Array<{ closeDate: Date | null; updatedAt: Date }>
  activities: Array<{ activityDate: Date }>
  ordersWithFlag: Array<{ date: Date; total: number; isReorder: boolean }>
}

// Egyszer kérjük le a nyers adatokat az összes metrika-kötött cél teljes időtartamára.
async function fetchMetricRawData(db: typeof defaultPrisma, from: Date | null): Promise<MetricRawData> {
  const dateFilter = from ? { gte: from } : undefined
  const [createdDeals, wonDeals, activities, allOrders] = await Promise.all([
    db.deal.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      select: { createdAt: true, stage: true },
    }),
    db.deal.findMany({
      where: {
        stage: 'won',
        ...(dateFilter ? { OR: [{ closeDate: dateFilter }, { updatedAt: dateFilter }] } : {}),
      },
      select: { closeDate: true, updatedAt: true },
    }),
    db.activity.findMany({
      where: {
        type: { in: FOLLOWUP_ACTIVITY_TYPES },
        ...(dateFilter ? { activityDate: dateFilter } : {}),
      },
      select: { activityDate: true },
    }),
    // A reorder-flaghez a teljes rendeléstörténet kell (cégenkénti sorrend).
    db.order.findMany({
      where: { status: { not: 'cancelled' } },
      select: { companyId: true, date: true, total: true },
      orderBy: [{ companyId: 'asc' }, { date: 'asc' }],
    }),
  ])

  const seenPerCompany: Record<string, number> = {}
  const ordersWithFlag = allOrders.map((o) => {
    const seq = o.companyId ? (seenPerCompany[o.companyId] = (seenPerCompany[o.companyId] ?? 0) + 1) : 1
    return { date: o.date, total: o.total, isReorder: o.companyId != null && seq >= 2 }
  })

  return { createdDeals, wonDeals, activities, ordersWithFlag }
}

function inRange(d: Date, range: { start: Date; end: Date } | null): boolean {
  if (!range) return true
  const t = d.getTime()
  return t >= range.start.getTime() && t <= range.end.getTime()
}

function metricActual(metricKey: string, range: { start: Date; end: Date } | null, raw: MetricRawData): number {
  switch (metricKey) {
    case 'outreach':
      return raw.createdDeals.filter((d) => inRange(d.createdAt, range)).length
    case 'followup':
      return raw.activities.filter((a) => inRange(a.activityDate, range)).length
    case 'sampleRequests':
      return raw.createdDeals.filter((d) => inRange(d.createdAt, range) && reachedSampleRequest(d.stage)).length
    case 'newPartners':
      return raw.wonDeals.filter((d) => inRange(d.closeDate ? new Date(d.closeDate) : d.updatedAt, range)).length
    case 'reorders':
      return raw.ordersWithFlag.filter((o) => o.isReorder && inRange(o.date, range)).length
    case 'volumeEur':
      return Math.round(raw.ordersWithFlag.filter((o) => inRange(o.date, range)).reduce((s, o) => s + o.total, 0) * 100) / 100
    default:
      return 0
  }
}

/**
 * Felépíti a teljes cél-fát kiszámolt haladással. Az archivált célok kimaradnak,
 * kivéve ha includeArchived igaz.
 */
export async function buildGoalTree(
  opts: { includeArchived?: boolean } = {},
  db: typeof defaultPrisma = defaultPrisma
): Promise<GoalTreeNode[]> {
  const goals = (await db.goal.findMany({
    where: opts.includeArchived ? {} : { archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })) as GoalRecord[]

  const taskGroups = await db.task.groupBy({
    by: ['goalId', 'status'],
    where: { goalId: { not: null } },
    _count: true,
  })

  const taskStats: Record<string, { total: number; completed: number }> = {}
  for (const g of taskGroups) {
    if (!g.goalId) continue
    const s = (taskStats[g.goalId] ??= { total: 0, completed: 0 })
    if (g.status !== 'cancelled') {
      s.total += g._count
      if (g.status === 'completed') s.completed += g._count
    }
  }

  // Metrika-kötött célok tény-értékei egy közös nyers adathalmazból.
  const metricGoals = goals.filter((g) => g.metricKey && g.targetValue)
  const actuals: Record<string, number> = {}
  if (metricGoals.length > 0) {
    const ranges = metricGoals.map((g) => goalRange(g))
    const hasUnbounded = ranges.some((r) => r === null)
    const minStart = hasUnbounded
      ? null
      : new Date(Math.min(...ranges.map((r) => r!.start.getTime())))
    const raw = await fetchMetricRawData(db, minStart)
    for (const g of metricGoals) {
      actuals[g.id] = metricActual(g.metricKey!, goalRange(g), raw)
    }
  }

  const byParent: Record<string, GoalRecord[]> = {}
  const roots: GoalRecord[] = []
  for (const g of goals) {
    if (g.parentId) (byParent[g.parentId] ??= []).push(g)
    else roots.push(g)
  }

  function buildNode(goal: GoalRecord): GoalTreeNode {
    const children = (byParent[goal.id] ?? []).map(buildNode)
    const stats = taskStats[goal.id] ?? null

    let progress: GoalProgress
    if (goal.metricKey && goal.targetValue) {
      const actual = actuals[goal.id] ?? 0
      progress = {
        percent: Math.min(100, Math.round((actual / goal.targetValue) * 1000) / 10),
        source: 'metric',
        actualValue: actual,
        taskStats: stats,
      }
    } else if (children.length > 0) {
      const measurable = children.filter((c) => c.progress.percent !== null)
      progress = {
        percent: measurable.length > 0
          ? Math.round((measurable.reduce((s, c) => s + c.progress.percent!, 0) / measurable.length) * 10) / 10
          : null,
        source: 'children',
        actualValue: null,
        taskStats: stats,
      }
    } else if (stats && stats.total > 0) {
      progress = {
        percent: Math.round((stats.completed / stats.total) * 1000) / 10,
        source: 'tasks',
        actualValue: null,
        taskStats: stats,
      }
    } else {
      progress = {
        percent: goal.status === 'achieved' ? 100 : null,
        source: 'manual',
        actualValue: null,
        taskStats: stats,
      }
    }

    return {
      ...goal,
      progress,
      children,
      taskCount: stats?.total ?? 0,
      completedTaskCount: stats?.completed ?? 0,
    }
  }

  return roots.map(buildNode)
}
