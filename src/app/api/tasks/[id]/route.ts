import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const include = {
  contact: true,
  deal: true,
  company: true,
  assignee: { select: { id: true, name: true } },
  subtasks: { orderBy: { createdAt: 'asc' as const } },
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const task = await prisma.task.update({
    where: { id: params.id },
    data: {
      title: body.title,
      description: body.description || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: body.status,
      priority: body.priority,
      taskType: body.taskType || null,
      assigneeId: body.assigneeId || null,
      contactId: body.contactId || null,
      dealId: body.dealId || null,
      companyId: body.companyId || null,
    },
    include,
  })

  return NextResponse.json(task)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.task.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
