import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const categories = await prisma.expenseCategory.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(categories)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const last = await prisma.expenseCategory.findFirst({ orderBy: { sortOrder: 'desc' } })
  const category = await prisma.expenseCategory.create({
    data: {
      name: body.name,
      color: body.color ?? '#6B7280',
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  })
  return NextResponse.json(category, { status: 201 })
}
