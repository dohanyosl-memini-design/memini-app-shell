import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const arc = await prisma.marketingArc.findUnique({
    where: { id: params.id },
    include: {
      parent: { select: { id: true, title: true, level: true } },
      goal: { select: { id: true, title: true } },
      children: { where: { archivedAt: null }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      themes: {
        where: { archivedAt: null },
        include: { _count: { select: { pieces: true } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      pieces: {
        where: { status: { not: 'archived' } },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
      },
    },
  })
  if (!arc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(arc)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const upd: Record<string, unknown> = {}
  if (body.title !== undefined) upd.title = body.title
  if (body.description !== undefined) upd.description = body.description || null
  if (body.year !== undefined) upd.year = body.year ?? null
  if (body.quarter !== undefined) upd.quarter = body.quarter ?? null
  if (body.month !== undefined) upd.month = body.month ?? null
  if (body.status !== undefined) upd.status = body.status
  if (body.strategicArea !== undefined) upd.strategicArea = body.strategicArea || null
  if (body.cadence !== undefined) upd.cadence = body.cadence
  if (body.goalId !== undefined) upd.goalId = body.goalId || null
  if (body.sortOrder !== undefined) upd.sortOrder = body.sortOrder
  if (body.parentId !== undefined) upd.parentId = body.parentId || null
  if (body.archived === true) upd.archivedAt = new Date()
  if (body.archived === false) upd.archivedAt = null

  const arc = await prisma.marketingArc.update({ where: { id: params.id }, data: upd })
  return NextResponse.json(arc)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const childCount = await prisma.marketingArc.count({ where: { parentId: params.id } })
  if (childCount > 0) {
    return NextResponse.json({ error: 'Az ívnek alárendelt szintjei vannak — előbb azokat kell törölni vagy áthelyezni.' }, { status: 400 })
  }
  // A témák és tartalmak megmaradnak, csak az arc-kapcsolat oldódik le.
  await prisma.contentTheme.updateMany({ where: { arcId: params.id }, data: { arcId: null } })
  await prisma.contentPiece.updateMany({ where: { arcId: params.id }, data: { arcId: null } })
  await prisma.marketingArc.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
