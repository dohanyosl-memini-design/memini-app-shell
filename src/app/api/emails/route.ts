import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Levélszál-lista a "Levelek" fülhöz. Szűrők: status (unanswered | answered |
// all), companyId (partner-oldali beágyazáshoz), search (tárgy/snippet).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'
  const companyId = searchParams.get('companyId') || ''
  const search = searchParams.get('search') || ''

  const statusFilter =
    status === 'unanswered' ? { replyStatus: 'unanswered' }
    : status === 'answered' ? { replyStatus: 'answered' }
    : status === 'waiting' ? { replyStatus: { in: ['unanswered', 'reply_later'] } }
    : {}

  const threads = await prisma.emailThread.findMany({
    where: {
      ...statusFilter,
      ...(companyId ? { companyId } : {}),
      ...(search ? {
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { emails: { some: { snippet: { contains: search, mode: 'insensitive' } } } },
        ],
      } : {}),
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
    select: {
      id: true, subject: true, replyStatus: true,
      lastMessageAt: true, messageCount: true,
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      emails: {
        orderBy: { sentAt: 'desc' }, take: 1,
        select: { snippet: true, direction: true },
      },
      drafts: {
        where: { status: { in: ['draft', 'approved'] } },
        select: { id: true, source: true },
      },
    },
  })

  const result = threads.map(t => ({
    id: t.id,
    subject: t.subject,
    replyStatus: t.replyStatus,
    lastMessageAt: t.lastMessageAt,
    messageCount: t.messageCount,
    snippet: t.emails[0]?.snippet ?? '',
    lastDirection: t.emails[0]?.direction ?? null,
    company: t.company,
    contact: t.contact ? {
      id: t.contact.id,
      name: `${t.contact.firstName} ${t.contact.lastName}`.trim(),
    } : null,
    hasAgentDraft: t.drafts.some(d => d.source === 'agent'),
    draftCount: t.drafts.length,
  }))

  // Válaszra váró darabszám a fül-jelvényhez (a companyId szűrőt tiszteletben tartva).
  const unansweredCount = await prisma.emailThread.count({
    where: { replyStatus: 'unanswered', ...(companyId ? { companyId } : {}) },
  })

  return NextResponse.json({ threads: result, unansweredCount })
}
