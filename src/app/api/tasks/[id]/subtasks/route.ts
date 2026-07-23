import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const subtask = await prisma.subTask.create({
    data: {
      title: body.title,
      taskId: params.id,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
  })
  return NextResponse.json(subtask, { status: 201 })
}
