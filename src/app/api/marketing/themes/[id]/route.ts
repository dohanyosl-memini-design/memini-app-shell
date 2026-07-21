import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const theme = await prisma.contentTheme.findUnique({
    where: { id: params.id },
    include: {
      arc: { select: { id: true, title: true, level: true, year: true, quarter: true, month: true } },
      pieces: {
        where: { status: { not: 'archived' } },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
      },
    },
  })
  if (!theme) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(theme)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const upd: Record<string, unknown> = {}
  if (body.title !== undefined) upd.title = body.title
  if (body.message !== undefined) upd.message = body.message || null
  if (body.outline !== undefined) upd.outline = body.outline || null
  if (body.status !== undefined) upd.status = body.status
  if (body.startDate !== undefined) upd.startDate = body.startDate ? new Date(body.startDate) : null
  if (body.endDate !== undefined) upd.endDate = body.endDate ? new Date(body.endDate) : null
  if (body.cadence !== undefined) upd.cadence = body.cadence
  if (body.arcId !== undefined) upd.arcId = body.arcId || null
  if (body.sortOrder !== undefined) upd.sortOrder = body.sortOrder
  if (body.archived === true) upd.archivedAt = new Date()
  if (body.archived === false) upd.archivedAt = null

  const theme = await prisma.contentTheme.update({ where: { id: params.id }, data: upd })
  return NextResponse.json(theme)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  // A tartalmak megmaradnak, csak a téma-kapcsolat oldódik le.
  await prisma.contentPiece.updateMany({ where: { themeId: params.id }, data: { themeId: null } })
  await prisma.contentTheme.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
