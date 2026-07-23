import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logTaskCreated } from '@/lib/taskEvents'

export const dynamic = 'force-dynamic'

const include = {
  contact: true,
  deal: true,
  company: true,
  goal: { select: { id: true, title: true, level: true, year: true, quarter: true, month: true } },
  assignee: { select: { id: true, name: true } },
  subtasks: { orderBy: { createdAt: 'asc' as const } },
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const companyId = searchParams.get('companyId')
  const goalId = searchParams.get('goalId')

  const where: Record<string, unknown> = {}
  if (status && status !== 'all') where.status = status
  if (companyId) where.companyId = companyId
  if (goalId) where.goalId = goalId

  const tasks = await prisma.task.findMany({
    where,
    include,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(tasks)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: body.status || 'pending',
      priority: body.priority || 'medium',
      taskType: body.taskType || null,
      source: body.source || 'human',
      focused: body.focused ?? false,
      waitingFor: body.waitingFor || null,
      followUpAt: body.followUpAt ? new Date(body.followUpAt) : null,
      goalId: body.goalId || null,
      assigneeId: body.assigneeId || null,
      contactId: body.contactId || null,
      dealId: body.dealId || null,
      companyId: body.companyId || null,
      subtasks: body.subtasks?.length
        ? { create: (body.subtasks as string[]).map((s: string) => ({ title: s })) }
        : undefined,
    },
    include,
  })

  await logTaskCreated(task.id, body.actor || 'web')

  return NextResponse.json(task, { status: 201 })
}
