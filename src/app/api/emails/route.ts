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

  // A "Válaszra vár" CSAK valódi beszélgetés lehet (nem automata/spam).
  // KÜLDÖTT nézet: valódi "Elküldött mappa" — a MI kiment leveleink,
  // címzettel és a küldés dátumával (nem a szál utolsó, gyakran bejövő
  // levelével). Szálanként a legutóbbi kimenőt mutatjuk.
  if (status === 'sent') {
    const sentEmails = await prisma.email.findMany({
      where: {
        direction: 'outbound',
        ...(companyId ? { thread: { companyId } } : {}),
        ...(search ? {
          OR: [
            { subject: { contains: search, mode: 'insensitive' } },
            { snippet: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: { sentAt: 'desc' },
      take: 300,
      select: {
        threadId: true, subject: true, snippet: true, sentAt: true,
        participants: { where: { type: 'to' }, select: { emailAddress: true, displayName: true } },
        thread: {
          select: {
            replyStatus: true, category: true, messageCount: true,
            company: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true } },
            drafts: { where: { status: { in: ['draft', 'approved'] } }, select: { source: true } },
          },
        },
      },
    })

    // Szálanként csak a legutóbbi kimenő (a lista már dátum szerint rendezett).
    const seen = new Set<string>()
    const rows = []
    for (const e of sentEmails) {
      if (seen.has(e.threadId)) continue
      seen.add(e.threadId)
      const to = e.participants[0]
      rows.push({
        id: e.threadId,
        subject: e.subject,
        replyStatus: e.thread.replyStatus,
        category: e.thread.category,
        lastMessageAt: e.sentAt,
        messageCount: e.thread.messageCount,
        snippet: e.snippet,
        lastDirection: 'outbound',
        sender: e.thread.company?.name
          || to?.displayName || to?.emailAddress || 'Ismeretlen címzett',
        company: e.thread.company,
        contact: e.thread.contact ? {
          id: e.thread.contact.id,
          name: `${e.thread.contact.firstName} ${e.thread.contact.lastName}`.trim(),
        } : null,
        hasAgentDraft: e.thread.drafts.some(d => d.source === 'agent'),
        draftCount: e.thread.drafts.length,
      })
      if (rows.length >= 100) break
    }

    const unansweredCount = await prisma.emailThread.count({
      where: { replyStatus: 'unanswered', category: 'conversation', ...(companyId ? { companyId } : {}) },
    })
    return NextResponse.json({ threads: rows, unansweredCount })
  }

  const statusFilter =
    status === 'unanswered' ? { replyStatus: 'unanswered', category: 'conversation' }
    : status === 'inbox' ? { category: 'conversation' }
    : status === 'answered' ? { replyStatus: 'answered', category: 'conversation' }
    : status === 'automated' ? { category: 'automated' }
    : status === 'spam' ? { category: 'spam' }
    : {} // 'all'

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
      id: true, subject: true, replyStatus: true, category: true,
      lastMessageAt: true, messageCount: true,
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      emails: {
        orderBy: { sentAt: 'desc' }, take: 1,
        select: {
          snippet: true, direction: true,
          participants: { select: { type: true, emailAddress: true, displayName: true } },
        },
      },
      drafts: {
        where: { status: { in: ['draft', 'approved'] } },
        select: { id: true, source: true },
      },
    },
  })

  const result = threads.map(t => {
    const latest = t.emails[0]
    // A megjelenítendő fél: előbb a CRM-partner, különben a levél tényleges
    // külső résztvevője (bejövőnél a feladó, kimenőnél a címzett).
    const contactName = t.contact
      ? `${t.contact.firstName} ${t.contact.lastName}`.trim()
      : null
    let sender = t.company?.name || contactName || null
    if (!sender && latest) {
      const pick = latest.direction === 'inbound'
        ? latest.participants.find(p => p.type === 'from')
        : latest.participants.find(p => p.type === 'to')
      sender = pick?.displayName || pick?.emailAddress || null
    }
    return {
      id: t.id,
      subject: t.subject,
      replyStatus: t.replyStatus,
      category: t.category,
      lastMessageAt: t.lastMessageAt,
      messageCount: t.messageCount,
      snippet: latest?.snippet ?? '',
      lastDirection: latest?.direction ?? null,
      sender: sender || 'Ismeretlen feladó',
      company: t.company,
      contact: t.contact ? { id: t.contact.id, name: contactName! } : null,
      hasAgentDraft: t.drafts.some(d => d.source === 'agent'),
      draftCount: t.drafts.length,
    }
  })

  // Válaszra váró darabszám a fül-jelvényhez — CSAK valódi beszélgetés.
  const unansweredCount = await prisma.emailThread.count({
    where: { replyStatus: 'unanswered', category: 'conversation', ...(companyId ? { companyId } : {}) },
  })

  return NextResponse.json({ threads: result, unansweredCount })
}
