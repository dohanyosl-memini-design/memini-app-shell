// Marketing-fa + telítettség-számítás (V1) — a kadencia (heti N tartalom
// csatornánként) és a ténylegesen ütemezett/kész tartalmak alapján számítja,
// mennyire "tele van" egy arc-node vagy téma. Nem tárolt, minden lekérésnél
// frissen számítódik (mint a goalProgress).

import { prisma as defaultPrisma } from './prisma'

export interface ArcRecord {
  id: string
  title: string
  description: string | null
  level: string
  year: number | null
  quarter: number | null
  month: number | null
  status: string
  strategicArea: string | null
  cadence: unknown
  goalId: string | null
  sortOrder: number
  archivedAt: Date | null
  parentId: string | null
}

export interface FillStats {
  planned: number   // tervezett darabszám (kadencia × hetek)
  actual: number    // ténylegesen létező (nem archivált) tartalom az időszakban
  percent: number | null
}

export interface ArcTreeNode extends ArcRecord {
  cadenceMap: Record<string, number>
  fill: FillStats
  themeCount: number
  pieceCount: number
  children: ArcTreeNode[]
}

// A cél naptári időszaka a strukturált mezőkből.
export function arcRange(a: Pick<ArcRecord, 'level' | 'year' | 'quarter' | 'month'>): { start: Date; end: Date } | null {
  if (a.level === 'yearly' && a.year) {
    return { start: new Date(a.year, 0, 1), end: new Date(a.year, 11, 31, 23, 59, 59, 999) }
  }
  if (a.level === 'quarterly' && a.year && a.quarter) {
    const m0 = (a.quarter - 1) * 3
    return { start: new Date(a.year, m0, 1), end: new Date(a.year, m0 + 3, 0, 23, 59, 59, 999) }
  }
  if (a.level === 'monthly' && a.year && a.month) {
    return { start: new Date(a.year, a.month - 1, 1), end: new Date(a.year, a.month, 0, 23, 59, 59, 999) }
  }
  return null
}

function weeksInRange(range: { start: Date; end: Date } | null): number {
  if (!range) return 0
  const days = (range.end.getTime() - range.start.getTime()) / 86400000
  return Math.max(1, Math.round(days / 7))
}

function toCadenceMap(cadence: unknown): Record<string, number> {
  if (cadence && typeof cadence === 'object' && !Array.isArray(cadence)) {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(cadence as Record<string, unknown>)) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) out[k] = n
    }
    return out
  }
  return {}
}

function cadenceWeeklyTotal(map: Record<string, number>): number {
  return Object.values(map).reduce((s, n) => s + n, 0)
}

/**
 * Felépíti a marketing-fát telítettséggel. Az arc-node telítettsége:
 *  - ha van saját kadenciája → tervezett = heti összeg × hetek; tény = az
 *    időszakban ütemezett/kész (nem archivált) tartalmak száma
 *  - különben a gyerekek telítettségének átlaga
 */
export async function buildMarketingTree(
  opts: { includeArchived?: boolean } = {},
  db: typeof defaultPrisma = defaultPrisma
): Promise<ArcTreeNode[]> {
  const arcs = (await db.marketingArc.findMany({
    where: opts.includeArchived ? {} : { archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })) as ArcRecord[]

  // Az időszakban lévő tartalmak számához: minden nem archivált tartalom
  // ütemezés-dátummal. Egy tartalom akkor számít bele egy arc-ba, ha az
  // scheduledFor az arc időszakába esik (a téma az arc-hoz kötődik).
  const pieces = await db.contentPiece.findMany({
    where: { status: { not: 'archived' } },
    select: { id: true, scheduledFor: true, channel: true },
  })

  const themeCounts = await db.contentTheme.groupBy({
    by: ['arcId'],
    where: { archivedAt: null, arcId: { not: null } },
    _count: true,
  })
  const themeCountByArc: Record<string, number> = {}
  for (const t of themeCounts) if (t.arcId) themeCountByArc[t.arcId] = t._count

  const byParent: Record<string, ArcRecord[]> = {}
  const roots: ArcRecord[] = []
  for (const a of arcs) {
    if (a.parentId) (byParent[a.parentId] ??= []).push(a)
    else roots.push(a)
  }

  function actualInRange(range: { start: Date; end: Date } | null): number {
    if (!range) return pieces.filter(p => p.scheduledFor).length
    return pieces.filter(p => p.scheduledFor && p.scheduledFor >= range.start && p.scheduledFor <= range.end).length
  }

  function buildNode(arc: ArcRecord): ArcTreeNode {
    const children = (byParent[arc.id] ?? []).map(buildNode)
    const cadenceMap = toCadenceMap(arc.cadence)
    const range = arcRange(arc)

    let fill: FillStats
    const weeklyTotal = cadenceWeeklyTotal(cadenceMap)
    if (weeklyTotal > 0 && range) {
      const planned = weeklyTotal * weeksInRange(range)
      const actual = actualInRange(range)
      fill = { planned, actual, percent: planned > 0 ? Math.min(100, Math.round((actual / planned) * 1000) / 10) : null }
    } else if (children.length > 0) {
      const measurable = children.filter(c => c.fill.percent !== null)
      fill = {
        planned: children.reduce((s, c) => s + c.fill.planned, 0),
        actual: children.reduce((s, c) => s + c.fill.actual, 0),
        percent: measurable.length > 0
          ? Math.round((measurable.reduce((s, c) => s + c.fill.percent!, 0) / measurable.length) * 10) / 10
          : null,
      }
    } else {
      fill = { planned: 0, actual: range ? actualInRange(range) : 0, percent: null }
    }

    return {
      ...arc,
      cadenceMap,
      fill,
      themeCount: themeCountByArc[arc.id] ?? 0,
      pieceCount: fill.actual,
      children,
    }
  }

  return roots.map(buildNode)
}
