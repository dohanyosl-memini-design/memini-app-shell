import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const subtask = await prisma.subTask.update({
    where: { id: params.id },
    data: { completed: body.completed },
  })
  return NextResponse.json(subtask)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.subTask.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
