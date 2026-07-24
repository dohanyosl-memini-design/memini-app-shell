import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Egy teljes levélszál: időrendes levelek, résztvevők, és a hozzá tartozó
// (kézi vagy agent-)tervezetek — a jóváhagyó felülethez.
export async function GET(
  _request: NextRequest,
  { params }: { params: { threadId: string } },
) {
  const thread = await prisma.emailThread.findUnique({
    where: { id: params.threadId },
    select: {
      id: true, subject: true, replyStatus: true,
      firstMessageAt: true, lastMessageAt: true, messageCount: true,
      company: { select: { id: true, name: true, city: true, partnerType: true, classification: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      emails: {
        orderBy: { sentAt: 'asc' },
        select: {
          id: true, subject: true, direction: true,
          textBody: true, htmlBody: true, snippet: true,
          sentAt: true, receivedAt: true,
          participants: {
            select: { type: true, emailAddress: true, displayName: true },
          },
          attachments: {
            select: { id: true, filename: true, contentType: true },
          },
        },
      },
      drafts: {
        where: { status: { in: ['draft', 'approved', 'failed'] } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, subject: true, bodyText: true, status: true,
          source: true, createdAt: true, sendError: true,
        },
      },
    },
  })

  if (!thread) {
    return NextResponse.json({ error: 'A levélszál nem található.' }, { status: 404 })
  }

  return NextResponse.json({
    ...thread,
    contact: thread.contact ? {
      ...thread.contact,
      name: `${thread.contact.firstName} ${thread.contact.lastName}`.trim(),
    } : null,
  })
}
