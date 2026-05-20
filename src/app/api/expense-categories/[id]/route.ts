import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const category = await prisma.expenseCategory.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      color: body.color ?? undefined,
      sortOrder: body.sortOrder ?? undefined,
      active: body.active ?? undefined,
    },
  })
  return NextResponse.json(category)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.expenseCategory.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
