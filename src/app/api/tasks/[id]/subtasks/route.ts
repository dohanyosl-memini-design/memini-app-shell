import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const subtask = await prisma.subTask.create({
    data: { title: body.title, taskId: params.id },
  })
  return NextResponse.json(subtask, { status: 201 })
}
