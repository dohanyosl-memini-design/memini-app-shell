// Fókusz-aggregáció — a következő N nap (alap: 3) legfontosabb tennivalói egy
// helyen, típustól függetlenül: feladatok (deal/lead kontextussal), időzített
// alfeladatok (előkészítő lépések), marketing-posztok, lejáró utánkövetések.
// Közös motor a /api/focus végponthoz és az MCP get_daily_focus toolhoz.

import { prisma as defaultPrisma } from './prisma'
import { dueHasTime } from './datetime'

export type FocusBucket = 'overdue' | 'today' | 'day1' | 'day2' | 'later'
export type FocusKind = 'task' | 'subtask' | 'content' | 'followup'

export interface FocusItem {
  kind: FocusKind
  id: string
  title: string
  date: string | null       // ISO — a releváns dátum (határidő / ütemezés / követés)
  hasTime: boolean
  bucket: FocusBucket
  focused: boolean
  status: string
  priority?: string
  taskType?: string | null
  channel?: string | null
  href: string              // hova visz a kattintás
  parentTitle?: string | null   // alfeladatnál a szülő feladat címe
  context?: string | null       // deal / cég / lead kontextus rövid szövege
  subDone?: number
  subTotal?: number
}

export interface FocusResult {
  generatedAt: string
  days: number
  today: string             // YYYY-MM-DD (Europe/Budapest)
  items: FocusItem[]
  counts: Record<FocusBucket, number>
}

const TZ = 'Europe/Budapest'
const bpDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD

function bucketFor(dateStr: string, todayStr: string, days: number): FocusBucket | null {
  const diff = Math.round((Date.parse(dateStr) - Date.parse(todayStr)) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff === 1) return 'day1'
  if (diff === 2) return 'day2'
  if (diff < days) return 'later'
  return null
}

export async function buildFocus(
  opts: { days?: number } = {},
  db: typeof defaultPrisma = defaultPrisma
): Promise<FocusResult> {
  const days = Math.min(Math.max(opts.days ?? 3, 1), 14)
  const now = new Date()
  const todayStr = bpDay(now)
  const windowEnd = new Date(now.getTime() + (days + 1) * 86400000)
  const overdueFrom = new Date(now.getTime() - 120 * 86400000)

  const [tasks, subtasks, contents] = await Promise.all([
    db.task.findMany({
      where: {
        status: { notIn: ['completed', 'cancelled'] },
        OR: [
          { dueDate: { gte: overdueFrom, lte: windowEnd } },
          { followUpAt: { gte: overdueFrom, lte: windowEnd } },
          { focused: true },
        ],
      },
      select: {
        id: true, title: true, status: true, priority: true, taskType: true,
        dueDate: true, followUpAt: true, waitingFor: true, focused: true,
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true, status: true } },
        deal: { select: { title: true } },
        subtasks: { select: { completed: true } },
      },
    }),
    db.subTask.findMany({
      where: {
        completed: false,
        dueDate: { gte: overdueFrom, lte: windowEnd },
      },
      select: {
        id: true, title: true, dueDate: true,
        task: { select: { id: true, title: true, status: true } },
      },
    }),
    db.contentPiece.findMany({
      where: {
        status: { notIn: ['published', 'archived'] },
        OR: [
          { scheduledFor: { gte: overdueFrom, lte: windowEnd } },
          { focused: true },
        ],
      },
      select: { id: true, title: true, channel: true, status: true, scheduledFor: true, focused: true },
    }),
  ])

  const items: FocusItem[] = []

  for (const t of tasks) {
    // Várakozó feladatnál a követési dátum a releváns, egyébként a határidő.
    const eff = t.status === 'waiting' && t.followUpAt ? t.followUpAt : t.dueDate
    const bucket = eff ? bucketFor(bpDay(eff), todayStr, days) : null
    if (!bucket && !t.focused) continue
    const ctx: string[] = []
    if (t.deal) ctx.push(`Deal: ${t.deal.title}`)
    if (t.contact) {
      const isLead = t.contact.status === 'lead' || t.contact.status === 'contacted'
      ctx.push(`${isLead ? 'Lead' : 'Kapcsolat'}: ${t.contact.firstName} ${t.contact.lastName}`)
    }
    if (t.company) ctx.push(t.company.name)
    items.push({
      kind: t.status === 'waiting' ? 'followup' : 'task',
      id: t.id,
      title: t.status === 'waiting' && t.waitingFor ? `${t.title} — vár: ${t.waitingFor}` : t.title,
      date: eff ? eff.toISOString() : null,
      hasTime: eff ? dueHasTime(eff) : false,
      bucket: bucket ?? 'later',
      focused: t.focused,
      status: t.status,
      priority: t.priority,
      taskType: t.taskType,
      href: `/tasks/${t.id}`,
      context: ctx.length ? ctx.join(' · ') : null,
      subDone: t.subtasks.filter(s => s.completed).length,
      subTotal: t.subtasks.length,
    })
  }

  for (const s of subtasks) {
    if (!s.dueDate || s.task.status === 'completed' || s.task.status === 'cancelled') continue
    const bucket = bucketFor(bpDay(s.dueDate), todayStr, days)
    if (!bucket) continue
    items.push({
      kind: 'subtask',
      id: s.id,
      title: s.title,
      date: s.dueDate.toISOString(),
      hasTime: dueHasTime(s.dueDate),
      bucket,
      focused: false,
      status: 'pending',
      href: `/tasks/${s.task.id}`,
      parentTitle: s.task.title,
    })
  }

  for (const c of contents) {
    const bucket = c.scheduledFor ? bucketFor(bpDay(c.scheduledFor), todayStr, days) : null
    if (!bucket && !c.focused) continue
    items.push({
      kind: 'content',
      id: c.id,
      title: c.title,
      date: c.scheduledFor ? c.scheduledFor.toISOString() : null,
      hasTime: c.scheduledFor ? dueHasTime(c.scheduledFor) : false,
      bucket: bucket ?? 'later',
      focused: c.focused,
      status: c.status,
      channel: c.channel,
      href: `/marketing/piece/${c.id}`,
    })
  }

  // Rendezés: bucket sorrend → időpont → prioritás.
  const bucketOrder: Record<FocusBucket, number> = { overdue: 0, today: 1, day1: 2, day2: 3, later: 4 }
  const prioOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  items.sort((a, b) => {
    if (bucketOrder[a.bucket] !== bucketOrder[b.bucket]) return bucketOrder[a.bucket] - bucketOrder[b.bucket]
    const ad = a.date ? Date.parse(a.date) : Infinity
    const bd = b.date ? Date.parse(b.date) : Infinity
    if (ad !== bd) return ad - bd
    return (prioOrder[a.priority ?? 'medium'] ?? 1) - (prioOrder[b.priority ?? 'medium'] ?? 1)
  })

  const counts: Record<FocusBucket, number> = { overdue: 0, today: 0, day1: 0, day2: 0, later: 0 }
  for (const it of items) counts[it.bucket]++

  return { generatedAt: now.toISOString(), days, today: todayStr, items, counts }
}
