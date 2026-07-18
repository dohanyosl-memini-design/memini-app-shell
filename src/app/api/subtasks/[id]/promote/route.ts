import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logTaskCreated, logTaskEvent } from '@/lib/taskEvents'

export const dynamic = 'force-dynamic'

// Alfeladat "előléptetése" önálló feladattá: örökli a szülő feladat
// kontextusát (cél, cég, kapcsolat, deal, típus), az alfeladat pedig törlődik.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const subtask = await prisma.subTask.findUnique({
    where: { id: params.id },
    include: { task: true },
  })
  if (!subtask) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parent = subtask.task
  const [task] = await prisma.$transaction([
    prisma.task.create({
      data: {
        title: subtask.title,
        status: subtask.completed ? 'completed' : 'pending',
        priority: parent.priority,
        taskType: parent.taskType,
        source: 'human',
        goalId: parent.goalId,
        assigneeId: parent.assigneeId,
        contactId: parent.contactId,
        dealId: parent.dealId,
        companyId: parent.companyId,
      },
    }),
    prisma.subTask.delete({ where: { id: params.id } }),
  ])

  await logTaskCreated(task.id, 'web')
  await logTaskEvent(parent.id, 'web', 'subtask_promoted', undefined, subtask.title, task.id)

  return NextResponse.json(task, { status: 201 })
}
