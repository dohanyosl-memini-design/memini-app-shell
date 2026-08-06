import { prisma as defaultPrisma } from './prisma'

/**
 * A "válaszra vár" lista finomítása.
 *
 * A nyers szűrő (replyStatus=unanswered, category=conversation) önmagában zajos:
 *  - nincs időkorlát, így egy tavalyi szál is örökre "vár"
 *  - az osztályozó csak fejlécből dolgozik, ezért egy hírlevél a
 *    info@firma.de címről, List-Unsubscribe fejléc nélkül, beszélgetésnek
 *    minősül
 *
 * Nem az osztályozót írjuk át (az a szinkront érinti) — hanem a listát két
 * jelre bontjuk, amiben a valóban fontos szálak osztoznak: PARTNERHEZ KÖTÖTT
 * és FRISS. A teljes lista megmarad, csak külön kiemeljük a sürgős részhalmazt.
 */

// Ennél régebbi szálat nem tekintünk aktívan válaszra várónak (elévült).
const STALE_MONTHS = 3

export interface PendingThread {
  id: string
  subject: string
  lastMessageAt: Date
  messageCount: number
  companyId: string | null
  companyName: string | null
  ageDays: number
  partnerLinked: boolean
  stale: boolean
  priority: boolean   // partnerhez kötött ÉS friss
}

export interface PendingReplies {
  priority: PendingThread[]   // partnerhez kötött + friss — ez a napi vezérlőlista
  other: PendingThread[]      // a többi unanswered: partner nélküli vagy elévült
  counts: {
    total: number
    priority: number
    partnerLinkedStale: number   // partneres, de 3 hónapnál régebbi — nézd át, de nem sürgős
    unlinkedRecent: number       // friss, de nincs CRM-partnere — lehet valódi, lehet zaj
    unlinkedStale: number        // se partner, se frissesség — jó eséllyel zaj
  }
}

export async function computePendingReplies(
  opts: { companyId?: string; now?: Date } = {},
  db: typeof defaultPrisma = defaultPrisma,
): Promise<PendingReplies> {
  const now = opts.now ?? new Date()
  const staleCutoff = new Date(now)
  staleCutoff.setMonth(staleCutoff.getMonth() - STALE_MONTHS)

  const threads = await db.emailThread.findMany({
    where: {
      replyStatus: 'unanswered',
      category: 'conversation',
      ...(opts.companyId ? { companyId: opts.companyId } : {}),
    },
    orderBy: { lastMessageAt: 'desc' },
    select: {
      id: true, subject: true, lastMessageAt: true, messageCount: true,
      company: { select: { id: true, name: true } },
    },
  })

  const mapped: PendingThread[] = threads.map(t => {
    const partnerLinked = t.company != null
    const stale = t.lastMessageAt < staleCutoff
    const ageDays = Math.floor((now.getTime() - t.lastMessageAt.getTime()) / 86400000)
    return {
      id: t.id,
      subject: t.subject,
      lastMessageAt: t.lastMessageAt,
      messageCount: t.messageCount,
      companyId: t.company?.id ?? null,
      companyName: t.company?.name ?? null,
      ageDays,
      partnerLinked,
      stale,
      priority: partnerLinked && !stale,
    }
  })

  const priority = mapped.filter(t => t.priority)
  const other = mapped.filter(t => !t.priority)

  return {
    priority,
    other,
    counts: {
      total: mapped.length,
      priority: priority.length,
      partnerLinkedStale: mapped.filter(t => t.partnerLinked && t.stale).length,
      unlinkedRecent: mapped.filter(t => !t.partnerLinked && !t.stale).length,
      unlinkedStale: mapped.filter(t => !t.partnerLinked && t.stale).length,
    },
  }
}
