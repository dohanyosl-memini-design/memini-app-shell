import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logTaskDiff } from '@/lib/taskEvents'

export const dynamic = 'force-dynamic'

const include = {
  contact: true,
  deal: true,
  company: true,
  goal: { select: { id: true, title: true, level: true, year: true, quarter: true, month: true } },
  assignee: { select: { id: true, name: true } },
  subtasks: { orderBy: { createdAt: 'asc' as const } },
  events: { orderBy: { createdAt: 'desc' as const }, take: 50 },
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const task = await prisma.task.findUnique({ where: { id: params.id }, include })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(task)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const before = await prisma.task.findUnique({ where: { id: params.id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const task = await prisma.task.update({
    where: { id: params.id },
    data: {
      title: body.title,
      description: body.description || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: body.status,
      priority: body.priority,
      taskType: body.taskType || null,
      waitingFor: body.status === 'waiting' ? body.waitingFor || null : null,
      followUpAt: body.status === 'waiting' && body.followUpAt ? new Date(body.followUpAt) : null,
      goalId: body.goalId || null,
      assigneeId: body.assigneeId || null,
      contactId: body.contactId || null,
      dealId: body.dealId || null,
      companyId: body.companyId || null,
      // Csak ha explicit jön — a csillag külön művelet, a form-mentés ne törölje.
      ...(body.focused !== undefined ? { focused: body.focused } : {}),
    },
    include,
  })

  await logTaskDiff(params.id, body.actor || 'web', before, task)

  return NextResponse.json(task)
}

// Részleges frissítés — pl. a Fókusz-csillag vagy gyors státuszváltás.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const before = await prisma.task.findUnique({ where: { id: params.id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const data: Record<string, unknown> = {}
  if (body.focused !== undefined) data.focused = body.focused
  if (body.status !== undefined) data.status = body.status
  if (body.priority !== undefined) data.priority = body.priority
  const task = await prisma.task.update({ where: { id: params.id }, data, include })
  await logTaskDiff(params.id, body.actor || 'web', before, task)
  return NextResponse.json(task)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.task.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
