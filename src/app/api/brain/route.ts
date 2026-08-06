import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { searchKnowledge, KNOWLEDGE_SCOPES, type KnowledgeScope } from '@/lib/knowledgeSearch'
import { createBrainNote, BRAIN_KINDS, type BrainKind } from '@/lib/brain'

export const dynamic = 'force-dynamic'

/**
 * GET /api/brain
 *   ?search=1  → egységes keresés a teljes tudásban (brain + memória + aktivitás + levél)
 *   egyébként  → Brain-bejegyzések listája szűrve
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams

  if (p.get('search')) {
    const scopes = p.getAll('scope').filter((s): s is KnowledgeScope =>
      (KNOWLEDGE_SCOPES as string[]).includes(s))
    const hits = await searchKnowledge({
      query:     p.get('query')     ?? undefined,
      scopes:    scopes.length ? scopes : undefined,
      kind:      p.get('kind')      ?? undefined,
      companyId: p.get('companyId') ?? undefined,
      contactId: p.get('contactId') ?? undefined,
      status:    p.get('status')    ?? undefined,
      from:      p.get('from')      ?? undefined,
      to:        p.get('to')        ?? undefined,
      limit:     p.get('limit') ? Number(p.get('limit')) : undefined,
    })
    return NextResponse.json(hits)
  }

  const kind = p.get('kind')
  const notes = await prisma.brainNote.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(p.get('companyId') ? { companyId: p.get('companyId')! } : {}),
      ...(p.get('contactId') ? { contactId: p.get('contactId')! } : {}),
      ...(p.get('status') ? { status: p.get('status')! } : {}),
    },
    include: { company: { select: { id: true, name: true } } },
    orderBy: [{ importance: 'desc' }, { eventDate: 'desc' }],
    take: p.get('limit') ? Number(p.get('limit')) : 100,
  })
  return NextResponse.json(notes)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!BRAIN_KINDS.includes(body.kind)) {
    return NextResponse.json(
      { error: `Érvénytelen típus. Lehetséges: ${BRAIN_KINDS.join(', ')}` },
      { status: 400 }
    )
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'A cím kötelező.' }, { status: 400 })
  }

  const note = await createBrainNote({
    kind:       body.kind as BrainKind,
    title:      body.title.trim(),
    content:    body.content?.trim() || body.title.trim(),
    details:    body.details ?? {},
    status:     body.status,
    importance: body.importance,
    companyId:  body.companyId,
    contactId:  body.contactId,
    dealId:     body.dealId,
    orderId:    body.orderId,
    taskId:     body.taskId,
    source:     'user',
    eventDate:  body.eventDate,
    dueDate:    body.dueDate,
  })
  return NextResponse.json(note, { status: 201 })
}
