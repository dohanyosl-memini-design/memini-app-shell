import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const goal = await prisma.goal.findUnique({
    where: { id: params.id },
    include: {
      parent: { select: { id: true, title: true, level: true } },
      children: {
        where: { archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true } },
          subtasks: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      },
    },
  })
  if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(goal)
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
  if (body.metricKey !== undefined) upd.metricKey = body.metricKey || null
  if (body.targetValue !== undefined) upd.targetValue = body.targetValue ?? null
  if (body.sortOrder !== undefined) upd.sortOrder = body.sortOrder
  if (body.parentId !== undefined) upd.parentId = body.parentId || null
  if (body.archived === true) upd.archivedAt = new Date()
  if (body.archived === false) upd.archivedAt = null

  const goal = await prisma.goal.update({ where: { id: params.id }, data: upd })
  return NextResponse.json(goal)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const childCount = await prisma.goal.count({ where: { parentId: params.id } })
  if (childCount > 0) {
    return NextResponse.json(
      { error: 'A célnak alárendelt céljai vannak — előbb azokat kell törölni vagy áthelyezni.' },
      { status: 400 }
    )
  }
  // A hozzákötött feladatok megmaradnak, csak a cél-kapcsolat oldódik le.
  await prisma.task.updateMany({ where: { goalId: params.id }, data: { goalId: null } })
  await prisma.goal.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
