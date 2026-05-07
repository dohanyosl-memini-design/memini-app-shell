import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const companyId = searchParams.get('companyId')

  const where: Record<string, unknown> = {}
  if (status && status !== 'all') where.status = status
  if (companyId) where.companyId = companyId

  const tasks = await prisma.task.findMany({
    where,
    include: { contact: true, deal: true },
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
      contactId: body.contactId || null,
      dealId: body.dealId || null,
      companyId: body.companyId || null,
    },
    include: { contact: true, deal: true },
  })

  return NextResponse.json(task, { status: 201 })
}
