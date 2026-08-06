import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BRAIN_STATUSES, type BrainKind } from '@/lib/brain'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const existing = await prisma.brainNote.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  const allowed = BRAIN_STATUSES[existing.kind as BrainKind]
  if (body.status && allowed && !allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `Érvénytelen státusz ehhez a típushoz. Lehetséges: ${allowed.join(', ')}` },
      { status: 400 }
    )
  }

  const data: Record<string, unknown> = { editedByUser: true }
  if (body.title      !== undefined) data.title      = body.title
  if (body.content    !== undefined) data.content    = body.content
  if (body.status     !== undefined) data.status     = body.status
  if (body.importance !== undefined) data.importance = body.importance
  if (body.dueDate    !== undefined) data.dueDate    = body.dueDate ? new Date(body.dueDate) : null
  if (body.details) data.details = { ...(existing.details as Record<string, unknown>), ...body.details }
  if (body.status === 'closed' && !existing.closedAt) data.closedAt = new Date()

  const note = await prisma.brainNote.update({
    where: { id: params.id },
    data,
    include: { company: { select: { id: true, name: true } } },
  })
  return NextResponse.json(note)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.brainNote.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
