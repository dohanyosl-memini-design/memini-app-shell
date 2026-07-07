// Egyetlen aggregátor: egy dátumtartományra párhuzamosan lekérdezi a meglévő
// forrásokat és egységes CalendarEvent[]-et ad vissza. Minden nézet és API ezt
// használja. Új adatsiló NINCS — csak olvasás a meglévő entitásokból.

import { startOfDay, endOfDay, format } from 'date-fns'
import { prisma as defaultPrisma } from '../prisma'
import { computeReorderDue } from '../reorderDue'
import type { CalendarEvent } from './types'

// Ha az időpont nem éjfél, kiírjuk HH:mm-ként.
function timeOf(d: Date): string | undefined {
  if (d.getHours() === 0 && d.getMinutes() === 0) return undefined
  return format(d, 'HH:mm')
}

export async function aggregateCalendarEvents(
  range: { from: Date; to: Date; now?: Date },
  db: typeof defaultPrisma = defaultPrisma
): Promise<CalendarEvent[]> {
  const prisma = db
  const now = range.now ?? new Date()
  const from = startOfDay(range.from)
  const to = endOfDay(range.to)
  const today = startOfDay(now)
  const todayInRange = today >= from && today <= to

  const [tasks, activities, dealFollowups, reorder] = await Promise.all([
    // 1. Feladatok a dueDate alapján (a lemondottakat kihagyjuk)
    prisma.task.findMany({
      where: { dueDate: { gte: from, lte: to }, status: { not: 'cancelled' } },
      select: {
        id: true, title: true, dueDate: true, status: true, taskType: true,
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
    }),
    // 2. Aktivitások a dátumuk alapján
    prisma.activity.findMany({
      where: { activityDate: { gte: from, lte: to } },
      select: {
        id: true, type: true, subject: true, description: true, activityDate: true,
        contactId: true, companyId: true, dealId: true,
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
    }),
    // 3. Deal follow-up esedékesség = aktív deal closeDate-je ("Várható zárás")
    prisma.deal.findMany({
      where: { stage: { notIn: ['won', 'lost'] }, closeDate: { gte: from, lte: to } },
      select: {
        id: true, title: true, stage: true, closeDate: true,
        company: { select: { name: true } },
      },
    }),
    // 4. Reorder-trigger — a meglévő 9 hónapos lista (dátum nélkül: "most csináld")
    computeReorderDue({ now }, prisma),
  ])

  const events: CalendarEvent[] = []

  for (const t of tasks) {
    const due = t.dueDate!
    const status = t.status === 'done' ? 'done' : due < today ? 'overdue' : 'open'
    const who = t.company?.name ?? (t.contact ? `${t.contact.firstName} ${t.contact.lastName}` : undefined)
    events.push({
      id: `task-${t.id}`,
      source: 'task',
      title: t.title,
      date: due.toISOString(),
      time: timeOf(due),
      status,
      linkTo: `/tasks/${t.id}`,
      entityId: t.id,
      subtitle: who,
      meta: t.taskType ? `Típus: ${t.taskType}` : undefined,
    })
  }

  for (const a of activities) {
    const when = a.activityDate
    const who = a.company?.name ?? (a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : undefined)
    const linkTo = a.contactId ? `/contacts/${a.contactId}`
      : a.companyId ? `/companies/${a.companyId}`
      : a.dealId ? '/deals' : '/naptar'
    events.push({
      id: `activity-${a.id}`,
      source: 'activity',
      title: a.subject?.trim() || a.description.slice(0, 60),
      date: when.toISOString(),
      time: timeOf(when),
      // Múltbeli activity megtörtént (done, halványan); jövőbeli tervezett (open)
      status: when < now ? 'done' : 'open',
      linkTo,
      entityId: a.id,
      subtitle: who,
      meta: `Aktivitás: ${a.type}`,
    })
  }

  for (const d of dealFollowups) {
    const when = d.closeDate!
    events.push({
      id: `followup-${d.id}`,
      source: 'followup',
      title: `Follow-up: ${d.title}`,
      date: when.toISOString(),
      time: timeOf(when),
      status: when < today ? 'overdue' : 'open',
      linkTo: '/deals',
      entityId: d.id,
      subtitle: d.company?.name ?? undefined,
      meta: `Deal szakasz: ${d.stage}`,
    })
  }

  // A reorder-elemek dátum nélküliek → a mai napra kerülnek, ha az a tartományban van.
  if (todayInRange) {
    for (const item of reorder.items) {
      events.push({
        id: `reorder-${item.companyId}`,
        source: 'reorder',
        title: `Reorder: ${item.companyName}`,
        date: today.toISOString(),
        status: item.isDue ? 'overdue' : 'open',
        linkTo: `/companies/${item.companyId}`,
        entityId: item.companyId,
        subtitle: item.contactName ?? undefined,
        meta: `Utolsó rendelés: ${format(new Date(item.lastOrderDate), 'yyyy-MM-dd')} · ${item.monthsSinceLastOrder} hó${item.isSeasonCall ? ' · szezon-hívás' : ''}`,
      })
    }
  }

  return events
}
