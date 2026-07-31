/**
 * Ajánlat kiküldöttre jelölése.
 *
 * Két dolgot csinál egyszerre, és pont ezért van közös helyen: a státuszt a
 * kiküldés ténye lépteti (nem az emlékezet), és felkerül egy utánkövető
 * feladat. Enélkül a kiküldött ajánlat csendben elhal — senki nem szól, hogy
 * választ várunk rá.
 */

import { prisma } from '@/lib/prisma'
import { logTaskCreated } from '@/lib/taskEvents'

/** Hány nap múlva kérdezzünk rá, ha nincs korábbi lejárat. */
const DEFAULT_FOLLOW_UP_DAYS = 7

export type MarkSentResult =
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'already_sent'; quoteNumber: string; sentAt: Date }
  | { ok: true; quoteNumber: string; followUpAt: Date; taskId: string }

export async function markQuoteSent(
  quoteId: string,
  actor: string,
  followUpDays = DEFAULT_FOLLOW_UP_DAYS,
): Promise<MarkSentResult> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
  })
  if (!quote) return { ok: false, reason: 'not_found' }
  if (quote.sentAt) {
    return { ok: false, reason: 'already_sent', quoteNumber: quote.number, sentAt: quote.sentAt }
  }

  const now = new Date()
  const defaultFollowUp = new Date(now.getTime() + followUpDays * 24 * 60 * 60 * 1000)
  // Ha az ajánlat hamarabb jár le, mint az alap utánkövetés, akkor a lejárat
  // előtt kérdezzünk rá — utána már nincs mit menteni.
  const followUpAt =
    quote.validUntil && quote.validUntil < defaultFollowUp ? quote.validUntil : defaultFollowUp

  const partner =
    quote.company?.name ??
    (quote.contact ? `${quote.contact.firstName} ${quote.contact.lastName}` : 'a partner')

  const [, task] = await Promise.all([
    prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'sent', sentAt: now },
    }),
    prisma.task.create({
      data: {
        title:       `Ajánlat utánkövetés: ${quote.number} – ${partner}`,
        description: `A(z) ${quote.number} ajánlat kiment ${partner} részére. Ha nem érkezett válasz, érdemes rákérdezni.\n\nElfogadás esetén az ajánlat egy kattintással megrendelésre görgethető.`,
        status:      'waiting',
        priority:    'medium',
        taskType:    'sales',
        source:      actor === 'agent' ? 'agent' : 'human',
        waitingFor:  partner,
        followUpAt,
        dueDate:     followUpAt,
        companyId:   quote.companyId,
        contactId:   quote.contactId,
      },
      select: { id: true },
    }),
  ])

  await logTaskCreated(task.id, actor)

  return { ok: true, quoteNumber: quote.number, followUpAt, taskId: task.id }
}
